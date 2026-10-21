"""Bulk actions on the submissions list: the urgent flag and bulk assign.

History worth keeping in mind: the view used to reference a Role that doesn't
exist, so every bulk call raised AttributeError, and mark_urgent/assign only
touched updated_at. These tests pin the real behaviour.
"""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import Department, FormCategory, Ministry, Profile, Role, Submission, Unit, WorkflowStage


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class BulkActionTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="BLK", name="Bulk Ministry")
        dept = Department.objects.create(ministry=self.ministry, code="ODU", name="ODU Dept")
        self.unit = Unit.objects.create(department=dept, code="ODU-1", name="ODU")
        self.other_unit = Unit.objects.create(department=dept, code="HR-1", name="HR")

        def user(name, role, unit=None):
            u = User.objects.create_user(name, password="x")
            Profile.objects.create(user=u, role=role, unit=unit)
            return u

        self.secretary = user("sec", Role.PSC_SECRETARY)
        self.odu_manager = user("odum", Role.ODU_MANAGER, self.unit)
        self.commissioner = user("comm", Role.PSC_COMMISSIONER)
        self.officer = user("off", Role.PSC_OFFICER)
        self.opsc_manager = user("opscm", Role.PSC_MANAGER)
        self.principal = user("odup", Role.ODU_PRINCIPAL, self.unit)
        self.hr_principal = user("hrp", Role.HR_UNIT_PRINCIPAL, self.other_unit)
        self.form_cat = FormCategory.objects.create(code="psc_bulk", name="PSC Bulk")
        self.client = APIClient()

    def _sub(self, title, stage=WorkflowStage.UNDER_ASSESSMENT, routed="odu"):
        return Submission.objects.create(
            title=title, form_category=self.form_cat, form_type_code="PSC 3.6", ministry=self.ministry, current_stage=stage,
            routed_unit=routed, received_at=timezone.now(), created_by=self.secretary,
        )

    def _post(self, user, action, ids, **extra):
        self.client.force_authenticate(user=user)
        return self.client.post(
            "/api/submissions/bulk-action/", {"action": action, "ids": ids, **extra}, format="json",
        )

    # ── urgent ──────────────────────────────────────────────────────────
    def test_secretary_can_flag_and_clear_urgent(self):
        a, b = self._sub("A"), self._sub("B")
        resp = self._post(self.secretary, "mark_urgent", [a.id, b.id], reason="Minister request")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["updated"], 2)
        a.refresh_from_db()
        self.assertTrue(a.is_urgent)
        self.assertEqual(a.urgent_reason, "Minister request")
        self.assertEqual(a.urgent_marked_by, self.secretary)
        self.assertIsNotNone(a.urgent_marked_at)

        resp = self._post(self.secretary, "clear_urgent", [a.id])
        self.assertEqual(resp.data["updated"], 1)
        a.refresh_from_db()
        self.assertFalse(a.is_urgent)
        self.assertIsNone(a.urgent_marked_by)

    def test_flagging_twice_is_skipped_not_counted(self):
        a = self._sub("A")
        self._post(self.secretary, "mark_urgent", [a.id])
        resp = self._post(self.secretary, "mark_urgent", [a.id])
        self.assertEqual(resp.data["updated"], 0)
        self.assertEqual(resp.data["skipped"][0]["reason"], "Already urgent.")

    def test_opsc_manager_can_flag_any_submission_urgent(self):
        a = self._sub("A", routed="hr")
        resp = self._post(self.opsc_manager, "mark_urgent", [a.id])
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["updated"], 1)

    def test_commissioner_and_officer_cannot_flag_urgent(self):
        a = self._sub("A")
        for who in (self.commissioner, self.officer):
            resp = self._post(who, "mark_urgent", [a.id])
            self.assertEqual(resp.status_code, 403)
        a.refresh_from_db()
        self.assertFalse(a.is_urgent)

    def test_manager_can_only_flag_their_own_units_submissions(self):
        mine, theirs = self._sub("Mine", routed="odu"), self._sub("Theirs", routed="hr")
        resp = self._post(self.odu_manager, "mark_urgent", [mine.id, theirs.id])
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["updated"], 1)
        mine.refresh_from_db(); theirs.refresh_from_db()
        self.assertTrue(mine.is_urgent)
        self.assertFalse(theirs.is_urgent)
        self.assertEqual(len(resp.data["skipped"]), 1)

    def test_urgent_cannot_be_set_through_normal_patch(self):
        a = self._sub("A")
        self.client.force_authenticate(user=self.secretary)
        self.client.patch(f"/api/submissions/{a.id}/", {"is_urgent": True}, format="json")
        a.refresh_from_db()
        self.assertFalse(a.is_urgent)

    # ── assign ──────────────────────────────────────────────────────────
    def test_manager_bulk_assign_applies_unit_and_stage_rules(self):
        ok = self._sub("OK")
        wrong_stage = self._sub("Wrong stage", stage=WorkflowStage.SUBMITTED)
        wrong_unit = self._sub("Wrong unit", routed="hr")
        resp = self._post(self.odu_manager, "assign", [ok.id, wrong_stage.id, wrong_unit.id], assignee_id=self.principal.id)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["updated"], 1)
        self.assertEqual(len(resp.data["skipped"]), 2)
        ok.refresh_from_db(); wrong_stage.refresh_from_db(); wrong_unit.refresh_from_db()
        self.assertEqual(ok.assigned_to, self.principal)
        self.assertIsNone(wrong_stage.assigned_to)
        self.assertIsNone(wrong_unit.assigned_to)

    def test_bulk_assign_rejects_assignee_from_another_unit(self):
        a = self._sub("A")
        resp = self._post(self.odu_manager, "assign", [a.id], assignee_id=self.hr_principal.id)
        self.assertEqual(resp.data["updated"], 0)
        a.refresh_from_db()
        self.assertIsNone(a.assigned_to)

    def test_commissioner_cannot_bulk_assign(self):
        a = self._sub("A")
        resp = self._post(self.commissioner, "assign", [a.id], assignee_id=self.principal.id)
        self.assertEqual(resp.status_code, 403)
        a.refresh_from_db()
        self.assertIsNone(a.assigned_to)

    def test_assignable_staff_lists_only_the_managers_unit(self):
        self.client.force_authenticate(user=self.odu_manager)
        resp = self.client.get("/api/submissions/assignable-staff/")
        self.assertEqual(resp.status_code, 200, resp.data)
        ids = {row["id"] for row in resp.data}
        self.assertIn(self.principal.id, ids)
        self.assertNotIn(self.hr_principal.id, ids)

    def test_commissioner_cannot_list_assignable_staff(self):
        self.client.force_authenticate(user=self.commissioner)
        self.assertEqual(self.client.get("/api/submissions/assignable-staff/").status_code, 403)

    # ── general ─────────────────────────────────────────────────────────
    def test_bulk_view_no_longer_crashes_for_allowed_roles(self):
        a = self._sub("A")
        resp = self._post(self.secretary, "export_list", [a.id])
        self.assertEqual(resp.status_code, 200, getattr(resp, "data", None))
        self.assertEqual(resp.data["count"], 1)

    def test_unknown_ids_are_reported_skipped(self):
        a = self._sub("A")
        resp = self._post(self.secretary, "mark_urgent", [a.id, 999999])
        self.assertEqual(resp.data["updated"], 1)
        self.assertEqual(resp.data["skipped"][0]["id"], 999999)

    def test_too_many_ids_rejected(self):
        resp = self._post(self.secretary, "export_list", list(range(1, 300)))
        self.assertEqual(resp.status_code, 400)

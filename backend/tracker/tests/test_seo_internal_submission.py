"""The SEO progress report is an OPSC-internal paper authored by the HR Unit.

Senior -> Principal -> Manager -> Secretary Approval Gate, with no HR checklist review,
visible to PSC staff only, and HR staff can create nothing else.
"""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import Department, Ministry, Profile, Role, Submission, WorkflowStage


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class SeoInternalSubmissionTests(TestCase):
    def setUp(self):
        self.opm = Ministry.objects.create(code="OPM", name="Ministry of the Prime Minister")
        Department.objects.create(
            ministry=self.opm, code="OPSC", name="Office of the Public Service Commission")
        self.moh = Ministry.objects.create(code="MOHX", name="Ministry of Health X")
        self.senior = self._user("seo_senior", Role.HR_UNIT_SENIOR)
        self.principal = self._user("seo_principal", Role.HR_UNIT_PRINCIPAL)
        self.manager = self._user("seo_manager", Role.HR_UNIT_MANAGER)
        self.secretary = self._user("seo_sec", Role.PSC_SECRETARY)
        self.ministry_hr = self._user("seo_mhr", Role.MINISTRY_HR, ministry=self.moh)

    def _user(self, name, role, **kw):
        u = User.objects.create_user(name, password="x")
        Profile.objects.create(user=u, role=role, **kw)
        return u

    def _client(self, user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    def _create(self, user, code="SEO-PA-REPORT", title="SEOs Q3 2026 progress report"):
        return self._client(user).post("/api/submissions/", {
            "title": title, "form_type_code": code,
            "received_at": timezone.now().isoformat(),
        }, format="json")

    def _move(self, user, sub, stage):
        return self._client(user).post(
            f"/api/submissions/{sub.id}/transition/",
            {"new_stage": stage, "remarks": "Please see my comments."}, format="json")

    def _make(self, user):
        res = self._create(user)
        self.assertEqual(res.status_code, 201, res.content)
        return Submission.objects.get(pk=res.data["id"])

    def test_each_hr_tier_can_create_it_as_an_internal_hr_paper(self):
        for user in (self.senior, self.principal, self.manager):
            sub = self._make(user) if user is self.senior else Submission.objects.get(
                pk=self._create(user, title=f"SEO report by {user.username}").data["id"])
            self.assertTrue(sub.is_internal)
            self.assertEqual(sub.routed_unit, "hr")
            self.assertEqual(sub.current_stage, WorkflowStage.DRAFT)
            self.assertEqual(sub.agenda_category, "other")

    def test_hr_staff_cannot_create_any_other_submission_type(self):
        res = self._create(self.manager, code="RECRUIT-DIRECT", title="Not theirs to create")
        self.assertEqual(res.status_code, 400, res.content)

    def test_senior_goes_to_principal_then_manager_then_secretary_gate(self):
        sub = self._make(self.senior)
        self.assertEqual(self._move(self.senior, sub, "pending_manager_approval").status_code, 403)
        self.assertEqual(self._move(self.senior, sub, "pending_principal_review").status_code, 200)
        # The Principal only sends it back; the Senior then passes it to the Manager.
        self.assertEqual(self._move(self.principal, sub, "pending_manager_approval").status_code, 403)
        self.assertEqual(self._move(self.principal, sub, "returned_for_clarification").status_code, 200)
        self.assertEqual(self._move(self.senior, sub, "pending_manager_approval").status_code, 200)
        self.assertEqual(self._move(self.senior, sub, "pending_secretary_approval").status_code, 403)
        self.assertEqual(self._move(self.manager, sub, "pending_secretary_approval").status_code, 200)
        sub.refresh_from_db()
        self.assertEqual(sub.current_stage, WorkflowStage.PENDING_SECRETARY_APPROVAL)

    def test_manager_authored_paper_goes_straight_to_the_secretary_gate(self):
        sub = self._make(self.manager)
        self.assertEqual(self._move(self.manager, sub, "pending_secretary_approval").status_code, 200)

    def test_only_the_author_may_submit_the_draft(self):
        sub = self._make(self.senior)
        other = self._user("seo_senior2", Role.HR_UNIT_SENIOR)
        self.assertIn(self._move(other, sub, "pending_principal_review").status_code, (403, 404))

    def test_ministry_staff_cannot_see_it(self):
        sub = self._make(self.manager)
        res = self._client(self.ministry_hr).get(f"/api/submissions/{sub.id}/")
        self.assertEqual(res.status_code, 404)

    def test_the_unit_sees_it_and_so_does_the_secretary_gate(self):
        sub = self._make(self.senior)
        for user in (self.senior, self.principal, self.manager):
            res = self._client(user).get(f"/api/submissions/{sub.id}/")
            self.assertEqual(res.status_code, 200, (user.username, res.content))

"""VIPAM staff climb Senior -> Principal -> Manager -> Secretary, a submitted paper that is
sent back comes back as "Returned for clarification" (never Draft), the Manager can send a
paper they authored down to the Principal for comments, and unit staff can add documents."""

import io

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    AgendaSection, Department, Ministry, Profile, PSCFormType, Role, Submission, WorkflowStage,
)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class VipamLadderTests(TestCase):
    def setUp(self):
        self.opm = Ministry.objects.create(code="OPM", name="Ministry of the Prime Minister")
        Department.objects.create(
            ministry=self.opm, code="OPSC", name="Office of the Public Service Commission")
        PSCFormType.objects.create(
            code="VIPAM-LADDER", name="A VIPAM matter", routed_unit="vipam",
            agenda_category="training", is_active=True,
        )
        # The one chain production has for VIPAM: it must no longer take over.
        AgendaSection.objects.update_or_create(
            code="training", defaults={
                "name": "Training",
                "approval_chain": [{"label": "VIPAM Manager Approval", "roles": ["vipam_manager"],
                                    "stage": "pending_manager_approval"}],
            })
        self.senior = self._user("v_senior", Role.VIPAM_SENIOR)
        self.principal = self._user("v_principal", Role.VIPAM_PRINCIPAL)
        self.manager = self._user("v_manager", Role.VIPAM_MANAGER)
        self.secretary = self._user("v_sec", Role.PSC_SECRETARY)

    def _user(self, name, role):
        u = User.objects.create_user(name, password="x")
        Profile.objects.create(user=u, role=role)
        return u

    def _client(self, user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    def _make(self, user, title="VIPAM paper"):
        res = self._client(user).post("/api/submissions/", {
            "title": title, "form_type_code": "VIPAM-LADDER",
            "received_at": timezone.now().isoformat(),
        }, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        return Submission.objects.get(pk=res.data["id"])

    def _move(self, user, sub, stage, remarks="Please see my comments."):
        return self._client(user).post(
            f"/api/submissions/{sub.id}/transition/",
            {"new_stage": stage, "remarks": remarks}, format="json")

    def _stage(self, sub):
        sub.refresh_from_db()
        return sub.current_stage

    # ── Senior / Principal / Manager ladder ─────────────────────────────────
    def test_senior_can_submit_to_principal_and_on_to_manager(self):
        sub = self._make(self.senior)
        self.assertEqual(self._move(self.senior, sub, "pending_principal_review").status_code, 200)
        self.assertEqual(self._move(self.principal, sub, "returned_for_clarification").status_code, 200)
        self.assertEqual(self._move(self.senior, sub, "pending_manager_approval").status_code, 200)
        self.assertEqual(self._move(self.manager, sub, "pending_secretary_approval").status_code, 200)
        self.assertEqual(self._stage(sub), WorkflowStage.PENDING_SECRETARY_APPROVAL)

    def test_principal_authored_paper_goes_to_manager(self):
        sub = self._make(self.principal)
        self.assertEqual(self._move(self.principal, sub, "pending_manager_approval").status_code, 200)

    def test_manager_can_send_own_paper_to_principal_before_the_secretary(self):
        sub = self._make(self.manager)
        self.assertEqual(self._move(self.manager, sub, "pending_principal_review").status_code, 200)
        self.assertEqual(self._move(self.principal, sub, "returned_for_clarification").status_code, 200)
        self.assertEqual(self._stage(sub), WorkflowStage.RETURNED_FOR_CLARIFICATION)
        # Manager may ask again, or submit to the Secretary.
        self.assertEqual(self._move(self.manager, sub, "pending_principal_review").status_code, 200)
        self.assertEqual(self._move(self.principal, sub, "returned_for_clarification").status_code, 200)
        self.assertEqual(self._move(self.manager, sub, "pending_secretary_approval").status_code, 200)

    def test_manager_authored_paper_can_go_straight_to_the_secretary(self):
        sub = self._make(self.manager)
        self.assertEqual(self._move(self.manager, sub, "pending_secretary_approval").status_code, 200)

    def test_principal_cannot_forward_to_manager_a_seniors_paper(self):
        sub = self._make(self.senior)
        self._move(self.senior, sub, "pending_principal_review")
        self.assertEqual(self._move(self.principal, sub, "pending_manager_approval").status_code, 403)

    # ── Returns are not Draft ───────────────────────────────────────────────
    def test_manager_return_lands_in_returned_for_clarification_not_draft(self):
        sub = self._make(self.principal)
        self._move(self.principal, sub, "pending_manager_approval")
        self.assertEqual(self._move(self.manager, sub, "draft").status_code, 403)
        self.assertEqual(self._move(self.manager, sub, "returned_for_clarification").status_code, 200)
        self.assertEqual(self._stage(sub), WorkflowStage.RETURNED_FOR_CLARIFICATION)
        # The Principal sees the note and can resubmit.
        ev = sub.events.filter(new_stage="returned_for_clarification").first()
        self.assertEqual(ev.remarks, "Please see my comments.")
        self.assertEqual(self._move(self.principal, sub, "pending_manager_approval").status_code, 200)

    def test_a_return_needs_a_note(self):
        sub = self._make(self.principal)
        self._move(self.principal, sub, "pending_manager_approval")
        self.assertEqual(
            self._move(self.manager, sub, "returned_for_clarification", remarks="").status_code, 400)

    # ── Visibility and uploads ──────────────────────────────────────────────
    def test_principal_sees_a_seniors_draft_and_manager_sees_everything(self):
        sub = self._make(self.senior)
        for user in (self.principal, self.manager):
            res = self._client(user).get(f"/api/submissions/{sub.id}/")
            self.assertEqual(res.status_code, 200, (user.username, res.content))

    def _upload(self, user, sub):
        f = SimpleUploadedFile("note.pdf", b"%PDF-1.4\n%%EOF\n", content_type="application/pdf")
        return self._client(user).post(
            f"/api/submissions/{sub.id}/documents/", {"files": f, "document_names": "Supporting note"},
            format="multipart")

    def test_unit_staff_can_upload_to_the_units_paper(self):
        sub = self._make(self.senior)
        for user in (self.senior, self.principal, self.manager):
            res = self._upload(user, sub)
            self.assertEqual(res.status_code, 201, (user.username, res.content))

    def test_principal_can_upload_after_it_is_returned(self):
        sub = self._make(self.principal)
        self._move(self.principal, sub, "pending_manager_approval")
        self._move(self.manager, sub, "returned_for_clarification")
        self.assertEqual(self._upload(self.principal, sub).status_code, 201)

    def test_another_units_staff_cannot_upload(self):
        outsider = self._user("hr_senior_x", Role.HR_UNIT_SENIOR)
        sub = self._make(self.senior)
        self.assertIn(self._upload(outsider, sub).status_code, (403, 404))

    def test_nobody_uploads_while_the_paper_is_with_a_reviewer(self):
        sub = self._make(self.senior)
        self._move(self.senior, sub, "pending_principal_review")
        self.assertEqual(self._upload(self.principal, sub).status_code, 403)

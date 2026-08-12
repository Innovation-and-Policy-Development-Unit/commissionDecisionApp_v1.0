"""POST /odu-board-papers/{id}/return-to-principal/ — the Manager ODU sends a
Submitted board paper back to the Principal for changes, with a required note.
Confirmed workflow, 2026-08-09: the Manager reviews the submission paper,
checklist, and assessment report, and must be able to return it for changes
or clarification rather than only silently editing it themselves."""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    BoardPaperStatus,
    Ministry,
    Notification,
    ODURestructureBoardPaper,
    Profile,
    Role,
    RoutedUnit,
    Submission,
    WorkflowStage,
)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class ReturnToPrincipalTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-BP", name="Test Ministry BP")
        self.principal = User.objects.create_user(username="odu_principal_bp", password="x")
        Profile.objects.create(user=self.principal, role=Role.ODU_PRINCIPAL)
        self.manager = User.objects.create_user(username="odu_manager_bp", password="x")
        Profile.objects.create(user=self.manager, role=Role.ODU_MANAGER)

        self.submission = Submission.objects.create(
            reference_number="SUB-BP-001",
            title="Restructure proposal",
            form_type_code="ORG-3.1",
            ministry=self.ministry,
            current_stage=WorkflowStage.UNDER_ASSESSMENT,
            routed_unit=RoutedUnit.ODU,
            assigned_to=self.principal,
            received_at=timezone.now(),
            created_by=self.principal,
        )
        self.paper = ODURestructureBoardPaper.objects.create(
            submission=self.submission,
            created_by=self.principal,
            status=BoardPaperStatus.SUBMITTED,
            submitted_for_review_at=timezone.now(),
            submitted_for_review_by=self.principal,
        )
        self.client = APIClient()

    def _return(self, user, note="Please add the costing breakdown."):
        self.client.force_authenticate(user=user)
        return self.client.post(
            f"/api/odu-board-papers/{self.paper.id}/return-to-principal/",
            {"note": note},
            format="json",
        )

    def test_manager_can_return_submitted_paper(self):
        resp = self._return(self.manager)
        self.assertEqual(resp.status_code, 200)
        self.paper.refresh_from_db()
        self.assertEqual(self.paper.status, BoardPaperStatus.DRAFT)
        self.assertEqual(self.paper.returned_by_id, self.manager.id)
        self.assertIsNotNone(self.paper.returned_at)
        self.assertEqual(self.paper.return_note, "Please add the costing breakdown.")

    def test_return_requires_a_note(self):
        resp = self._return(self.manager, note="")
        self.assertEqual(resp.status_code, 400)
        self.paper.refresh_from_db()
        self.assertEqual(self.paper.status, BoardPaperStatus.SUBMITTED)

    def test_principal_cannot_return_own_paper(self):
        resp = self._return(self.principal)
        self.assertEqual(resp.status_code, 403)
        self.paper.refresh_from_db()
        self.assertEqual(self.paper.status, BoardPaperStatus.SUBMITTED)

    def test_cannot_return_a_draft_paper(self):
        self.paper.status = BoardPaperStatus.DRAFT
        self.paper.save(update_fields=["status"])
        resp = self._return(self.manager)
        self.assertEqual(resp.status_code, 400)

    def test_cannot_return_an_approved_paper(self):
        self.paper.status = BoardPaperStatus.MANAGER_APPROVED
        self.paper.save(update_fields=["status"])
        resp = self._return(self.manager)
        self.assertEqual(resp.status_code, 400)

    def test_principal_is_notified_on_return(self):
        self._return(self.manager, note="Missing DG letter.")
        note = Notification.objects.filter(
            recipient=self.principal, submission=self.submission,
        ).order_by("-id").first()
        self.assertIsNotNone(note)
        self.assertIn("Missing DG letter.", note.body)

"""POST /submissions/{id}/submit-to-manager/ — the assigned principal hands
their completed checklist review or assessment back to their unit manager.
At Under Assessment, a PDF assessment attachment is required (the written
deliverable the manager is verifying); at Manager Checklist Review it isn't
(the checklist itself, already a submitted structured form, is)."""

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    Ministry,
    Profile,
    Role,
    RoutedUnit,
    Submission,
    SubmissionDocument,
    WorkflowStage,
)


def _pdf(name="assessment.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 fake assessment", content_type="application/pdf")


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class SubmitToManagerAssessmentAttachmentTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-STM", name="Test Ministry STM")
        self.principal = User.objects.create_user(username="odu_principal_stm", password="x")
        Profile.objects.create(user=self.principal, role=Role.ODU_PRINCIPAL)
        self.submission = Submission.objects.create(
            reference_number="SUB-STM-001",
            title="Restructure proposal",
            form_type_code="ORG-3.1",
            ministry=self.ministry,
            current_stage=WorkflowStage.UNDER_ASSESSMENT,
            routed_unit=RoutedUnit.ODU,
            assigned_to=self.principal,
            received_at=timezone.now(),
            created_by=self.principal,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.principal)

    def test_under_assessment_requires_file(self):
        resp = self.client.post(f"/api/submissions/{self.submission.id}/submit-to-manager/")
        self.assertEqual(resp.status_code, 400)
        self.submission.refresh_from_db()
        self.assertIsNone(self.submission.ready_for_manager_at)

    def test_under_assessment_rejects_non_pdf(self):
        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/submit-to-manager/",
            {"file": SimpleUploadedFile("notes.docx", b"not a pdf", content_type="application/msword")},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 400)

    def test_under_assessment_accepts_pdf(self):
        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/submit-to-manager/",
            {"file": _pdf()},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 200)
        self.submission.refresh_from_db()
        self.assertIsNotNone(self.submission.ready_for_manager_at)
        doc = SubmissionDocument.objects.get(submission=self.submission)
        self.assertIn("Assessment", doc.description)
        self.assertEqual(doc.uploaded_by, self.principal)

    def test_manager_checklist_review_does_not_require_file(self):
        self.submission.current_stage = WorkflowStage.MANAGER_CHECKLIST_REVIEW
        self.submission.save(update_fields=["current_stage"])
        resp = self.client.post(f"/api/submissions/{self.submission.id}/submit-to-manager/")
        self.assertEqual(resp.status_code, 200)
        self.submission.refresh_from_db()
        self.assertIsNotNone(self.submission.ready_for_manager_at)
        self.assertFalse(SubmissionDocument.objects.filter(submission=self.submission).exists())

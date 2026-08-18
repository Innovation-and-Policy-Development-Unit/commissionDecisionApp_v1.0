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
    PSCFormType,
    Role,
    RoutedUnit,
    Submission,
    SubmissionChecklistResponse,
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


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class SubmitToManagerChecklistGateTests(TestCase):
    """A principal/senior could previously hand a submission straight back to
    their manager at Manager Checklist Review without ever submitting the
    structured checklist form (SubmissionChecklistPanel's "Submit for
    review") — including after the manager returned it for revision and it
    was edited but never resubmitted. BUSINESS-PLAN is one of the form types
    with an actual checklist_form_type configured (unlike ORG-3.1, used
    above, which has none — see test_manager_checklist_review_does_not_require_file)."""

    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-GATE", name="Test Ministry GATE")
        self.principal = User.objects.create_user(username="odu_principal_gate", password="x")
        Profile.objects.create(user=self.principal, role=Role.ODU_PRINCIPAL)
        self.checklist_ft = PSCFormType.objects.create(
            code="TST-GATE-CHECKLIST", name="Test Gate Checklist", is_checklist=True,
        )
        PSCFormType.objects.create(
            code="TST-GATE-FORM", name="Test Gate Submission Form",
            checklist_form_type=self.checklist_ft,
        )
        self.submission = Submission.objects.create(
            reference_number="SUB-GATE-001",
            title="Annual Business Plan",
            form_type_code="TST-GATE-FORM",
            ministry=self.ministry,
            current_stage=WorkflowStage.MANAGER_CHECKLIST_REVIEW,
            routed_unit=RoutedUnit.ODU,
            assigned_to=self.principal,
            received_at=timezone.now(),
            created_by=self.principal,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.principal)

    def _post(self):
        return self.client.post(f"/api/submissions/{self.submission.id}/submit-to-manager/")

    def test_blocks_when_checklist_never_submitted(self):
        resp = self._post()
        self.assertEqual(resp.status_code, 400)
        self.submission.refresh_from_db()
        self.assertIsNone(self.submission.ready_for_manager_at)

    def test_blocks_when_checklist_still_draft(self):
        SubmissionChecklistResponse.objects.create(
            submission=self.submission,
            checklist_form_type=self.checklist_ft,
            created_by=self.principal,
            status=SubmissionChecklistResponse.Status.DRAFT,
        )
        resp = self._post()
        self.assertEqual(resp.status_code, 400)
        self.submission.refresh_from_db()
        self.assertIsNone(self.submission.ready_for_manager_at)

    def test_blocks_when_checklist_returned_and_not_resubmitted(self):
        SubmissionChecklistResponse.objects.create(
            submission=self.submission,
            checklist_form_type=self.checklist_ft,
            created_by=self.principal,
            status=SubmissionChecklistResponse.Status.RETURNED,
        )
        resp = self._post()
        self.assertEqual(resp.status_code, 400)
        self.submission.refresh_from_db()
        self.assertIsNone(self.submission.ready_for_manager_at)

    def test_allows_when_checklist_submitted(self):
        SubmissionChecklistResponse.objects.create(
            submission=self.submission,
            checklist_form_type=self.checklist_ft,
            created_by=self.principal,
            status=SubmissionChecklistResponse.Status.SUBMITTED,
        )
        resp = self._post()
        self.assertEqual(resp.status_code, 200)
        self.submission.refresh_from_db()
        self.assertIsNotNone(self.submission.ready_for_manager_at)

    def test_allows_when_checklist_already_approved(self):
        SubmissionChecklistResponse.objects.create(
            submission=self.submission,
            checklist_form_type=self.checklist_ft,
            created_by=self.principal,
            status=SubmissionChecklistResponse.Status.APPROVED,
        )
        resp = self._post()
        self.assertEqual(resp.status_code, 200)

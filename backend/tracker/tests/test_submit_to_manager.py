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
class SubmitToManagerAutoSubmitsChecklistTests(TestCase):
    """Hand-back to the unit manager is a single action, mirroring the paper
    process — the principal sends their manager the whole submission with its
    completed checklist in one motion, not the checklist separately first.
    submit_to_manager() must finalize the structured checklist itself (Draft/
    Returned -> Submitted) rather than requiring — or worse, silently
    skipping past — a separate "submit the checklist" step. BUSINESS-PLAN is
    one of the form types with an actual checklist_form_type configured
    (unlike ORG-3.1, used above, which has none — see
    test_manager_checklist_review_does_not_require_file)."""

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

    def _checklist(self):
        return SubmissionChecklistResponse.objects.get(
            submission=self.submission, checklist_form_type=self.checklist_ft,
        )

    def test_creates_and_submits_checklist_when_none_exists_yet(self):
        # The principal never opened the Checklist tab at all — there's no
        # SubmissionChecklistResponse row yet. Hand-back must still succeed
        # and leave a Submitted checklist behind for the manager to see.
        self.assertFalse(SubmissionChecklistResponse.objects.filter(submission=self.submission).exists())
        resp = self._post()
        self.assertEqual(resp.status_code, 200)
        self.submission.refresh_from_db()
        self.assertIsNotNone(self.submission.ready_for_manager_at)
        checklist = self._checklist()
        self.assertEqual(checklist.status, SubmissionChecklistResponse.Status.SUBMITTED)
        self.assertIsNotNone(checklist.submitted_at)

    def test_submits_checklist_left_in_draft(self):
        SubmissionChecklistResponse.objects.create(
            submission=self.submission,
            checklist_form_type=self.checklist_ft,
            created_by=self.principal,
            status=SubmissionChecklistResponse.Status.DRAFT,
            data={"note": "in progress"},
        )
        resp = self._post()
        self.assertEqual(resp.status_code, 200)
        checklist = self._checklist()
        self.assertEqual(checklist.status, SubmissionChecklistResponse.Status.SUBMITTED)
        self.assertEqual(checklist.data, {"note": "in progress"})

    def test_resubmits_checklist_that_was_returned_for_revision(self):
        SubmissionChecklistResponse.objects.create(
            submission=self.submission,
            checklist_form_type=self.checklist_ft,
            created_by=self.principal,
            status=SubmissionChecklistResponse.Status.RETURNED,
            manager_comments="Please double-check section B.",
        )
        resp = self._post()
        self.assertEqual(resp.status_code, 200)
        checklist = self._checklist()
        self.assertEqual(checklist.status, SubmissionChecklistResponse.Status.SUBMITTED)

    def test_leaves_already_approved_checklist_untouched(self):
        SubmissionChecklistResponse.objects.create(
            submission=self.submission,
            checklist_form_type=self.checklist_ft,
            created_by=self.principal,
            status=SubmissionChecklistResponse.Status.APPROVED,
        )
        resp = self._post()
        self.assertEqual(resp.status_code, 200)
        checklist = self._checklist()
        self.assertEqual(checklist.status, SubmissionChecklistResponse.Status.APPROVED)

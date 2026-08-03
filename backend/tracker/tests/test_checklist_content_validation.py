"""Tests for non-AI content validation on the Required Documents checklist.

Covers apply_content_mismatch_check() (submission_checklist.py) — the local,
keyword/OCR-based check that un-ticks and flags a checklist item when an
uploaded file's classified type doesn't match what the slot expects.
"""

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    DocumentClassificationType,
    Ministry,
    Profile,
    RequiredDocument,
    Role,
    Submission,
    SubmissionChecklistItem,
    SubmissionDocument,
    WorkflowStage,
)
from ..submission_checklist import apply_content_mismatch_check


def _pdf(name="upload.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 test content", content_type="application/pdf")


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class ContentMismatchCheckTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-C", name="Test Ministry C")
        self.hr = User.objects.create_user("hruser_cmc1", password="x")
        self.submission = Submission.objects.create(
            reference_number="SUB-CMC-001",
            title="Redundancy proposal",
            form_type_code="CESSATION-REDUNDANCY",
            ministry=self.ministry,
            current_stage=WorkflowStage.UNDER_ASSESSMENT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        self.required_doc = RequiredDocument.objects.create(
            name="Letter from DG / Ministry",
            description="Letter from Director-General requesting redundancy.",
            expected_document_type=DocumentClassificationType.DG_ENDORSEMENT,
        )
        self.item = SubmissionChecklistItem.objects.create(
            submission=self.submission,
            document=self.required_doc,
            is_present=True,
        )

    def _doc(self, document_type, confidence):
        doc = SubmissionDocument.objects.create(
            submission=self.submission,
            required_document=self.required_doc,
            file=_pdf(),
            original_name="upload.pdf",
        )
        doc.document_type = document_type
        doc.document_type_confidence = confidence
        doc.save(update_fields=["document_type", "document_type_confidence"])
        return doc

    def test_matching_type_keeps_item_ticked(self):
        doc = self._doc(DocumentClassificationType.DG_ENDORSEMENT, 74)
        apply_content_mismatch_check(doc)
        self.item.refresh_from_db()
        self.assertTrue(self.item.is_present)
        self.assertFalse(self.item.content_mismatch)

    def test_confident_mismatch_unticks_and_flags(self):
        doc = self._doc(DocumentClassificationType.MEDICAL_CERTIFICATE, 78)
        apply_content_mismatch_check(doc)
        self.item.refresh_from_db()
        self.assertFalse(self.item.is_present)
        self.assertTrue(self.item.content_mismatch)
        self.assertIn("Medical certificate", self.item.notes)
        self.assertIn("DG / HoA endorsement", self.item.notes)

    def test_unclassified_result_is_left_alone(self):
        doc = self._doc(DocumentClassificationType.UNCLASSIFIED, 30)
        apply_content_mismatch_check(doc)
        self.item.refresh_from_db()
        self.assertTrue(self.item.is_present)
        self.assertFalse(self.item.content_mismatch)

    def test_low_confidence_mismatch_is_left_alone(self):
        doc = self._doc(DocumentClassificationType.MEDICAL_CERTIFICATE, 40)
        apply_content_mismatch_check(doc)
        self.item.refresh_from_db()
        self.assertTrue(self.item.is_present)
        self.assertFalse(self.item.content_mismatch)

    def test_no_expected_type_configured_is_a_no_op(self):
        self.required_doc.expected_document_type = ""
        self.required_doc.save(update_fields=["expected_document_type"])
        doc = self._doc(DocumentClassificationType.MEDICAL_CERTIFICATE, 90)
        apply_content_mismatch_check(doc)
        self.item.refresh_from_db()
        self.assertTrue(self.item.is_present)
        self.assertFalse(self.item.content_mismatch)

    def test_manual_officer_notes_are_not_clobbered(self):
        self.item.notes = "Officer note: confirmed by phone with DG's office."
        self.item.save(update_fields=["notes"])
        doc = self._doc(DocumentClassificationType.MEDICAL_CERTIFICATE, 78)
        apply_content_mismatch_check(doc)
        self.item.refresh_from_db()
        self.assertTrue(self.item.is_present)
        self.assertFalse(self.item.content_mismatch)
        self.assertEqual(self.item.notes, "Officer note: confirmed by phone with DG's office.")


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class ManualToggleClearsMismatchTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="TST-D", name="Test Ministry D")
        self.admin = User.objects.create_user("pscadmin_cmc", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)

        self.hr = User.objects.create_user("hruser_cmc2", password="x")
        self.submission = Submission.objects.create(
            reference_number="SUB-CMC-002",
            title="Redundancy proposal",
            form_type_code="CESSATION-REDUNDANCY",
            ministry=self.ministry,
            current_stage=WorkflowStage.UNDER_ASSESSMENT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        self.required_doc = RequiredDocument.objects.create(
            name="Letter from DG / Ministry",
            expected_document_type=DocumentClassificationType.DG_ENDORSEMENT,
        )
        self.item = SubmissionChecklistItem.objects.create(
            submission=self.submission,
            document=self.required_doc,
            is_present=False,
            content_mismatch=True,
            notes="[Content check] Attached file looks like 'Medical certificate', "
                  "not 'DG / HoA endorsement' — please check the upload.",
        )

    def test_manual_toggle_clears_content_mismatch(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(
            f"/api/submissions/{self.submission.id}/checklist/{self.item.id}/",
            {"is_present": True, "notes": "Confirmed correct — re-uploaded."},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.item.refresh_from_db()
        self.assertTrue(self.item.is_present)
        self.assertFalse(self.item.content_mismatch)
        self.assertEqual(self.item.notes, "Confirmed correct — re-uploaded.")

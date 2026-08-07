"""Regression tests: file-type detection (OCR eligibility, download content-type/
disposition) must key off the real stored file, not the user-editable display
title (SubmissionDocument.original_name / the "document name" upload field),
which is not guaranteed to carry a file extension — e.g. a ministry HR user
attaching a required document can type "DG Endorsement Letter" as its label."""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..ai.document_extraction import _is_extractable
from ..models import (
    DocumentOcrStatus,
    FormCategory,
    Ministry,
    Profile,
    Role,
    Submission,
    SubmissionDocument,
    WorkflowStage,
)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DocumentTypeDetectionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="TST-DT", name="Test Ministry DT")
        self.form_cat = FormCategory.objects.get_or_create(
            code="psc_3_6", defaults={"name": "PSC 3.6"}
        )[0]
        self.hr = User.objects.create_user("hruser_dt", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.submission = Submission.objects.create(
            title="Test paper",
            form_category=self.form_cat,
            form_type_code="PSC 3.6",
            ministry=self.ministry,
            received_at=timezone.now(),
            created_by=self.hr,
            current_stage=WorkflowStage.DRAFT,
        )
        self.client.force_authenticate(user=self.hr)

    def _upload_with_extensionless_label(self):
        # The uploaded file itself is a real .pdf; document_names supplies a
        # human label with no extension, exactly like the "Document name"
        # field in the internal-submission attachment UI.
        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/documents/",
            {
                "files": SimpleUploadedFile(
                    "01_official_letter.pdf", b"%PDF-1.4 fake content", content_type="application/pdf"
                ),
                "document_names": "DG Endorsement Letter",
            },
            format="multipart",
        )
        assert resp.status_code == 201, resp.content
        doc = SubmissionDocument.objects.get(pk=resp.json()["id"])
        self.assertEqual(doc.original_name, "DG Endorsement Letter")
        self.assertTrue(doc.file.name.lower().endswith(".pdf"))
        return doc

    def test_is_extractable_keys_off_real_extension_not_label(self):
        self.assertTrue(_is_extractable("01_official_letter.pdf"))
        self.assertFalse(_is_extractable("DG Endorsement Letter"))

    def test_extraction_uses_real_stored_filename_not_display_label(self):
        doc = self._upload_with_extensionless_label()

        with patch(
            "tracker.ai.document_extraction.local_ocr_text",
            return_value="Dear Director General, this is a fake endorsement letter body.",
        ):
            from ..tasks import extract_document_facts

            extract_document_facts(doc.id)

        doc.refresh_from_db()
        self.assertEqual(doc.ocr_status, DocumentOcrStatus.COMPLETED)
        self.assertEqual(doc.ocr_error, "")
        self.assertIn("endorsement letter", doc.extracted_text)

    def test_download_detects_pdf_from_real_file_not_label(self):
        doc = self._upload_with_extensionless_label()

        resp = self.client.get(f"/api/submissions/{self.submission.id}/documents/{doc.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "application/pdf")
        self.assertTrue(resp["Content-Disposition"].startswith("inline"))
        self.assertIn('.pdf"', resp["Content-Disposition"])

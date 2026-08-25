"""Real content-type validation on file uploads (P1-06, SCDMS Pre-Production
Readiness Audit — Findings Register): every upload endpoint either did no
type check at all, or trusted the client-supplied Content-Type header /
filename extension — both fully controlled by whoever is uploading, and
trivially spoofed. `file_validation.py` sniffs the actual bytes instead.

These tests cover the shared validation module directly, plus a
representative sample of the endpoints it was wired into, confirming a file
whose real content doesn't match what it claims to be is now rejected,
while a genuine file of the right type still succeeds.
"""

import base64

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..file_validation import FileValidationError, sniff_mime_type, validate_upload
from ..models import (
    FormCategory, Ministry, Profile, Role, Submission, WorkflowStage,
)

REAL_PDF = b"%PDF-1.4\n%fake but real PDF header bytes for magic to sniff\n"
FAKE_PDF_ACTUALLY_HTML = b"<html><body><script>alert(1)</script></body></html>"
# A genuine, complete 1x1-pixel PNG — libmagic needs real chunk structure
# (IHDR etc.), not just the 8-byte signature, to confidently identify PNG.
REAL_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAAAXNSR0IB2cksfwAAAAtJREFU"
    "CB1jYPjPAAABggUJH0IsuAAAAABJRU5ErkJggg=="
)


class FileValidationUnitTests(TestCase):
    def test_sniff_detects_real_pdf_regardless_of_claimed_content_type(self):
        f = SimpleUploadedFile("x.pdf", REAL_PDF, content_type="application/pdf")
        self.assertEqual(sniff_mime_type(f), "application/pdf")

    def test_sniff_detects_html_even_when_named_and_typed_as_pdf(self):
        """The exact spoofing this fix exists to catch."""
        f = SimpleUploadedFile("x.pdf", FAKE_PDF_ACTUALLY_HTML, content_type="application/pdf")
        mime = sniff_mime_type(f)
        self.assertNotEqual(mime, "application/pdf")

    def test_validate_upload_accepts_matching_kind(self):
        f = SimpleUploadedFile("x.pdf", REAL_PDF, content_type="application/pdf")
        mime = validate_upload(f, kind="pdf")
        self.assertEqual(mime, "application/pdf")

    def test_validate_upload_rejects_spoofed_kind(self):
        f = SimpleUploadedFile("x.pdf", FAKE_PDF_ACTUALLY_HTML, content_type="application/pdf")
        with self.assertRaises(FileValidationError):
            validate_upload(f, kind="pdf")

    def test_validate_upload_leaves_file_readable_afterward(self):
        """Sniffing reads the first few KB — callers must still be able to
        read/save the full file afterward."""
        f = SimpleUploadedFile("x.pdf", REAL_PDF, content_type="application/pdf")
        validate_upload(f, kind="pdf")
        self.assertEqual(f.read(), REAL_PDF)

    def test_document_kind_accepts_pdf_and_common_images(self):
        pdf = SimpleUploadedFile("x.pdf", REAL_PDF, content_type="application/pdf")
        png = SimpleUploadedFile("x.png", REAL_PNG, content_type="image/png")
        validate_upload(pdf, kind="document")
        validate_upload(png, kind="document")

    def test_unknown_kind_raises_programmer_error(self):
        f = SimpleUploadedFile("x.pdf", REAL_PDF)
        with self.assertRaises(ValueError):
            validate_upload(f, kind="not_a_real_kind")


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class UploadEndpointValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="TST-P106", name="Test Ministry P1-06")
        self.form_cat = FormCategory.objects.get_or_create(
            code="psc_3_6", defaults={"name": "PSC 3.6"}
        )[0]
        self.hr = User.objects.create_user("hr_p106", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)

    def _submission(self, stage, **extra):
        return Submission.objects.create(
            title="Test paper", form_category=self.form_cat, form_type_code="PSC 3.6",
            ministry=self.ministry, received_at=timezone.now(), created_by=self.hr,
            current_stage=stage, **extra,
        )

    # ── General document upload — the exact bypass the audit cited:
    #    extension-string check only ────────────────────────────────────────

    def test_document_upload_rejects_html_disguised_as_pdf(self):
        sub = self._submission(WorkflowStage.DRAFT)
        self.client.force_authenticate(user=self.hr)
        fake = SimpleUploadedFile("evidence.pdf", FAKE_PDF_ACTUALLY_HTML, content_type="application/pdf")
        resp = self.client.post(
            f"/api/submissions/{sub.id}/documents/", {"file": fake}, format="multipart",
        )
        self.assertEqual(resp.status_code, 400)

    def test_document_upload_accepts_a_real_pdf(self):
        sub = self._submission(WorkflowStage.DRAFT)
        self.client.force_authenticate(user=self.hr)
        real = SimpleUploadedFile("evidence.pdf", REAL_PDF, content_type="application/pdf")
        resp = self.client.post(
            f"/api/submissions/{sub.id}/documents/", {"file": real}, format="multipart",
        )
        self.assertEqual(resp.status_code, 201, resp.content)

    # ── Remarks image upload (previously trusted the Content-Type header) ──

    def test_remarks_image_rejects_html_disguised_as_png(self):
        sub = self._submission(WorkflowStage.DRAFT)
        self.client.force_authenticate(user=self.hr)
        fake = SimpleUploadedFile("x.png", FAKE_PDF_ACTUALLY_HTML, content_type="image/png")
        resp = self.client.post(
            f"/api/submissions/{sub.id}/remarks-images/", {"file": fake}, format="multipart",
        )
        self.assertEqual(resp.status_code, 400)

    def test_remarks_image_accepts_a_real_png(self):
        sub = self._submission(WorkflowStage.DRAFT)
        self.client.force_authenticate(user=self.hr)
        real = SimpleUploadedFile("x.png", REAL_PNG, content_type="image/png")
        resp = self.client.post(
            f"/api/submissions/{sub.id}/remarks-images/", {"file": real}, format="multipart",
        )
        self.assertEqual(resp.status_code, 201, resp.content)

    # ── Meeting recording — the other extension-only bypass the audit cited ─

    def test_meeting_recording_rejects_html_disguised_as_mp3(self):
        admin = User.objects.create_user("admin_p106", password="x")
        Profile.objects.create(user=admin, role=Role.PSC_ADMIN)
        self.client.force_authenticate(user=admin)
        fake = SimpleUploadedFile("recording.mp3", FAKE_PDF_ACTUALLY_HTML, content_type="audio/mpeg")
        resp = self.client.post("/api/meetings/upload/", {"file": fake}, format="multipart")
        self.assertEqual(resp.status_code, 400)

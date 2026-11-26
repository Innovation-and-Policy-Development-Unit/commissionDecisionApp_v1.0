from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from tracker.models import FeedbackComment, FeedbackReport


class FeedbackNoteApiTests(TestCase):
    """The feedback detail panel posts internal notes with `body` (not `text`)."""

    def setUp(self):
        self.admin = get_user_model().objects.create_superuser("fb-admin", "fb@example.com", "pw-Test-12345")
        self.report = FeedbackReport.objects.create(title="Add departments", description="Please add", created_by=self.admin)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_note_with_body_is_saved_as_internal(self):
        r = self.client.post("/api/feedback-comments/", {"report": self.report.id, "body": "Added", "is_internal": True}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["body"], "Added")
        self.assertTrue(FeedbackComment.objects.get(pk=r.data["id"]).is_internal)

    def test_note_with_text_key_is_rejected(self):
        r = self.client.post("/api/feedback-comments/", {"report": self.report.id, "text": "Added"}, format="json")
        self.assertEqual(r.status_code, 400)


import struct
import tempfile
import zlib

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

def _make_png():
    """A valid 1x1 PNG built from scratch (no Pillow needed in the test)."""
    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    raw = b"\x00\xff\x00\x00"
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


_PNG = _make_png()


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class FeedbackNoteImageTests(TestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_superuser("fb-admin2", "fb2@example.com", "pw-Test-12345")
        self.report = FeedbackReport.objects.create(title="T", description="D", created_by=self.admin)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def _post(self, **fields):
        return self.client.post("/api/feedback-comments/", {"report": self.report.id, **fields}, format="multipart")

    def test_pasted_image_without_text_is_saved(self):
        img = SimpleUploadedFile("pasted.png", _PNG, content_type="image/png")
        r = self._post(image=img, is_internal="true")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(r.data["image"])
        self.assertEqual(r.data["body"], "")

    def test_non_image_is_rejected(self):
        bad = SimpleUploadedFile("x.png", b"<html>not an image</html>", content_type="image/png")
        r = self._post(body="hi", image=bad)
        self.assertEqual(r.status_code, 400)

    def test_empty_note_is_rejected(self):
        self.assertEqual(self._post(body="  ").status_code, 400)

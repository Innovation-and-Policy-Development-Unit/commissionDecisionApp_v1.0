"""Chat attachments: real file type, thumbnails, downloads, and emoji reactions."""

import io

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from ..models import Conversation, ConversationParticipant, MessageAttachment, MessageReaction, Profile, Role

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def _png(size=(1200, 900)):
    buf = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buf, "PNG")
    return buf.getvalue()


def _user(name):
    u = User.objects.create_user(name, password="x")
    Profile.objects.create(user=u, role=Role.PSC_ADMIN)
    return u


def _client(u):
    c = APIClient()
    c.force_authenticate(user=u)
    return c


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class ChatAttachmentTests(TestCase):
    def setUp(self):
        self.a, self.b, self.outsider = _user("ch_a"), _user("ch_b"), _user("ch_out")
        self.conv = Conversation.objects.create(created_by=self.a)
        for u in (self.a, self.b):
            ConversationParticipant.objects.create(conversation=self.conv, user=u)
        self.url = f"/api/chat/conversations/{self.conv.id}/messages/"

    def _send(self, files, user=None):
        return _client(user or self.a).post(self.url, {"body": "see", "files": files}, format="multipart")

    def test_a_pasted_screenshot_is_stored_as_the_real_image_type_whatever_the_browser_said(self):
        res = self._send([SimpleUploadedFile("screenshot.png", _png(), "application/octet-stream")])
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(MessageAttachment.objects.get().content_type, "image/png")

    def test_a_disguised_file_is_refused(self):
        res = self._send([SimpleUploadedFile("evil.png", b"MZ\x90\x00 not an image", "image/png")])
        self.assertEqual(res.status_code, 400)

    def test_several_images_in_one_message(self):
        res = self._send([SimpleUploadedFile(f"s{i}.png", _png((300, 200)), "image/png") for i in range(3)])
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(len(res.data["attachments"]), 3)

    def test_the_thumbnail_is_a_small_jpeg_and_the_original_is_untouched(self):
        self._send([SimpleUploadedFile("big.png", _png(), "image/png")])
        att = MessageAttachment.objects.get()
        thumb = _client(self.b).get(f"/api/chat/attachments/{att.id}/?thumb=1")
        self.assertEqual(thumb.status_code, 200)
        self.assertEqual(thumb["Content-Type"], "image/jpeg")
        img = Image.open(io.BytesIO(b"".join(thumb.streaming_content)))
        self.assertLessEqual(max(img.size), 480)
        full = _client(self.b).get(f"/api/chat/attachments/{att.id}/")
        self.assertEqual(Image.open(io.BytesIO(b"".join(full.streaming_content))).size, (1200, 900))
        again = _client(self.b).get(f"/api/chat/attachments/{att.id}/?thumb=1")  # served from the kept copy
        self.assertEqual(again.status_code, 200)

    def test_a_pdf_has_no_thumbnail_and_downloads_as_a_file(self):
        self._send([SimpleUploadedFile("note.pdf", PDF, "application/pdf")])
        att = MessageAttachment.objects.get()
        res = _client(self.b).get(f"/api/chat/attachments/{att.id}/?thumb=1&download=1")
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertIn("attachment", res["Content-Disposition"])

    def test_someone_outside_the_conversation_cannot_open_a_file_or_thumbnail(self):
        self._send([SimpleUploadedFile("big.png", _png(), "image/png")])
        att = MessageAttachment.objects.get()
        for suffix in ("", "?thumb=1"):
            self.assertEqual(_client(self.outsider).get(f"/api/chat/attachments/{att.id}/{suffix}").status_code, 403)

    def _react(self, message_id, emoji, user=None):
        return _client(user or self.b).post(f"{self.url}{message_id}/react/", {"emoji": emoji}, format="json")

    def test_reactions_accept_any_emoji_and_refuse_text(self):
        mid = self._send([SimpleUploadedFile("n.pdf", PDF, "application/pdf")]).data["id"]
        for ok in ("🎉", "🔥", "👍🏽", "❤️"):
            self.assertEqual(self._react(mid, ok).status_code, 200, ok)
        for bad in ("lol", "a", "x" * 20, "👍 👍", "1"):
            self.assertEqual(self._react(mid, bad).status_code, 400, bad)
        self.assertEqual(MessageReaction.objects.filter(message_id=mid).count(), 1)  # one per user

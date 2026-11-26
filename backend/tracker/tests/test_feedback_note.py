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

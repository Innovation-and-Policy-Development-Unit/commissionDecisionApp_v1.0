"""Submission presence heartbeat API."""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import Profile, Role, Submission, SubmissionPresence


class SubmissionPresenceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.submission = Submission.objects.create(
            title="Shared matter",
            received_at=timezone.now(),
        )
        self.user_a = User.objects.create_user(username="officer_a", password="pass")
        self.user_b = User.objects.create_user(username="officer_b", password="pass")
        Profile.objects.create(user=self.user_a, role=Role.PSC_OFFICER)
        Profile.objects.create(user=self.user_b, role=Role.PSC_OFFICER)

    def test_heartbeat_lists_other_viewers(self):
        self.client.force_authenticate(user=self.user_a)
        self.client.post(f"/api/submissions/{self.submission.id}/presence/heartbeat/")

        self.client.force_authenticate(user=self.user_b)
        res = self.client.post(f"/api/submissions/{self.submission.id}/presence/heartbeat/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["other_count"], 1)
        self.assertEqual(res.data["others"][0]["username"], "officer_a")

    def test_leave_clears_presence(self):
        SubmissionPresence.objects.create(
            submission=self.submission,
            user=self.user_a,
        )
        self.client.force_authenticate(user=self.user_a)
        self.client.post(f"/api/submissions/{self.submission.id}/presence/leave/")
        self.assertFalse(
            SubmissionPresence.objects.filter(
                submission=self.submission,
                user=self.user_a,
            ).exists()
        )

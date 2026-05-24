"""Sitting Pack session API tests."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from tracker.models import Meeting, Profile, Role, SittingPackSession


class SittingPackSessionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.meeting = Meeting.objects.create(
            title="Test Sitting",
            date="2026-06-01",
            time="09:00",
            venue="Boardroom",
        )
        self.user = User.objects.create_user(username="commissioner1", password="pass")
        Profile.objects.create(user=self.user, role=Role.PSC_COMMISSIONER)
        self.client.force_authenticate(user=self.user)

    def test_start_and_end_session(self):
        start = self.client.post(f"/api/meetings/{self.meeting.id}/sitting-pack/start/")
        self.assertEqual(start.status_code, 201)
        self.assertTrue(start.data["active"])
        self.assertIn("seal_code", start.data)

        status = self.client.get(f"/api/meetings/{self.meeting.id}/sitting-pack/status/")
        self.assertEqual(status.status_code, 200)
        self.assertTrue(status.data["active"])

        end = self.client.post(f"/api/meetings/{self.meeting.id}/sitting-pack/end/")
        self.assertEqual(end.status_code, 200)
        self.assertFalse(end.data["active"])

        self.assertEqual(
            SittingPackSession.objects.filter(meeting=self.meeting, user=self.user).count(),
            1,
        )
        session = SittingPackSession.objects.get(meeting=self.meeting, user=self.user)
        self.assertIsNotNone(session.ended_at)

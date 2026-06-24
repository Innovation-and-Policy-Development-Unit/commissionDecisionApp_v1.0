"""Tests for the new-meeting HR notification and recipient resolution."""

from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone

from ..email_notify import hr_managers, notify_meeting_scheduled
from ..models import Meeting, MeetingType, Notification, Profile, Role


def _user(username, role, *, email="", active=True):
    u = User.objects.create_user(username, email=email, password="x", is_active=active)
    Profile.objects.create(user=u, role=role)
    return u


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class HrManagersTests(TestCase):
    def test_resolves_both_hr_roles_active_with_email(self):
        unit = _user("mtg_unit", Role.HR_UNIT_MANAGER, email="unit@gov.vu")
        ministry = _user("mtg_min", Role.MINISTRY_HR, email="min@gov.vu")
        _user("mtg_noemail", Role.HR_UNIT_MANAGER, email="")            # excluded (no email)
        _user("mtg_inactive", Role.MINISTRY_HR, email="x@gov.vu", active=False)  # excluded
        _user("mtg_officer", Role.PSC_OFFICER, email="off@gov.vu")      # excluded (role)

        ids = {u.id for u in hr_managers()}
        self.assertEqual(ids, {unit.id, ministry.id})


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class NotifyMeetingScheduledTests(TestCase):
    def _meeting(self, mtype=MeetingType.ORDINARY):
        return Meeting.objects.create(
            title="Ordinary Commission Sitting",
            date=timezone.localdate() + timedelta(days=10),
            time="09:00", venue="PSC Boardroom", type=mtype,
        )

    def test_creates_inapp_notification_per_hr_manager(self):
        a = _user("mtg_unit", Role.HR_UNIT_MANAGER, email="unit@gov.vu")
        b = _user("mtg_min", Role.MINISTRY_HR, email="min@gov.vu")
        meeting = self._meeting()

        notify_meeting_scheduled(meeting)

        self.assertEqual(Notification.objects.filter(recipient=a).count(), 1)
        self.assertEqual(Notification.objects.filter(recipient=b).count(), 1)
        note = Notification.objects.filter(recipient=a).first()
        self.assertIn("New sitting scheduled", note.title)

    def test_noop_when_no_hr_managers(self):
        meeting = self._meeting()
        notify_meeting_scheduled(meeting)  # must not raise
        self.assertEqual(Notification.objects.count(), 0)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class MeetingCreateDispatchTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient

        self.client = APIClient()
        self.secretary = _user("mtg_sec", Role.PSC_SECRETARY, email="sec@gov.vu")
        self.client.force_authenticate(user=self.secretary)

    def _payload(self, mtype="ordinary"):
        return {
            "title": "Ordinary Commission Sitting",
            "date": str(date.today() + timedelta(days=14)),
            "time": "09:00",
            "venue": "PSC Boardroom",
            "type": mtype,
        }

    @patch("tracker.tasks.notify_meeting_scheduled_task.delay")
    def test_create_enqueues_hr_notification(self, mock_delay):
        resp = self.client.post("/api/meetings/", self._payload(), format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        mock_delay.assert_called_once_with(resp.json()["id"])

    @patch("tracker.tasks.notify_meeting_scheduled_task.delay")
    def test_flying_minute_does_not_notify(self, mock_delay):
        resp = self.client.post("/api/meetings/", self._payload("flying_minute"), format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        mock_delay.assert_not_called()

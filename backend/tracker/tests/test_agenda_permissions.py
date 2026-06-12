"""Write-access gates on meetings and agenda items.

Only the PSC Secretary, Senior Admin Officer, or Admin may mutate meetings or
agenda items. OPSC unit/post-decision staff (and ministry users) are read-only —
previously update/destroy were unguarded ModelViewSet defaults.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import (
    AgendaItem, Meeting, Ministry, Profile, Role, Submission, WorkflowStage,
)


class AgendaWriteGateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="ZZ_AG", name="Agenda Ministry")

        self.secretary = User.objects.create_user(username="ag_secretary", password="pass")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)
        self.manager = User.objects.create_user(username="ag_manager", password="pass")
        Profile.objects.create(user=self.manager, role=Role.PSC_MANAGER)

        self.meeting = Meeting.objects.create(
            title="Gate Sitting", date="2026-07-01", time="09:00", venue="Boardroom",
        )
        self.submission = Submission.objects.create(
            title="Gate matter",
            received_at=timezone.now(),
            created_by=self.secretary,
            ministry=self.ministry,
            current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
        )
        self.item = AgendaItem.objects.create(
            meeting=self.meeting, submission=self.submission,
            category="other", sequence=1,
        )

    def test_manager_cannot_mutate_agenda_items(self):
        self.client.force_authenticate(user=self.manager)
        res = self.client.patch(
            f"/api/agenda-items/{self.item.id}/", {"sequence": 5}, format="json",
        )
        self.assertEqual(res.status_code, 403)
        res = self.client.delete(f"/api/agenda-items/{self.item.id}/")
        self.assertEqual(res.status_code, 403)
        self.assertTrue(AgendaItem.objects.filter(id=self.item.id).exists())

    def test_manager_cannot_mutate_meetings(self):
        self.client.force_authenticate(user=self.manager)
        res = self.client.patch(
            f"/api/meetings/{self.meeting.id}/", {"venue": "Hacked"}, format="json",
        )
        self.assertEqual(res.status_code, 403)
        res = self.client.delete(f"/api/meetings/{self.meeting.id}/")
        self.assertEqual(res.status_code, 403)

    def test_secretary_can_mutate_agenda_items_and_meetings(self):
        self.client.force_authenticate(user=self.secretary)
        res = self.client.patch(
            f"/api/agenda-items/{self.item.id}/", {"sequence": 2}, format="json",
        )
        self.assertEqual(res.status_code, 200)
        res = self.client.patch(
            f"/api/meetings/{self.meeting.id}/", {"venue": "Conference Room"}, format="json",
        )
        self.assertEqual(res.status_code, 200)

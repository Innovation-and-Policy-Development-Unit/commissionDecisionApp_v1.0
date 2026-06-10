"""Tests for the carry-over list (late submissions) + Chairman admission."""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.agenda_carryover import compute_scheduled_meeting, is_carryover, reconcile_carryover
from tracker.models import (
    AgendaItem, Meeting, Ministry, Profile, Role, Submission, WorkflowStage,
)


class CarryoverLogicTests(TestCase):
    def setUp(self):
        Submission.objects.all().delete()
        Meeting.objects.all().delete()
        self.user = User.objects.create_user("co_user", password="x")
        Profile.objects.create(user=self.user, role=Role.PSC_ADMIN)
        self.ministry = Ministry.objects.create(code="CO", name="CO Ministry")
        today = timezone.now().date()
        self.m1 = Meeting.objects.create(title="M1", date=today + timedelta(days=2), time="09:00", venue="H",
                                         submission_cutoff=timezone.now() - timedelta(days=1))  # cutoff passed
        self.m2 = Meeting.objects.create(title="M2", date=today + timedelta(days=20), time="09:00", venue="H",
                                         submission_cutoff=timezone.now() + timedelta(days=15))

    def _sub(self):
        return Submission.objects.create(title="late", ministry=self.ministry, received_at=timezone.now(),
                                         created_by=self.user, current_stage=WorkflowStage.FORWARDED_TO_COMMISSION)

    def test_compute_rolls_past_cutoff_to_next(self):
        self.assertEqual(compute_scheduled_meeting(self._sub()), self.m2)

    def test_is_carryover_for_late(self):
        s = self._sub()
        self.assertTrue(is_carryover(s, self.m1))    # received after m1 cutoff (passed)
        self.assertFalse(is_carryover(s, self.m2))   # m2 cutoff still in future

    def test_reconcile_moves_leftover_to_next(self):
        s = self._sub()
        Submission.objects.filter(pk=s.pk).update(scheduled_meeting=self.m1)
        reconcile_carryover(self.m1)
        s.refresh_from_db()
        self.assertEqual(s.scheduled_meeting_id, self.m2.id)


class AdmitReserveAPITests(TestCase):
    def setUp(self):
        Submission.objects.all().delete()
        Meeting.objects.all().delete()
        self.client = APIClient()
        self.admin = User.objects.create_user("ar_admin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.chair = User.objects.create_user("ar_chair", password="x")
        Profile.objects.create(user=self.chair, role=Role.CHAIRPERSON)
        self.sec = User.objects.create_user("ar_sec", password="x")
        Profile.objects.create(user=self.sec, role=Role.PSC_SECRETARY)
        self.ministry = Ministry.objects.create(code="AR", name="AR Ministry")
        self.meeting = Meeting.objects.create(
            title="MTG", date=timezone.now().date() + timedelta(days=2), time="09:00", venue="H",
            submission_cutoff=timezone.now() - timedelta(days=1), agenda_status="with_chairman",
        )
        self.late = Submission.objects.create(
            title="late sub", ministry=self.ministry, received_at=timezone.now(),
            created_by=self.admin, current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
        )

    def _admit(self):
        return self.client.post(f"/api/meetings/{self.meeting.id}/admit-reserve/",
                                {"submission": self.late.id}, format="json")

    def test_chairman_admits_late_item(self):
        self.client.force_authenticate(self.chair)
        r = self._admit()
        self.assertEqual(r.status_code, 200)
        self.assertTrue(AgendaItem.objects.filter(meeting=self.meeting, submission=self.late).exists())
        self.late.refresh_from_db()
        self.assertEqual(self.late.scheduled_meeting_id, self.meeting.id)

    def test_non_chairman_blocked(self):
        self.client.force_authenticate(self.sec)
        self.assertEqual(self._admit().status_code, 403)

    def test_only_during_endorsement(self):
        self.meeting.agenda_status = "draft"
        self.meeting.save(update_fields=["agenda_status"])
        self.client.force_authenticate(self.chair)
        self.assertEqual(self._admit().status_code, 400)


class WorkspaceCarryoverSplitTests(TestCase):
    def test_workspace_splits_backlog_and_carryover(self):
        Submission.objects.all().delete()
        Meeting.objects.all().delete()
        admin = User.objects.create_user("ws_admin", password="x")
        Profile.objects.create(user=admin, role=Role.PSC_ADMIN)
        ministry = Ministry.objects.create(code="WS", name="WS Ministry")
        meeting = Meeting.objects.create(title="MTG", date=timezone.now().date() + timedelta(days=2), time="09:00",
                                         venue="H", submission_cutoff=timezone.now() - timedelta(days=2))
        # on-time: received before cutoff; late: received after cutoff
        on_time = Submission.objects.create(title="ontime", ministry=ministry, created_by=admin,
                                            received_at=timezone.now() - timedelta(days=3),
                                            current_stage=WorkflowStage.FORWARDED_TO_COMMISSION)
        late = Submission.objects.create(title="late", ministry=ministry, created_by=admin,
                                         received_at=timezone.now(),
                                         current_stage=WorkflowStage.FORWARDED_TO_COMMISSION)
        client = APIClient()
        client.force_authenticate(admin)
        data = client.get(f"/api/meetings/{meeting.id}/workspace/").data
        self.assertIn(on_time.id, {b["submission_id"] for b in data["backlog"]})
        self.assertIn(late.id, {c["submission_id"] for c in data["carryover"]})

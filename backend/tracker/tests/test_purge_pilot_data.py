"""purge_pilot_data removes submissions/meetings/tasks but keeps accounts."""

from datetime import timedelta
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from tracker.models import CommissionTask, Meeting, Ministry, Profile, Role, Submission, WorkflowStage


class PurgePilotDataTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("keepme", password="x")
        Profile.objects.create(user=self.user, role=Role.PSC_ADMIN)
        self.ministry = Ministry.objects.create(code="TRN", name="Training Ministry")
        self.meeting = Meeting.objects.create(
            title="Pilot sitting", date=timezone.now().date() + timedelta(days=2),
            time="09:00", venue="H", submission_cutoff=timezone.now(),
        )
        self.submission = Submission.objects.create(
            title="Pilot submission", ministry=self.ministry, received_at=timezone.now(),
            created_by=self.user, current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
        )
        self.task = CommissionTask.objects.create(
            title="Pilot task", submission=self.submission, meeting=self.meeting,
            assigned_manager=self.user, created_by=self.user, due_date=timezone.now().date(),
        )

    def _run(self, *args):
        out = StringIO()
        call_command("purge_pilot_data", *args, "--skip-backup", stdout=out)
        return out.getvalue()

    def test_dry_run_changes_nothing(self):
        before = (Submission.objects.count(), Meeting.objects.count(), CommissionTask.objects.count())
        out = self._run()
        self.assertIn("Dry run", out)
        self.assertEqual(
            (Submission.objects.count(), Meeting.objects.count(), CommissionTask.objects.count()), before,
        )

    def test_execute_deletes_data_but_keeps_accounts_and_ministries(self):
        self._run("--execute")
        self.assertEqual(Submission.objects.count(), 0)
        self.assertEqual(Meeting.objects.count(), 0)
        self.assertEqual(CommissionTask.objects.count(), 0)
        self.assertTrue(User.objects.filter(username="keepme").exists())
        self.assertTrue(Ministry.objects.filter(code="TRN").exists())

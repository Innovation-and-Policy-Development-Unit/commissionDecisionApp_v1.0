"""Automation-engine dispatch timing (P0-04, SCDMS Pre-Production Readiness
Audit — Findings Register): Submission/CommissionTask/Meeting saves used to
run automation actions — including a synchronous SMTP send in
automation.engine._send_notify — inline, inside a DB savepoint nested in
the caller's open transaction (tracker/signals.py's _dispatch_automation).
Under any email/SMTP latency, that held row locks open for the duration of
the outbound network call.

These tests lock in the fix: automation dispatch is now queued via
transaction.on_commit() + Celery .delay(), matching the pattern already
used correctly elsewhere in tracker/signals.py (notification_post_save,
feedback_comment_post_save).
"""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from ..models import Automation, Ministry, Profile, Role, Submission


def _user(username, role, *, email=""):
    u = User.objects.create_user(username, email=email, password="x")
    Profile.objects.create(user=u, role=role)
    return u


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class AutomationDispatchIsAsyncTests(TestCase):
    def setUp(self):
        Submission.objects.all().delete()
        Automation.objects.all().delete()
        self.ministry = Ministry.objects.create(code="TST-AUT", name="Test Ministry Automation")
        self.admin = _user("auto_admin", Role.PSC_ADMIN, email="admin@gov.vu")
        Automation.objects.create(
            name="Notify on create", entity="submission", trigger="created", match="all",
            conditions=[], actions=[{"type": "notify", "params": {"to_assignee": True, "message": "hi"}}],
            cooldown_minutes=0,
        )

    def _make_submission(self, **kw):
        return Submission.objects.create(
            title=kw.pop("title", "Automation dispatch test"), ministry=self.ministry,
            received_at=timezone.now(), created_by=self.admin, assigned_to=self.admin, **kw,
        )

    @patch("tracker.tasks.run_automation_event_task.delay")
    def test_save_does_not_queue_automation_before_commit(self, mock_delay):
        with self.captureOnCommitCallbacks(execute=False):
            self._make_submission()
        mock_delay.assert_not_called()

    @patch("tracker.tasks.run_automation_event_task.delay")
    def test_save_queues_automation_with_correct_args_after_commit(self, mock_delay):
        with self.captureOnCommitCallbacks(execute=True):
            submission = self._make_submission()
        mock_delay.assert_called_once_with("submission", submission.pk, "created")

    def test_save_does_not_send_email_synchronously(self):
        mail.outbox = []
        with self.captureOnCommitCallbacks(execute=False):
            self._make_submission()
        self.assertEqual(len(mail.outbox), 0)

    def test_run_automation_event_task_resolves_object_and_runs(self):
        from ..tasks import run_automation_event_task

        mail.outbox = []
        with self.captureOnCommitCallbacks(execute=False):
            submission = self._make_submission()
        run_automation_event_task("submission", submission.pk, "created")
        self.assertEqual(len(mail.outbox), 1)

    def test_run_automation_event_task_missing_object_is_noop(self):
        from ..tasks import run_automation_event_task

        run_automation_event_task("submission", 999999999, "created")  # must not raise

"""Workflow/hand-back emails moved off the request/response path onto Celery
(queue_transition_emails, queue_external_submission_confirmation_emails,
queue_submission_ready_for_manager_email in tasks.py) — the Resend HTTP API
call was measured at ~1.2-1.5s per recipient just for TCP+TLS handshake from
this server, which is what made "Submit back to Manager" / "Submit to
Secretary" feel slow. These tests exercise the task bodies directly (what
the Celery worker actually runs) and the queue wrappers' fallback-to-sync
behavior when the broker is unavailable."""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from ..models import Ministry, Profile, Role, Submission, WorkflowStage
from ..tasks import (
    queue_assignment_email,
    queue_external_submission_confirmation_emails,
    queue_submission_ready_for_manager_email,
    queue_transition_emails,
    send_assignment_notification_email,
    send_external_submission_confirmation_emails,
    send_submission_ready_for_manager_email,
    send_transition_notification_emails,
)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class TaskBodySendsSameEmailsTests(TestCase):
    """The task functions re-fetch by id and must produce the same outbound
    email as the old inline call did — only *when* it runs has changed."""

    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-ASYNC", name="Test Ministry ASYNC")
        self.hr = User.objects.create_user("hr_async", password="x", email="hr@ministry.gov.vu")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.submission = Submission.objects.create(
            reference_number="SUB-ASYNC-001",
            title="Appointment matter",
            ministry=self.ministry,
            current_stage=WorkflowStage.SUBMITTED,
            received_at=timezone.now(),
            created_by=self.hr,
        )

    def test_transition_email_task_sends_to_given_users(self):
        recipient = User.objects.create_user("recip_async", email="recip@ministry.gov.vu")
        send_transition_notification_emails(
            self.submission.id, WorkflowStage.DRAFT, WorkflowStage.SUBMITTED, [recipient.id],
        )
        self.assertTrue(any(recipient.email in m.to for m in mail.outbox))

    def test_transition_email_task_missing_submission_is_a_noop(self):
        send_transition_notification_emails(999999, WorkflowStage.DRAFT, WorkflowStage.SUBMITTED, [self.hr.id])
        self.assertEqual(len(mail.outbox), 0)

    def test_confirmation_email_task_sends_to_given_users(self):
        send_external_submission_confirmation_emails(self.submission.id, [self.hr.id])
        self.assertTrue(any(self.hr.email in m.to for m in mail.outbox))

    def test_ready_for_manager_email_task_sends_to_managers(self):
        manager = User.objects.create_user("mgr_async", email="manager@psc.gov.vu")
        Profile.objects.create(user=manager, role=Role.ODU_MANAGER)
        send_submission_ready_for_manager_email(self.submission.id, self.hr.id, [manager.id])
        self.assertTrue(any(manager.email in m.to for m in mail.outbox))

    def test_ready_for_manager_email_task_missing_assignee_is_a_noop(self):
        send_submission_ready_for_manager_email(self.submission.id, 999999, [self.hr.id])
        self.assertEqual(len(mail.outbox), 0)

    def test_assignment_email_task_sends_to_assignee(self):
        principal = User.objects.create_user("principal_async", email="principal@psc.gov.vu")
        send_assignment_notification_email(self.submission.id, principal.id, manager_name="A Manager")
        self.assertTrue(any(principal.email in m.to for m in mail.outbox))

    def test_assignment_email_task_missing_assignee_is_a_noop(self):
        send_assignment_notification_email(self.submission.id, 999999)
        self.assertEqual(len(mail.outbox), 0)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class QueueWrapperFallbackTests(TestCase):
    """When .delay() can't reach the broker, the wrapper must still get the
    email out (degraded to synchronous) rather than silently dropping it."""

    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-ASYNCFB", name="Test Ministry ASYNCFB")
        self.hr = User.objects.create_user("hr_asyncfb", password="x", email="hr@ministry.gov.vu")
        self.submission = Submission.objects.create(
            reference_number="SUB-ASYNCFB-001",
            title="Appointment matter",
            ministry=self.ministry,
            current_stage=WorkflowStage.SUBMITTED,
            received_at=timezone.now(),
            created_by=self.hr,
        )

    def test_transition_email_falls_back_to_sync_when_broker_unavailable(self):
        recipient = User.objects.create_user("recip_asyncfb", email="recip@ministry.gov.vu")
        with patch(
            "tracker.tasks.send_transition_notification_emails.delay",
            side_effect=RuntimeError("broker unreachable"),
        ):
            queue_transition_emails(
                self.submission.id, WorkflowStage.DRAFT, WorkflowStage.SUBMITTED, [recipient.id],
            )
        self.assertTrue(any(recipient.email in m.to for m in mail.outbox))

    def test_confirmation_email_falls_back_to_sync_when_broker_unavailable(self):
        with patch(
            "tracker.tasks.send_external_submission_confirmation_emails.delay",
            side_effect=RuntimeError("broker unreachable"),
        ):
            queue_external_submission_confirmation_emails(self.submission.id, [self.hr.id])
        self.assertTrue(any(self.hr.email in m.to for m in mail.outbox))

    def test_ready_for_manager_email_falls_back_to_sync_when_broker_unavailable(self):
        manager = User.objects.create_user("mgr_asyncfb", email="manager@psc.gov.vu")
        with patch(
            "tracker.tasks.send_submission_ready_for_manager_email.delay",
            side_effect=RuntimeError("broker unreachable"),
        ):
            queue_submission_ready_for_manager_email(self.submission.id, self.hr.id, [manager.id])
        self.assertTrue(any(manager.email in m.to for m in mail.outbox))

    def test_assignment_email_falls_back_to_sync_when_broker_unavailable(self):
        principal = User.objects.create_user("principal_asyncfb", email="principal@psc.gov.vu")
        with patch(
            "tracker.tasks.send_assignment_notification_email.delay",
            side_effect=RuntimeError("broker unreachable"),
        ):
            queue_assignment_email(self.submission.id, principal.id, manager_name="A Manager")
        self.assertTrue(any(principal.email in m.to for m in mail.outbox))

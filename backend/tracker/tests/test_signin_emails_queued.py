"""Sign-in and recovery emails are sent from Celery, so the login and
"forgot password / PIN" requests don't wait on the mail provider. These cover
the queueing, the task bodies, and the broker-down fallback."""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings

from ..models import AuditLog, LoginEmailOTP, PasswordResetToken, PinResetToken, Profile, Role
from ..tasks import (
    queue_login_otp_email,
    queue_password_reset_email,
    send_login_otp_email_task,
    send_password_reset_email_task,
    send_pin_reset_email_task,
)


@override_settings(
    SECURE_SSL_REDIRECT=False,
    ALLOWED_HOSTS=["*"],
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class SigninEmailTaskTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("queued_u", email="queued@example.org", password="x")
        Profile.objects.create(user=self.user, role=Role.PSC_OFFICER)

    def test_otp_task_sends_the_code(self):
        row, code = LoginEmailOTP.issue(self.user)
        self.assertTrue(send_login_otp_email_task(self.user.id, row.id, code, "queued@example.org", 10))
        self.assertIn(code, mail.outbox[-1].body)
        self.assertTrue(LoginEmailOTP.objects.filter(pk=row.id).exists())

    def test_otp_task_failure_frees_the_resend_cooldown(self):
        row, code = LoginEmailOTP.issue(self.user)
        with patch("tracker.email_notify.send_login_otp_email", return_value=False):
            self.assertFalse(send_login_otp_email_task(self.user.id, row.id, code, "queued@example.org", 10))
        self.assertFalse(LoginEmailOTP.objects.filter(pk=row.id).exists())

    def test_otp_queue_falls_back_to_sending_inline_when_broker_is_down(self):
        row, code = LoginEmailOTP.issue(self.user)
        with patch("tracker.tasks.send_login_otp_email_task.delay", side_effect=RuntimeError("broker down")):
            self.assertTrue(queue_login_otp_email(self.user.id, row.id, code, "queued@example.org", 10))
        self.assertIn(code, mail.outbox[-1].body)

    def test_password_reset_task_builds_the_link_from_the_token_and_audits_the_outcome(self):
        token = PasswordResetToken.generate_for(self.user)
        self.assertTrue(send_password_reset_email_task(token.id, "https://app.example", "queued@example.org"))
        self.assertIn(f"https://app.example/auth/reset-password/confirm?token={token.token}", mail.outbox[-1].body)
        self.assertTrue(AuditLog.objects.filter(resource_type="PasswordResetEmail", extra_data__status="sent").exists())

    def test_pin_reset_task_builds_the_link_from_the_token(self):
        token = PinResetToken.generate_for(self.user)
        self.assertTrue(send_pin_reset_email_task(token.id, "https://app.example", "queued@example.org"))
        self.assertIn(f"https://app.example/auth/forgot-pin/confirm?token={token.token}", mail.outbox[-1].body)

    def test_reset_queue_falls_back_when_broker_is_down(self):
        token = PasswordResetToken.generate_for(self.user)
        with patch("tracker.tasks.send_password_reset_email_task.delay", side_effect=RuntimeError("broker down")):
            queue_password_reset_email(token.id, "https://app.example", "queued@example.org")
        self.assertEqual(len(mail.outbox), 1)

    def test_reset_request_view_queues_and_does_not_send_inline(self):
        from rest_framework.test import APIClient

        with patch("tracker.tasks.send_password_reset_email_task.delay") as delay:
            resp = APIClient().post("/api/auth/password-reset/request/", {"email": "queued@example.org"})
        self.assertEqual(resp.status_code, 200)
        delay.assert_called_once()
        self.assertEqual(len(mail.outbox), 0)

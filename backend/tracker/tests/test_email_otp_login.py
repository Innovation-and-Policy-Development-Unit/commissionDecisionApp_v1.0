import re
from datetime import timedelta

from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from ..models import LoginEmailOTP, Profile, Role, TrustedSession


@override_settings(
    SECURE_SSL_REDIRECT=False,
    ALLOWED_HOSTS=["*"],
    LOGIN_EMAIL_OTP_REQUIRED=True,
    TWO_FACTOR_REQUIRED=True,  # email OTP must win over TOTP
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache",
                        "LOCATION": "test-email-otp-login"}},
)
class EmailOTPLoginTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            "otpuser", email="otpuser@example.org", password="TestPass123!")
        Profile.objects.create(user=self.user, role=Role.PSC_OFFICER,
                               totp_secret="JBSWY3DPEHPK3PXP", two_factor_enabled=True)

    def _login(self, **kw):
        return self.client.post("/api/auth/token/",
                                {"username": "otpuser", "password": "TestPass123!", **kw})

    def _sent_code(self):
        return re.search(r"code is: (\d{6})", mail.outbox[-1].body).group(1)

    def test_password_step_emails_code_instead_of_tokens_or_totp(self):
        resp = self._login()
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body["email_otp_required"])
        self.assertNotIn("access", body)
        self.assertNotIn("two_factor_required", body)
        self.assertEqual(body["email_hint"], "ot*****@example.org")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["otpuser@example.org"])

    def test_email_uses_branded_login_otp_template(self):
        self._login()
        msg = mail.outbox[0]
        self.assertEqual(msg.subject, "Your SCDMS sign-in code")
        html = msg.alternatives[0][0]
        self.assertIn("data-opsc-email-frame", html)
        self.assertIn(self._sent_code(), html)
        self.assertIn("Your sign-in code", html)

    def test_correct_code_returns_tokens_and_trusted_session(self):
        self._login()
        resp = self.client.post("/api/auth/email-otp/verify/",
                                {"username": "otpuser", "code": self._sent_code()})
        self.assertEqual(resp.status_code, 200)
        claims = AccessToken(resp.json()["access"])
        self.assertEqual(claims["auth_method"], "email_otp")
        self.assertEqual(TrustedSession.objects.get(pk=claims["trusted_session_id"]).user, self.user)

    def test_code_is_single_use(self):
        self._login()
        code = self._sent_code()
        self.assertEqual(self.client.post("/api/auth/email-otp/verify/",
                                          {"username": "otpuser", "code": code}).status_code, 200)
        self.assertEqual(self.client.post("/api/auth/email-otp/verify/",
                                          {"username": "otpuser", "code": code}).status_code, 400)

    def test_wrong_code_rejected_and_locks_after_max_attempts(self):
        self._login()
        good = self._sent_code()
        bad = "000000" if good != "000000" else "111111"
        for _ in range(5):
            resp = self.client.post("/api/auth/email-otp/verify/",
                                    {"username": "otpuser", "code": bad})
            self.assertEqual(resp.status_code, 400)
        # Even the right code no longer works once attempts are exhausted.
        resp = self.client.post("/api/auth/email-otp/verify/",
                                {"username": "otpuser", "code": good})
        self.assertEqual(resp.status_code, 400)

    def test_expired_code_rejected(self):
        self._login()
        LoginEmailOTP.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
        resp = self.client.post("/api/auth/email-otp/verify/",
                                {"username": "otpuser", "code": self._sent_code()})
        self.assertEqual(resp.status_code, 400)

    def test_repeat_login_within_cooldown_does_not_resend(self):
        self._login()
        self._login()
        self.assertEqual(len(mail.outbox), 1)

    def test_wrong_password_sends_nothing(self):
        resp = self.client.post("/api/auth/token/", {"username": "otpuser", "password": "nope"})
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(len(mail.outbox), 0)

    def test_account_without_email_is_refused(self):
        self.user.email = ""
        self.user.save()
        resp = self._login()
        self.assertEqual(resp.status_code, 403)
        self.assertNotIn("access", resp.json())

    @override_settings(LOGIN_EMAIL_OTP_REQUIRED=False, TWO_FACTOR_REQUIRED=False)
    def test_disabled_flag_restores_password_only_login(self):
        resp = self._login()
        self.assertIn("access", resp.json())
        self.assertEqual(len(mail.outbox), 0)

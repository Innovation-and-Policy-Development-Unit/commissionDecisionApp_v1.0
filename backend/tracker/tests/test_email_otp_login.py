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

    # ── the code email carries no links ──────────────────────────────────────
    def test_the_code_email_has_no_links_at_all(self):
        self._login()
        msg = mail.outbox[0]
        html = msg.alternatives[0][0]
        for part, name in ((html, "html"), (msg.body, "text")):
            self.assertNotIn("http", part.lower(), f"{name} part has a URL")
            self.assertNotIn("href=", part.lower(), f"{name} part has a link")
        self.assertIn(self._sent_code(), html)
        self.assertIn(self._sent_code(), msg.body)

    def test_other_emails_keep_their_links(self):
        from tracker.email_templates import _brand_frame

        self.assertIn("href=", _brand_frame("<p>x</p>", {}, slug="submission_returned_to_hr"))
        self.assertNotIn("href=", _brand_frame("<p>x</p>", {}, slug="login_otp"))

    # ── asking again does not kill the code that is still on its way ─────────
    def _later(self):
        """Move the cooldown out of the way so the next sign-in issues a new code."""
        from django.db.models import F

        LoginEmailOTP.objects.update(created_at=F("created_at") - timedelta(minutes=2))

    def _verify(self, code):
        return self.client.post("/api/auth/email-otp/verify/", {"username": "otpuser", "code": code})

    def test_the_first_code_still_works_after_a_second_is_requested(self):
        self._login()
        first = self._sent_code()
        self._later()
        self._login()
        second = self._sent_code()
        self.assertNotEqual(first, second)
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(self._verify(first).status_code, 200)

    def test_the_newer_code_works_too(self):
        self._login()
        self._later()
        self._login()
        self.assertEqual(self._verify(self._sent_code()).status_code, 200)

    def test_using_one_code_retires_the_others(self):
        self._login()
        first = self._sent_code()
        self._later()
        self._login()
        second = self._sent_code()
        self.assertEqual(self._verify(second).status_code, 200)
        self.assertEqual(self._verify(first).status_code, 400)

    def test_only_the_latest_three_codes_stay_valid(self):
        codes = []
        for _ in range(4):
            self._login()
            codes.append(self._sent_code())
            self._later()
        self.assertEqual(self._verify(codes[0]).status_code, 400)
        self.assertEqual(self._verify(codes[1]).status_code, 200)

    def test_wrong_guesses_count_across_all_live_codes(self):
        self._login()
        first = self._sent_code()
        self._later()
        self._login()
        second = self._sent_code()
        bad = next(c for c in ("000000", "111111", "222222") if c not in (first, second))
        for _ in range(5):
            self.assertEqual(self._verify(bad).status_code, 400)
        # Two live codes do not mean ten guesses: both are spent after five.
        self.assertEqual(self._verify(first).status_code, 400)
        self.assertEqual(self._verify(second).status_code, 400)

    def test_an_expired_earlier_code_stays_dead(self):
        self._login()
        first = self._sent_code()
        LoginEmailOTP.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
        self._login()
        self.assertEqual(self._verify(first).status_code, 400)

    def test_the_login_reply_tells_the_screen_how_long_to_wait(self):
        body = self._login().json()
        self.assertEqual(body["resend_after_seconds"], 60)
        self.assertEqual(body["expires_in_minutes"], 10)

    def test_a_second_request_inside_a_minute_does_not_send_another_email(self):
        self._login()
        LoginEmailOTP.objects.update(created_at=timezone.now() - timedelta(seconds=54))
        self._login()
        self.assertEqual(len(mail.outbox), 1)


class TrustedSessionWindowTests(TestCase):
    """A trusted device needs only the PIN for the working day (8 hours, ending 5pm)."""

    def _at(self, hour, minute=0):
        from datetime import datetime

        tz = timezone.get_current_timezone()
        return timezone.make_aware(datetime(2026, 10, 26, hour, minute), tz)

    def test_an_early_login_is_trusted_for_eight_hours(self):
        start = self._at(8, 0)
        self.assertEqual(TrustedSession.compute_expiry(start), start + timedelta(hours=8))

    def test_a_mid_morning_login_is_trusted_until_five_pm(self):
        self.assertEqual(TrustedSession.compute_expiry(self._at(10, 0)), self._at(17, 0))

    def test_a_login_after_five_pm_gets_the_full_eight_hours(self):
        start = self._at(17, 30)
        self.assertEqual(TrustedSession.compute_expiry(start), start + timedelta(hours=8))

    @override_settings()
    def test_the_length_can_still_be_overridden(self):
        import os
        from unittest import mock

        with mock.patch.dict(os.environ, {"SESSION_TRUST_HOURS": "2"}):
            start = self._at(8, 0)
            self.assertEqual(TrustedSession.compute_expiry(start), start + timedelta(hours=2))


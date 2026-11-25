"""Go-live quick fixes: public health probe and per-account sign-in throttles."""

from unittest import mock

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db.utils import OperationalError
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient, APIRequestFactory

from tracker.models import Profile, Role
from tracker.throttles import OTPVerifyIPThrottle, OTPVerifyThrottle


class ApiHealthTests(TestCase):
    def _get(self):
        return self.client.get("/api/health/")

    def test_healthy_when_database_and_redis_answer(self):
        with mock.patch("redis.Redis.from_url") as redis_from_url:
            redis_from_url.return_value.ping.return_value = True
            res = self._get()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"status": "healthy", "database": True, "redis": True})

    def test_503_when_redis_is_down(self):
        with mock.patch("redis.Redis.from_url", side_effect=ConnectionError("boom: 10.0.0.5:6379")):
            res = self._get()
        self.assertEqual(res.status_code, 503)
        body = res.json()
        self.assertEqual(body["status"], "unhealthy")
        self.assertFalse(body["redis"])
        self.assertNotIn("10.0.0.5", res.content.decode())  # no internal error text

    def test_503_when_database_is_down(self):
        with mock.patch("redis.Redis.from_url") as redis_from_url, \
                mock.patch("django.db.backends.base.base.BaseDatabaseWrapper.ensure_connection",
                           side_effect=OperationalError("db gone")):
            redis_from_url.return_value.ping.return_value = True
            res = self._get()
        self.assertEqual(res.status_code, 503)
        self.assertFalse(res.json()["database"])

    def test_needs_no_login(self):
        with mock.patch("redis.Redis.from_url") as redis_from_url:
            redis_from_url.return_value.ping.return_value = True
            self.assertEqual(self._get().status_code, 200)


class SignInThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        for name in ("alice", "bob"):
            u = User.objects.create_user(name, password="x")
            Profile.objects.create(user=u, role=Role.MINISTRY_HR)
        self.client = APIClient()

    def _verify(self, username, ip="203.0.113.7"):
        return self.client.post(
            "/api/auth/email-otp/verify/", {"username": username, "code": "000000"},
            format="json", HTTP_X_FORWARDED_FOR=ip,
        )

    def test_one_account_is_capped_per_ip(self):
        codes = [self._verify("alice").status_code for _ in range(12)]
        self.assertEqual(codes[:10], [400] * 10)  # wrong code, but not throttled
        self.assertEqual(codes[10:], [429, 429])

    def test_colleagues_behind_the_same_ip_are_not_locked_out_by_each_other(self):
        for _ in range(11):
            self._verify("alice")  # alice burns through her bucket
        self.assertEqual(self._verify("alice").status_code, 429)
        self.assertEqual(self._verify("bob").status_code, 400)  # bob is unaffected

    def test_same_account_from_another_ip_has_its_own_bucket(self):
        for _ in range(11):
            self._verify("alice", ip="203.0.113.7")
        self.assertEqual(self._verify("alice", ip="198.51.100.9").status_code, 400)

    def test_username_case_does_not_open_a_new_bucket(self):
        for _ in range(10):
            self._verify("alice")
        self.assertEqual(self._verify("ALICE").status_code, 429)

    def test_one_ip_spraying_many_accounts_hits_the_ip_ceiling(self):
        rate = int(OTPVerifyIPThrottle.THROTTLE_RATES["otp_verify_ip"].split("/")[0])
        statuses = [self._verify(f"user{i}").status_code for i in range(rate + 5)]
        self.assertIn(429, statuses)
        self.assertEqual(statuses[:rate], [400] * rate)

    def test_the_real_client_ip_is_used_not_a_forged_header_prefix(self):
        # Caddy/nginx append the true peer last; an attacker-supplied prefix must not
        # create fresh buckets.
        for i in range(10):
            self._verify("alice", ip=f"1.2.3.{i}, 203.0.113.7")
        self.assertEqual(self._verify("alice", ip="9.9.9.9, 203.0.113.7").status_code, 429)

    def test_rates_are_configured(self):
        self.assertEqual(OTPVerifyThrottle.THROTTLE_RATES["otp_verify"], "10/min")
        self.assertEqual(OTPVerifyThrottle.THROTTLE_RATES["session_pin_verify"], "5/min")
        self.assertEqual(OTPVerifyThrottle.THROTTLE_RATES["submission_create"], "30/hour")


class ThrottleKeyTests(SimpleTestCase):
    def test_unparseable_body_falls_back_to_the_ip_bucket(self):
        from rest_framework.request import Request

        factory = APIRequestFactory()
        raw = factory.post("/x/", data="{not json", content_type="application/json",
                           HTTP_X_FORWARDED_FOR="203.0.113.7")
        request = Request(raw)
        request.user = mock.Mock(is_authenticated=False)
        key = OTPVerifyThrottle().get_cache_key(request, None)
        self.assertTrue(key.endswith("203.0.113.7"), key)

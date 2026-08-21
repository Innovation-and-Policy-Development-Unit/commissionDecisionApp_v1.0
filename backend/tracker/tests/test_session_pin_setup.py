"""Session PIN setup — re-enabled after being hard-disabled system-wide.
Every authenticated user may set/change their PIN; changing an existing one
requires the current password."""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tracker.models import Profile, Role


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class SessionPinSetupTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="pin_user", password="correct-horse-battery")
        Profile.objects.create(user=self.user, role=Role.PSC_OFFICER)
        self.client.force_authenticate(user=self.user)

    def test_first_time_setup_does_not_require_password(self):
        res = self.client.post("/api/auth/session-pin/setup/", {"pin": "1234"})
        self.assertEqual(res.status_code, 200, res.data)
        self.user.psc_profile.refresh_from_db()
        self.assertTrue(self.user.psc_profile.session_pin)

    def test_non_digit_pin_rejected(self):
        res = self.client.post("/api/auth/session-pin/setup/", {"pin": "12ab"})
        self.assertEqual(res.status_code, 400)

    def test_changing_pin_requires_current_password(self):
        self.client.post("/api/auth/session-pin/setup/", {"pin": "1234"})
        res = self.client.post("/api/auth/session-pin/setup/", {"pin": "5678"})
        self.assertEqual(res.status_code, 400)

        res = self.client.post(
            "/api/auth/session-pin/setup/",
            {"pin": "5678", "current_password": "correct-horse-battery"},
        )
        self.assertEqual(res.status_code, 200, res.data)

    def test_unauthenticated_rejected(self):
        self.client.force_authenticate(user=None)
        res = self.client.post("/api/auth/session-pin/setup/", {"pin": "1234"})
        self.assertEqual(res.status_code, 401)

    def test_me_reflects_pin_set(self):
        res = self.client.get("/api/me/")
        self.assertFalse(res.data["session_pin_set"])
        self.client.post("/api/auth/session-pin/setup/", {"pin": "1234"})
        res = self.client.get("/api/me/")
        self.assertTrue(res.data["session_pin_set"])

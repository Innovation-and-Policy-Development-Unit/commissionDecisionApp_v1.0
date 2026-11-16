"""Web-app login tokens live in HttpOnly cookies, not page JavaScript."""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from tracker.models import Profile, Role

CSRF = "a" * 32


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"], AUTH_COOKIE_SECURE=False)
class AuthCookieTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("ck_user", password="pass")
        Profile.objects.create(user=self.user, role=Role.PSC_ADMIN)
        self.refresh = RefreshToken.for_user(self.user)

    def _client(self, **kw):
        return APIClient(enforce_csrf_checks=True, **kw)

    def test_access_cookie_authenticates_a_read(self):
        c = self._client()
        c.cookies["scdms_access"] = str(self.refresh.access_token)
        self.assertEqual(c.get("/api/me/").status_code, 200)

    def test_bearer_header_still_works_without_csrf(self):
        c = self._client()
        res = c.post("/api/auth/logout/", {"refresh": str(self.refresh)}, format="json",
                     HTTP_AUTHORIZATION=f"Bearer {self.refresh.access_token}")
        self.assertEqual(res.status_code, 200)

    def test_cookie_write_without_csrf_header_is_refused(self):
        c = self._client()
        c.cookies["scdms_access"] = str(self.refresh.access_token)
        c.cookies["scdms_refresh"] = str(self.refresh)
        c.cookies["csrftoken"] = CSRF
        self.assertEqual(c.post("/api/auth/logout/", {}, format="json").status_code, 403)

    def test_cookie_write_with_csrf_header_works_and_clears_cookies(self):
        c = self._client()
        c.cookies["scdms_access"] = str(self.refresh.access_token)
        c.cookies["scdms_refresh"] = str(self.refresh)
        c.cookies["csrftoken"] = CSRF
        res = c.post("/api/auth/logout/", {}, format="json",
                     HTTP_X_CSRFTOKEN=CSRF, HTTP_X_AUTH_MODE="cookie")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.cookies["scdms_access"]["max-age"], 0)
        self.assertEqual(res.cookies["scdms_refresh"]["max-age"], 0)

    def test_refresh_in_cookie_mode_moves_tokens_to_cookies(self):
        c = self._client()
        c.cookies["scdms_refresh"] = str(self.refresh)
        res = c.post("/api/auth/token/refresh/", {}, format="json", HTTP_X_AUTH_MODE="cookie")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertNotIn("access", res.json())
        self.assertNotIn("refresh", res.json())
        self.assertTrue(res.cookies["scdms_access"]["httponly"])
        self.assertTrue(res.cookies["scdms_refresh"]["httponly"])
        self.assertEqual(res.cookies["scdms_refresh"]["path"], "/api/auth/")
        self.assertFalse(res.cookies["scdms_csrf"]["httponly"])

    def test_refresh_without_header_still_returns_tokens_in_body(self):
        res = self._client().post("/api/auth/token/refresh/", {"refresh": str(self.refresh)}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.json())
        self.assertNotIn("scdms_access", res.cookies)

    def test_bad_refresh_cookie_clears_cookies(self):
        c = self._client()
        c.cookies["scdms_refresh"] = "not-a-token"
        res = c.post("/api/auth/token/refresh/", {}, format="json", HTTP_X_AUTH_MODE="cookie")
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.cookies["scdms_refresh"]["max-age"], 0)

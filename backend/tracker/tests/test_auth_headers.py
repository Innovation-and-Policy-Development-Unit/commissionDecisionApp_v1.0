"""Expired/invalid/missing auth must produce 401, not 403.

DRF picks its WWW-Authenticate header from the FIRST authenticator in
DEFAULT_AUTHENTICATION_CLASSES (APIKeyAuthentication, then JWTAuthentication).
Without APIKeyAuthentication.authenticate_header(), DRF has no header to
offer and downgrades AuthenticationFailed to 403 — which silently breaks the
frontend's refresh-and-retry logic, since that only ever triggers on 401.
"""

from django.test import TestCase, override_settings
from rest_framework.test import APIClient


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class AuthHeaderStatusTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_invalid_bearer_token_returns_401(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer garbage.invalid.token")
        res = self.client.get("/api/notifications/")
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res["WWW-Authenticate"], "Bearer")
        self.assertEqual(res.data.get("code"), "token_not_valid")

    def test_missing_credentials_returns_401(self):
        res = self.client.get("/api/notifications/")
        self.assertEqual(res.status_code, 401)

"""Signing in must not be blocked by a leftover token from a deleted or deactivated account."""
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken


class StaleTokenLoginTests(TestCase):
    def setUp(self):
        cache.clear()
        self.real = User.objects.create_user("real.user", "r@example.com", "S3cure-pass!x")

    def _login(self, token):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client.post(
            "/api/auth/token/",
            {"username": "real.user", "password": "S3cure-pass!x"},
            format="json", HTTP_HOST="localhost",
        )

    def test_token_of_a_deleted_user_does_not_block_login(self):
        gone = User.objects.create_user("gone.user", "g@example.com", "x")
        token = str(AccessToken.for_user(gone))
        gone.delete()
        res = self._login(token)
        self.assertNotEqual(res.status_code, 401, res.content)
        self.assertNotIn(b"User not found", res.content)

    def test_token_of_a_deactivated_user_does_not_block_login(self):
        off = User.objects.create_user("off.user", "o@example.com", "x")
        token = str(AccessToken.for_user(off))
        off.is_active = False
        off.save()
        res = self._login(token)
        self.assertNotEqual(res.status_code, 401, res.content)

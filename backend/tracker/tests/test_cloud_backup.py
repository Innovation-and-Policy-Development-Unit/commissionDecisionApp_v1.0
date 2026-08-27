"""Google Drive cloud-backup push: encryption-at-rest for the OAuth refresh
token (first use of encryption in this codebase — crypto_utils.py), the
connect/callback/disconnect/push admin endpoints, and the connect-a-new-
admin-when-the-old-one-leaves flow this feature exists for.

Drive/OAuth calls are mocked throughout — no real Google account needed.
"""

import os
from unittest import mock

from cryptography.fernet import Fernet
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tracker import crypto_utils, google_drive_backup
from tracker.models import CloudBackupConnection, Profile, Role

_TEST_KEY = Fernet.generate_key().decode()


class CryptoUtilsTests(TestCase):
    def test_encrypt_decrypt_round_trip(self):
        with mock.patch.dict(os.environ, {"BACKUP_CLOUD_ENCRYPTION_KEY": _TEST_KEY}):
            ciphertext = crypto_utils.encrypt("a-real-refresh-token")
            self.assertNotEqual(ciphertext, "a-real-refresh-token")
            self.assertEqual(crypto_utils.decrypt(ciphertext), "a-real-refresh-token")

    def test_decrypt_with_wrong_key_raises(self):
        with mock.patch.dict(os.environ, {"BACKUP_CLOUD_ENCRYPTION_KEY": _TEST_KEY}):
            ciphertext = crypto_utils.encrypt("secret")
        other_key = Fernet.generate_key().decode()
        with mock.patch.dict(os.environ, {"BACKUP_CLOUD_ENCRYPTION_KEY": other_key}):
            with self.assertRaises(ValueError):
                crypto_utils.decrypt(ciphertext)

    def test_missing_key_raises_improperly_configured(self):
        from django.core.exceptions import ImproperlyConfigured
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("BACKUP_CLOUD_ENCRYPTION_KEY", None)
            with self.assertRaises(ImproperlyConfigured):
                crypto_utils.encrypt("x")


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class CloudBackupEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username="cloud_admin", password="pass")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.client.force_authenticate(user=self.admin)
        self.env_patch = mock.patch.dict(os.environ, {
            "BACKUP_CLOUD_ENCRYPTION_KEY": _TEST_KEY,
            "GOOGLE_CLIENT_ID": "test-client-id",
            "GOOGLE_CLIENT_SECRET": "test-client-secret",
            "GOOGLE_REDIRECT_URI": "https://scdms.example/api/backup/cloud/callback/",
        })
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)

    def test_status_when_nothing_connected(self):
        res = self.client.get("/api/backup/cloud/status/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {"connected": False})

    def test_status_when_connected(self):
        CloudBackupConnection.objects.create(
            provider=CloudBackupConnection.Provider.GOOGLE_DRIVE,
            status=CloudBackupConnection.Status.CONNECTED,
            connected_email="admin@psc.gov.vu",
        )
        res = self.client.get("/api/backup/cloud/status/")
        self.assertTrue(res.data["connected"])
        self.assertEqual(res.data["connected_email"], "admin@psc.gov.vu")

    def test_connect_returns_auth_url_and_stashes_state_in_session(self):
        with mock.patch.object(google_drive_backup, "build_auth_url", return_value="https://accounts.google.com/fake") as m:
            res = self.client.get("/api/backup/cloud/connect/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["auth_url"], "https://accounts.google.com/fake")
        m.assert_called_once()
        self.assertIsNotNone(self.client.session.get("gdrive_oauth_state"))

    def test_non_admin_cannot_connect(self):
        officer = User.objects.create_user(username="cloud_officer", password="pass")
        Profile.objects.create(user=officer, role=Role.PSC_OFFICER)
        self.client.force_authenticate(user=officer)
        res = self.client.get("/api/backup/cloud/connect/")
        self.assertEqual(res.status_code, 403)

    def test_callback_rejects_mismatched_state(self):
        session = self.client.session
        session["gdrive_oauth_state"] = "the-real-state"
        session["gdrive_oauth_user_id"] = self.admin.id
        session.save()
        res = self.client.get(
            "/api/backup/cloud/callback/", {"state": "an-attacker-supplied-state", "code": "abc"},
        )
        self.assertEqual(res.status_code, 302)
        self.assertIn("gdrive=error", res.url)
        self.assertFalse(CloudBackupConnection.objects.exists())

    def test_callback_rejects_missing_state(self):
        res = self.client.get("/api/backup/cloud/callback/", {"code": "abc"})
        self.assertEqual(res.status_code, 302)
        self.assertIn("gdrive=error", res.url)

    def test_callback_success_creates_connection(self):
        session = self.client.session
        session["gdrive_oauth_state"] = "matching-state"
        session["gdrive_oauth_user_id"] = self.admin.id
        session.save()
        with mock.patch.object(google_drive_backup, "exchange_code_for_tokens", return_value={
            "access_token": "at", "refresh_token": "rt", "expires_in": 3600, "email": "new.admin@psc.gov.vu",
        }):
            res = self.client.get(
                "/api/backup/cloud/callback/", {"state": "matching-state", "code": "abc"},
            )
        self.assertEqual(res.status_code, 302)
        self.assertIn("gdrive=connected", res.url)
        conn = CloudBackupConnection.objects.get(provider=CloudBackupConnection.Provider.GOOGLE_DRIVE)
        self.assertEqual(conn.connected_email, "new.admin@psc.gov.vu")
        self.assertEqual(conn.status, CloudBackupConnection.Status.CONNECTED)
        # Tokens are encrypted at rest, not stored plaintext.
        self.assertNotEqual(conn.access_token_encrypted, "at")
        self.assertEqual(crypto_utils.decrypt(conn.access_token_encrypted), "at")

    def test_reconnecting_replaces_previous_admins_connection(self):
        """The core requirement: when the admin leaves, a new admin
        reconnects with their own account and it just works — no manual
        cleanup of the old connection needed."""
        CloudBackupConnection.objects.create(
            provider=CloudBackupConnection.Provider.GOOGLE_DRIVE,
            status=CloudBackupConnection.Status.CONNECTED,
            connected_email="departed.admin@psc.gov.vu",
            access_token_encrypted=crypto_utils.encrypt("old-token"),
        )
        session = self.client.session
        session["gdrive_oauth_state"] = "s"
        session["gdrive_oauth_user_id"] = self.admin.id
        session.save()
        with mock.patch.object(google_drive_backup, "exchange_code_for_tokens", return_value={
            "access_token": "new-at", "refresh_token": "new-rt", "expires_in": 3600,
            "email": "new.admin@psc.gov.vu",
        }):
            self.client.get("/api/backup/cloud/callback/", {"state": "s", "code": "abc"})

        self.assertEqual(CloudBackupConnection.objects.count(), 1)
        conn = CloudBackupConnection.objects.get()
        self.assertEqual(conn.connected_email, "new.admin@psc.gov.vu")

    def test_disconnect_clears_tokens(self):
        CloudBackupConnection.objects.create(
            provider=CloudBackupConnection.Provider.GOOGLE_DRIVE,
            status=CloudBackupConnection.Status.CONNECTED,
            connected_email="admin@psc.gov.vu",
            access_token_encrypted="something",
            refresh_token_encrypted="something-else",
        )
        res = self.client.post("/api/backup/cloud/disconnect/")
        self.assertEqual(res.status_code, 200)
        conn = CloudBackupConnection.objects.get()
        self.assertEqual(conn.status, CloudBackupConnection.Status.DISCONNECTED)
        self.assertEqual(conn.access_token_encrypted, "")
        self.assertEqual(conn.refresh_token_encrypted, "")

    def test_push_without_connection_rejected(self):
        import tempfile
        from tracker import views as views_module

        with tempfile.TemporaryDirectory() as backup_dir:
            original = views_module._BACKUP_DIR
            views_module._BACKUP_DIR = backup_dir
            try:
                fn = "scdms_backup_20260101_000000.zip"
                with open(os.path.join(backup_dir, fn), "wb") as fh:
                    fh.write(b"fake zip bytes")
                res = self.client.post("/api/backup/cloud/push/", {"filename": fn})
                self.assertEqual(res.status_code, 400)
                self.assertIn("connected", res.data["detail"])
            finally:
                views_module._BACKUP_DIR = original

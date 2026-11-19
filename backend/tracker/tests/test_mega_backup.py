"""MEGA cloud-backup push: megatools wrapper (credentials never on the command
line, error classification, retention only touches our own files), the
connect/disconnect/status endpoints, and the push task. megatools and MEGA are
mocked throughout: no real MEGA account is needed."""

import os
import stat
import tempfile
from datetime import datetime, timedelta
from unittest import mock

from cryptography.fernet import Fernet
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tracker import crypto_utils, mega_backup
from tracker.models import CloudBackupConnection, Profile, Role

_KEY = Fernet.generate_key().decode()


class MegaWrapperTests(TestCase):
    def test_classify_wrong_password_is_auth_error(self):
        err = mega_backup._classify("ERROR: Can't login to mega.nz: API call 'us' failed: HTTP POST failed: Server returned 402")
        self.assertIsInstance(err, mega_backup.MegaAuthError)

    def test_classify_unreachable_is_network_error(self):
        self.assertIsInstance(mega_backup._classify("ERROR: Can't connect to host: timed out"), mega_backup.MegaNetworkError)

    def test_classify_other_is_plain_error(self):
        err = mega_backup._classify("ERROR: something odd")
        self.assertIsInstance(err, mega_backup.MegaError)
        self.assertNotIsInstance(err, (mega_backup.MegaAuthError, mega_backup.MegaNetworkError))

    def test_credentials_go_in_a_private_config_file_not_the_command_line(self):
        seen = {}

        def fake_run(cmd, **kw):
            seen["cmd"] = cmd
            path = cmd[cmd.index("--config") + 1]
            seen["mode"] = stat.S_IMODE(os.stat(path).st_mode)
            seen["body"] = open(path).read()
            seen["path"] = path
            return mock.Mock(returncode=0, stdout="", stderr="")

        with mock.patch("tracker.mega_backup.subprocess.run", side_effect=fake_run):
            mega_backup._run("backup@example.com", "s3cret-pw", ["df"])
        self.assertNotIn("s3cret-pw", " ".join(seen["cmd"]))
        self.assertEqual(seen["mode"], 0o600)
        self.assertIn("s3cret-pw", seen["body"])
        self.assertFalse(os.path.exists(seen["path"]), "config file must be removed afterwards")

    def test_retention_removes_only_old_backups_we_named(self):
        old = (datetime.now() - timedelta(days=45)).strftime("scdms_backup_%Y%m%d_%H%M%S.zip")
        new = (datetime.now() - timedelta(days=2)).strftime("scdms_backup_%Y%m%d_%H%M%S.zip")
        calls = []

        def fake_run(email, pw, args, timeout=600):
            calls.append(args)
            if args[0] == "ls":
                return f"{old}\n{new}\nholiday-photos.zip\n"
            return ""

        with mock.patch("tracker.mega_backup._run", side_effect=fake_run):
            removed = mega_backup.delete_old_backups("a@b.co", "pw", 30)
        self.assertEqual(removed, 1)
        rms = [c for c in calls if c[0] == "rm"]
        self.assertEqual(rms, [["rm", f"{mega_backup.BACKUP_FOLDER}/{old}"]])


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class MegaEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username="mega_admin", password="pass")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.client.force_authenticate(user=self.admin)
        p = mock.patch.dict(os.environ, {"BACKUP_CLOUD_ENCRYPTION_KEY": _KEY})
        p.start()
        self.addCleanup(p.stop)

    def test_connect_stores_password_encrypted_and_status_shows_it(self):
        with mock.patch("tracker.mega_backup.verify_login"):
            res = self.client.post("/api/backup/cloud/mega/connect/",
                                   {"email": "Backup@Example.com", "password": "pw-123"}, format="json")
        self.assertEqual(res.status_code, 200)
        conn = CloudBackupConnection.objects.get(provider="mega")
        self.assertEqual(conn.connected_email, "backup@example.com")
        self.assertNotIn("pw-123", conn.refresh_token_encrypted)
        self.assertEqual(crypto_utils.decrypt(conn.refresh_token_encrypted), "pw-123")
        status = self.client.get("/api/backup/cloud/status/").data
        self.assertEqual(status["mega"]["connected_email"], "backup@example.com")
        self.assertNotIn("pw-123", str(status))
        self.assertFalse(status["connected"])  # Google Drive state unchanged

    def test_wrong_password_is_rejected_and_nothing_saved(self):
        with mock.patch("tracker.mega_backup.verify_login", side_effect=mega_backup.MegaAuthError("bad")):
            res = self.client.post("/api/backup/cloud/mega/connect/",
                                   {"email": "a@b.co", "password": "nope"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertFalse(CloudBackupConnection.objects.filter(provider="mega").exists())

    def test_unreachable_mega_is_a_502_not_a_bad_password(self):
        with mock.patch("tracker.mega_backup.verify_login", side_effect=mega_backup.MegaNetworkError("down")):
            res = self.client.post("/api/backup/cloud/mega/connect/",
                                   {"email": "a@b.co", "password": "x"}, format="json")
        self.assertEqual(res.status_code, 502)

    def test_disconnect_clears_the_stored_password(self):
        with mock.patch("tracker.mega_backup.verify_login"):
            self.client.post("/api/backup/cloud/mega/connect/", {"email": "a@b.co", "password": "x"}, format="json")
        res = self.client.post("/api/backup/cloud/mega/disconnect/")
        self.assertEqual(res.status_code, 200)
        conn = CloudBackupConnection.objects.get(provider="mega")
        self.assertEqual(conn.status, "disconnected")
        self.assertEqual(conn.refresh_token_encrypted, "")

    def test_non_admin_cannot_connect(self):
        user = User.objects.create_user(username="plain", password="pass")
        Profile.objects.create(user=user, role=Role.PSC_OFFICER)
        c = APIClient(); c.force_authenticate(user=user)
        res = c.post("/api/backup/cloud/mega/connect/", {"email": "a@b.co", "password": "x"}, format="json")
        self.assertEqual(res.status_code, 403)


class MegaPushTaskTests(TestCase):
    def setUp(self):
        p = mock.patch.dict(os.environ, {"BACKUP_CLOUD_ENCRYPTION_KEY": _KEY})
        p.start()
        self.addCleanup(p.stop)
        self.tmp = tempfile.mkdtemp()
        p2 = mock.patch.dict(os.environ, {"BACKUP_DIR": self.tmp})
        p2.start()
        self.addCleanup(p2.stop)
        self.name = "scdms_backup_20261120_020000.zip"
        with open(os.path.join(self.tmp, self.name), "wb") as fh:
            fh.write(b"zip")

    def _connect(self):
        return CloudBackupConnection.objects.create(
            provider="mega", status="connected", connected_email="a@b.co",
            refresh_token_encrypted=crypto_utils.encrypt("pw"),
        )

    def test_noop_when_not_connected(self):
        from tracker.tasks import push_backup_to_mega
        with mock.patch("tracker.mega_backup.upload_backup_file") as up:
            push_backup_to_mega.apply(args=[self.name])
        up.assert_not_called()

    def test_successful_push_records_time_and_audit_entry(self):
        from tracker.models import AuditLog
        from tracker.tasks import push_backup_to_mega
        conn = self._connect()
        with mock.patch("tracker.mega_backup.upload_backup_file") as up, \
                mock.patch("tracker.mega_backup.delete_old_backups", return_value=0):
            push_backup_to_mega.apply(args=[self.name])
        up.assert_called_once()
        conn.refresh_from_db()
        self.assertIsNotNone(conn.last_pushed_at)
        self.assertTrue(AuditLog.objects.filter(resource_type="CloudBackupPush", resource_label=self.name,
                                                description__startswith="Backup pushed to MEGA").exists())

    def test_rejected_password_flips_to_needs_reconnect(self):
        from tracker.tasks import push_backup_to_mega
        conn = self._connect()
        with mock.patch("tracker.mega_backup.upload_backup_file", side_effect=mega_backup.MegaAuthError("bad pw")):
            push_backup_to_mega.apply(args=[self.name])
        conn.refresh_from_db()
        self.assertEqual(conn.status, "needs_reconnect")
        self.assertIn("bad pw", conn.last_push_error)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DeleteBackupAlsoDeletesMegaCopyTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="del_admin", password="pass")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.tmp = tempfile.mkdtemp()
        self.name = "scdms_backup_20260101_020000.zip"
        with open(os.path.join(self.tmp, self.name), "wb") as fh:
            fh.write(b"zip")
        p = mock.patch("tracker.views._BACKUP_DIR", self.tmp)
        p.start()
        self.addCleanup(p.stop)

    def test_mega_only_connection_still_queues_the_cloud_delete(self):
        CloudBackupConnection.objects.create(provider="mega", status="connected", connected_email="a@b.co")
        with mock.patch("tracker.tasks.queue_delete_backup_from_cloud") as q:
            res = self.client.post("/api/backup/delete-file/", {"filename": self.name}, format="json")
        self.assertEqual(res.status_code, 200)
        q.assert_called_once_with(self.name)

    def test_nothing_connected_queues_nothing(self):
        with mock.patch("tracker.tasks.queue_delete_backup_from_cloud") as q:
            self.client.post("/api/backup/delete-file/", {"filename": self.name}, format="json")
        q.assert_not_called()

    def test_status_says_whether_google_is_configured(self):
        with mock.patch.dict(os.environ, {"GOOGLE_CLIENT_ID": ""}):
            self.assertFalse(self.client.get("/api/backup/cloud/status/").data["google_configured"])
        with mock.patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "abc"}):
            self.assertTrue(self.client.get("/api/backup/cloud/status/").data["google_configured"])

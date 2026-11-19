"""Cloud backups are encrypted before upload: format, tamper detection, the
decrypt command, fail-closed behaviour, and both destinations."""
import io
import os
import struct
import tempfile
from unittest import mock

from cryptography.fernet import Fernet
from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase

from tracker import backup_crypto as bc, crypto_utils
from tracker.models import CloudBackupConnection

KEY = Fernet.generate_key().decode()
CLOUD_KEY = Fernet.generate_key().decode()
SECRET = b"personnel record: Mr X, disciplinary matter " * 50


class FormatTests(TestCase):
    def test_round_trip_across_several_chunks(self):
        data = os.urandom(10_000)
        out = io.BytesIO()
        n = bc.encrypt_stream(io.BytesIO(data), out, KEY, chunk_size=3000)
        self.assertEqual(n, 4)
        back = io.BytesIO()
        bc.decrypt_stream(io.BytesIO(out.getvalue()), back, KEY)
        self.assertEqual(back.getvalue(), data)

    def test_ciphertext_does_not_contain_the_plaintext(self):
        self.assertNotIn(b"disciplinary", bc.encrypt_bytes(SECRET, KEY))

    def test_wrong_key_is_rejected(self):
        with self.assertRaises(bc.BackupDecryptionError):
            bc.decrypt_bytes(bc.encrypt_bytes(SECRET, KEY), Fernet.generate_key().decode())

    def test_a_changed_byte_is_detected(self):
        blob = bytearray(bc.encrypt_bytes(SECRET, KEY))
        blob[60] ^= 1
        with self.assertRaises(bc.BackupDecryptionError):
            bc.decrypt_bytes(bytes(blob), KEY)

    def test_truncation_and_reordering_are_detected(self):
        out = io.BytesIO()
        bc.encrypt_stream(io.BytesIO(b"x" * 9000), out, KEY, chunk_size=3000)
        blob = out.getvalue()
        recs, pos = [], len(bc.MAGIC)
        while pos < len(blob):
            (size,) = struct.unpack(">I", blob[pos:pos + 4])
            recs.append(blob[pos:pos + 4 + size]); pos += 4 + size
        self.assertEqual(len(recs), 4)  # three chunks and the end record
        cut = bc.MAGIC + b"".join(recs[:-1])          # end record dropped
        swapped = bc.MAGIC + recs[1] + recs[0] + recs[2] + recs[3]
        short = bc.MAGIC + b"".join(recs[:2]) + recs[3]  # a chunk dropped
        for bad in (cut, swapped, short):
            with self.assertRaises(bc.BackupDecryptionError):
                bc.decrypt_bytes(bad, KEY)

    def test_not_a_backup_file(self):
        with self.assertRaises(bc.BackupDecryptionError):
            bc.decrypt_bytes(b"PK\x03\x04 plain zip", KEY)

    def test_no_key_fails_closed(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("BACKUP_ENCRYPTION_KEY", None)
            with self.assertRaises(bc.BackupEncryptionNotConfigured):
                bc.encrypt_bytes(b"x")

    def test_cloud_name(self):
        self.assertEqual(bc.cloud_name("scdms_backup_1.zip"), "scdms_backup_1.zip.enc")
        self.assertEqual(bc.cloud_name("scdms_backup_1.zip.enc"), "scdms_backup_1.zip.enc")


class DecryptCommandTests(TestCase):
    def test_command_restores_the_original_file(self):
        tmp = tempfile.mkdtemp()
        enc, out, keyf = (os.path.join(tmp, n) for n in ("a.zip.enc", "a.zip", "key.txt"))
        with open(enc, "wb") as fh:
            fh.write(bc.encrypt_bytes(SECRET, KEY))
        with open(keyf, "w") as fh:
            fh.write(KEY + "\n")
        call_command("decrypt_backup", enc, out, "--key-file", keyf, stdout=io.StringIO())
        self.assertEqual(open(out, "rb").read(), SECRET)


class PushTests(TestCase):
    def setUp(self):
        p = mock.patch.dict(os.environ, {"BACKUP_ENCRYPTION_KEY": KEY, "BACKUP_CLOUD_ENCRYPTION_KEY": CLOUD_KEY})
        p.start(); self.addCleanup(p.stop)
        self.tmp = tempfile.mkdtemp()
        p2 = mock.patch.dict(os.environ, {"BACKUP_DIR": self.tmp}); p2.start(); self.addCleanup(p2.stop)
        self.name = "scdms_backup_20261120_020000.zip"
        with open(os.path.join(self.tmp, self.name), "wb") as fh:
            fh.write(SECRET)

    def test_google_drive_receives_only_ciphertext_under_the_enc_name(self):
        from tracker.tasks import push_backup_to_cloud
        CloudBackupConnection.objects.create(
            provider="google_drive", status="connected", connected_email="a@b.co",
            access_token_encrypted=crypto_utils.encrypt("tok"), refresh_token_encrypted=crypto_utils.encrypt("ref"))
        seen = {}
        with mock.patch("tracker.google_drive_backup.upload_backup_file",
                        side_effect=lambda t, n, c: seen.update(name=n, content=c)), \
                mock.patch("tracker.google_drive_backup.delete_old_backups", return_value=0):
            push_backup_to_cloud.apply(args=[self.name])
        self.assertEqual(seen["name"], self.name + ".enc")
        self.assertNotIn(b"disciplinary", seen["content"])
        self.assertEqual(bc.decrypt_bytes(seen["content"], KEY), SECRET)

    def test_mega_receives_an_encrypted_file_named_enc(self):
        from tracker.tasks import push_backup_to_mega
        CloudBackupConnection.objects.create(
            provider="mega", status="connected", connected_email="a@b.co",
            refresh_token_encrypted=crypto_utils.encrypt("pw"))
        seen = {}

        def fake_upload(email, pw, path):
            seen["name"] = os.path.basename(path)
            seen["plain"] = bc.decrypt_bytes(open(path, "rb").read(), KEY)

        with mock.patch("tracker.mega_backup.upload_backup_file", side_effect=fake_upload), \
                mock.patch("tracker.mega_backup.delete_old_backups", return_value=0):
            push_backup_to_mega.apply(args=[self.name])
        self.assertEqual(seen["name"], self.name + ".enc")
        self.assertEqual(seen["plain"], SECRET)

    def test_missing_key_uploads_nothing_and_says_why(self):
        from tracker.tasks import push_backup_to_cloud
        CloudBackupConnection.objects.create(
            provider="google_drive", status="connected", connected_email="a@b.co",
            access_token_encrypted=crypto_utils.encrypt("tok"), refresh_token_encrypted=crypto_utils.encrypt("ref"))
        with mock.patch.dict(os.environ, {"BACKUP_ENCRYPTION_KEY": ""}), \
                mock.patch("tracker.google_drive_backup.upload_backup_file") as up:
            push_backup_to_cloud.apply(args=[self.name])
        up.assert_not_called()
        self.assertIn("BACKUP_ENCRYPTION_KEY", CloudBackupConnection.objects.get().last_push_error)

    def test_cloud_delete_removes_both_the_plain_and_the_encrypted_name(self):
        from tracker.tasks import delete_backup_from_cloud
        CloudBackupConnection.objects.create(
            provider="google_drive", status="connected", connected_email="a@b.co",
            access_token_encrypted=crypto_utils.encrypt("tok"), refresh_token_encrypted=crypto_utils.encrypt("ref"))
        with mock.patch("tracker.google_drive_backup.delete_backup_file", return_value=True) as d:
            delete_backup_from_cloud.apply(args=[self.name])
        self.assertEqual([c.args[1] for c in d.call_args_list], [self.name, self.name + ".enc"])

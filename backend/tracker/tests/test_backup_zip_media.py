"""Backup .zip format (data.json + media/) — backups now include every
submission-document attachment, not just DB rows. Covers the backup_db
command producing a real zip, restore extracting both the fixture and
media files, and the zip-slip/zip-bomb protections in backup_restore.py.
"""

import io
import json
import zipfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings

from tracker.backup_restore import BackupZipError, is_zip_content, validate_backup_zip
from tracker.models import Profile, Role


class BackupDbZipFormatTests(TestCase):
    def test_backup_db_produces_a_zip_file(self, tmp_path=None):
        import tempfile
        with tempfile.TemporaryDirectory() as backup_dir:
            filename = call_command("backup_db", "--dir", backup_dir)
            self.assertTrue(filename.endswith(".zip"))
            filepath = f"{backup_dir}/{filename}"
            with zipfile.ZipFile(filepath) as zf:
                names = zf.namelist()
                self.assertIn("data.json", names)


class ValidateBackupZipTests(TestCase):
    def _zip_bytes(self, entries: dict[str, bytes]) -> bytes:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            for name, content in entries.items():
                zf.writestr(name, content)
        return buf.getvalue()

    def test_is_zip_content_detects_zip_magic_bytes(self):
        self.assertTrue(is_zip_content(self._zip_bytes({"data.json": b"[]"})))
        self.assertFalse(is_zip_content(b'[{"model": "x"}]'))

    def test_valid_zip_with_media_extracts_correctly(self):
        raw = self._zip_bytes({
            "data.json": b'[{"model": "tracker.ministry", "pk": 1, "fields": {}}]',
            "media/submission_documents/1/file.pdf": b"pdf-bytes-here",
        })
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            fixture, media_members = validate_backup_zip(zf)
        self.assertEqual(fixture, b'[{"model": "tracker.ministry", "pk": 1, "fields": {}}]')
        self.assertEqual(media_members, [
            ("media/submission_documents/1/file.pdf", "submission_documents/1/file.pdf"),
        ])

    def test_missing_data_json_rejected(self):
        raw = self._zip_bytes({"media/x.pdf": b"x"})
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            with self.assertRaises(BackupZipError):
                validate_backup_zip(zf)

    def test_zip_slip_path_rejected(self):
        """A media member path that would escape MEDIA_ROOT on extraction."""
        raw = self._zip_bytes({
            "data.json": b"[]",
            "media/../../../etc/cron.d/evil": b"malicious",
        })
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            with self.assertRaises(BackupZipError):
                validate_backup_zip(zf)

    def test_too_many_members_rejected(self):
        entries = {"data.json": b"[]"}
        for i in range(5001):
            entries[f"media/f{i}.txt"] = b"x"
        raw = self._zip_bytes(entries)
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            with self.assertRaises(BackupZipError):
                validate_backup_zip(zf)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class RestoreFromZipEndpointTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.admin = User.objects.create_user(username="zip_admin", password="pass")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.client.force_authenticate(user=self.admin)

    def _zip_bytes(self, fixture_rows, media: dict[str, bytes] | None = None) -> bytes:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("data.json", json.dumps(fixture_rows))
            for rel_path, content in (media or {}).items():
                zf.writestr(f"media/{rel_path}", content)
        return buf.getvalue()

    def test_restore_from_zip_upload_restores_media_files(self, tmp_media_root=None):
        import tempfile
        rows = [{
            "model": "tracker.ministry", "pk": 999002,
            "fields": {"code": "ZIP-TEST", "name": "Zip Test Ministry", "created_at": "2026-01-01T00:00:00Z"},
        }]
        raw = self._zip_bytes(rows, {"profile_pics/test.png": b"fake-png-bytes"})

        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                f = SimpleUploadedFile("scdms_backup_20260101_000000.zip", raw, content_type="application/zip")
                res = self.client.post(
                    "/api/backup/restore/", {"file": f, "confirm": "RESTORE"}, format="multipart",
                )
                self.assertEqual(res.status_code, 200, res.data)
                self.assertIn("1 media file", res.data["detail"])

                import os
                restored_path = os.path.join(media_root, "profile_pics", "test.png")
                self.assertTrue(os.path.isfile(restored_path))
                with open(restored_path, "rb") as fh:
                    self.assertEqual(fh.read(), b"fake-png-bytes")

    def test_download_sets_zip_content_type(self):
        import os
        import tempfile
        from tracker import views as views_module

        with tempfile.TemporaryDirectory() as backup_dir:
            original = views_module._BACKUP_DIR
            views_module._BACKUP_DIR = backup_dir
            try:
                fn = "scdms_backup_20260101_000000.zip"
                with open(os.path.join(backup_dir, fn), "wb") as fh:
                    fh.write(self._zip_bytes([]))
                res = self.client.get(f"/api/backup/download/?filename={fn}")
                self.assertEqual(res.status_code, 200)
                self.assertEqual(res["Content-Type"], "application/zip")
            finally:
                views_module._BACKUP_DIR = original

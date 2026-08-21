"""Backup restore (P0-02, SCDMS Pre-Production Readiness Audit — Findings
Register): the endpoint used to pass an uploaded or stored file straight to
`loaddata` with no content validation and no confirmation step. These tests
lock in the fix: structural fixture validation, a required explicit
confirmation, and no raw exception text leaked to the client.
"""

import json

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tracker.models import Profile, Role

VALID_FIXTURE = json.dumps([
    {
        "model": "tracker.ministry",
        "pk": 999001,
        "fields": {
            "code": "P0-02-TEST", "name": "P0-02 Test Ministry",
            "created_at": "2026-01-01T00:00:00Z",
        },
    }
])


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class BackupRestoreTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username="p002_admin", password="pass")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.officer = User.objects.create_user(username="p002_officer", password="pass")
        Profile.objects.create(user=self.officer, role=Role.PSC_OFFICER)

    def test_non_manage_roles_user_rejected(self):
        self.client.force_authenticate(user=self.officer)
        res = self.client.post(
            "/api/backup/restore/",
            {"filename": "scdms_backup_whatever.json", "confirm": "RESTORE"},
        )
        self.assertEqual(res.status_code, 403)

    def test_upload_without_confirmation_rejected(self):
        self.client.force_authenticate(user=self.admin)
        f = SimpleUploadedFile("backup.json", VALID_FIXTURE.encode(), content_type="application/json")
        res = self.client.post("/api/backup/restore/", {"file": f}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertNotIn("Ministry", str(res.data))

    def test_upload_with_wrong_confirmation_rejected(self):
        self.client.force_authenticate(user=self.admin)
        f = SimpleUploadedFile("backup.json", VALID_FIXTURE.encode(), content_type="application/json")
        res = self.client.post(
            "/api/backup/restore/", {"file": f, "confirm": "yes please"}, format="multipart",
        )
        self.assertEqual(res.status_code, 400)

    def test_upload_non_json_rejected(self):
        self.client.force_authenticate(user=self.admin)
        f = SimpleUploadedFile("backup.json", b"not json at all", content_type="application/json")
        res = self.client.post(
            "/api/backup/restore/", {"file": f, "confirm": "RESTORE"}, format="multipart",
        )
        self.assertEqual(res.status_code, 400)

    def test_upload_wrong_shape_rejected(self):
        self.client.force_authenticate(user=self.admin)
        bad = json.dumps({"not": "a list of fixture rows"})
        f = SimpleUploadedFile("backup.json", bad.encode(), content_type="application/json")
        res = self.client.post(
            "/api/backup/restore/", {"file": f, "confirm": "RESTORE"}, format="multipart",
        )
        self.assertEqual(res.status_code, 400)

    def test_upload_unknown_model_rejected(self):
        self.client.force_authenticate(user=self.admin)
        bad = json.dumps([{"model": "tracker.not_a_real_model", "pk": 1, "fields": {}}])
        f = SimpleUploadedFile("backup.json", bad.encode(), content_type="application/json")
        res = self.client.post(
            "/api/backup/restore/", {"file": f, "confirm": "RESTORE"}, format="multipart",
        )
        self.assertEqual(res.status_code, 400)

    def test_valid_upload_with_confirmation_succeeds(self):
        self.client.force_authenticate(user=self.admin)
        f = SimpleUploadedFile("backup.json", VALID_FIXTURE.encode(), content_type="application/json")
        res = self.client.post(
            "/api/backup/restore/", {"file": f, "confirm": "RESTORE"}, format="multipart",
        )
        self.assertEqual(res.status_code, 200, res.data)

    def test_restore_failure_does_not_leak_exception_text(self):
        """A structurally-valid fixture that still fails at load time (e.g. a
        genuine integrity error) must not echo the raw exception back to the
        client — only a generic message, with detail logged server-side."""
        self.client.force_authenticate(user=self.admin)
        # References a real model/field name that will still raise inside
        # loaddata (invalid FK target) — proves the *runtime* failure path
        # (not just the structural pre-check) no longer leaks exception text.
        bad = json.dumps([
            {"model": "tracker.ministry", "pk": "not-an-integer-pk", "fields": {"code": "X", "name": "X"}}
        ])
        f = SimpleUploadedFile("backup.json", bad.encode(), content_type="application/json")
        res = self.client.post(
            "/api/backup/restore/", {"file": f, "confirm": "RESTORE"}, format="multipart",
        )
        self.assertEqual(res.status_code, 500)
        self.assertNotIn("Traceback", str(res.data))
        self.assertNotIn("DeserializationError", str(res.data))

    def test_stored_restore_requires_confirmation_too(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            "/api/backup/restore/", {"filename": "scdms_backup_20260101_000000.json"}, format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_restore_endpoint_has_dedicated_throttle(self):
        from tracker.views import BackupViewSet
        vs = BackupViewSet()
        vs.action = "restore"
        throttle_classes = [t.__class__.__name__ for t in vs.get_throttles()]
        self.assertIn("BackupRestoreThrottle", throttle_classes)

"""PSC Meeting No. 23 replica exercise: seed → Manager CSU uploads the signed
scan (and replaces it) → Secretary allocates → each decision lands with the
right unit manager → cleanup leaves nothing behind.
"""

from unittest import mock

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tracker.management.commands.seed_psc23_signing_exercise import ITEMS, MEETING_REF
from tracker.models import (
    CommissionTask,
    Meeting,
    Minutes,
    MinutesStatus,
    Profile,
    Role,
    Submission,
)

PREFIX = "TRAIN-PSC23-"


def _user(username, role):
    user = User.objects.create_user(username=username, password="pass", email=f"{username}@example.org")
    Profile.objects.create(user=user, role=role)
    return user


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class Psc23SigningExerciseTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        _user("p23_admin", Role.PSC_ADMIN)
        self.secretary = _user("p23_secretary", Role.PSC_SECRETARY)
        self.csu_manager = _user("p23_csu_mgr", Role.CSU_MANAGER)
        self.managers = {
            "csu": self.csu_manager,
            "hr": _user("p23_hr_mgr", Role.HR_UNIT_MANAGER),
            "vipam": _user("p23_vipam_mgr", Role.VIPAM_MANAGER),
            "compliance": _user("p23_compliance_mgr", Role.COMPLIANCE_MANAGER),
        }
        call_command("seed_psc23_signing_exercise", verbosity=0)
        self.minutes = Minutes.objects.get(meeting__reference_number=MEETING_REF)
        self.url = f"/api/minutes/{self.minutes.id}"

    def _upload(self, user, name="signed.pdf"):
        self.client.force_authenticate(user=user)
        scan = SimpleUploadedFile(name, b"%PDF-1.4 practice signed scan", content_type="application/pdf")
        return self.client.post(f"{self.url}/upload-signed/", {"signed_document": scan}, format="multipart")

    def test_seed_is_ready_for_signature_and_fires_nothing(self):
        self.assertEqual(self.minutes.status, MinutesStatus.AWAITING_SIGNATURE)
        self.assertEqual(len(self.minutes.content["agenda_items"]), len(ITEMS))
        self.assertEqual(CommissionTask.objects.count(), 0)
        self.assertEqual(
            Submission._base_manager.filter(reference_number__startswith=PREFIX, is_test=True).count(),
            len(ITEMS),
        )
        # Real decision numbers are kept on the minute items.
        titles = [b["title"] for b in self.minutes.content["agenda_items"]]
        self.assertTrue(any(t.startswith("03(n)-23-2026") for t in titles))

    def test_manager_csu_downloads_uploads_replaces_then_secretary_allocates(self):
        self.client.force_authenticate(user=self.csu_manager)
        res = self.client.get(f"{self.url}/")
        self.assertEqual(res.status_code, 200)
        # "Download for Signature": a real PDF of the minutes.
        res = self.client.get(f"{self.url}/pdf/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(b"".join(res.streaming_content if res.streaming else [res.content]).startswith(b"%PDF"))

        self.assertEqual(self._upload(self.csu_manager).status_code, 200)
        self.assertEqual(self._upload(self.csu_manager, "replacement.pdf").status_code, 200)
        self.assertEqual(self.client.get(f"{self.url}/signed-document/").status_code, 200)
        self.assertEqual(CommissionTask.objects.count(), 0)

        with mock.patch("tracker.decision_allocation.queue_post_signing_automation"):
            self.client.force_authenticate(user=self.secretary)
            res = self.client.post(f"{self.url}/allocate-tasks/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(CommissionTask.objects.count(), len(ITEMS))

        expected = {}
        for _no, _t, _c, unit, *_ in ITEMS:
            expected[unit] = expected.get(unit, 0) + 1
        for unit, count in expected.items():
            self.assertEqual(
                CommissionTask.objects.filter(assigned_manager=self.managers[unit]).count(), count, unit)

        scan_name = Minutes.objects.get(pk=self.minutes.pk).signed_document.name
        storage = self.minutes.signed_document.storage
        call_command("seed_psc23_signing_exercise", "--cleanup", verbosity=0)
        self.assertEqual(CommissionTask.objects.count(), 0)
        self.assertFalse(Meeting._base_manager.filter(reference_number=MEETING_REF).exists())
        self.assertFalse(Submission._base_manager.filter(reference_number__startswith=PREFIX).exists())
        self.assertFalse(storage.exists(scan_name))

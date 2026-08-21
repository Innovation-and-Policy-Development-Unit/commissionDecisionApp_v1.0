"""End-to-end walk through the Minutes lifecycle: minute-taker drafts and
submits for review, Secretary and Chairman independently approve, the
Secretary circulates to Commissioners for comment, a Commissioner comments
and returns them, the minute-taker sends for signature and uploads the
signed scan, and finally the Secretary explicitly allocates decision tasks.
"""

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tracker.models import Meeting, Minutes, MinutesStatus, Profile, Role


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class MinutesWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.meeting = Meeting.objects.create(
            title="Workflow Sitting", date="2026-09-01", time="09:00", venue="Boardroom",
        )
        self.taker = User.objects.create_user(username="wf_taker", password="pass")
        Profile.objects.create(user=self.taker, role=Role.SENIOR_ADMIN_OFFICER)
        self.secretary = User.objects.create_user(username="wf_secretary", password="pass")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)
        self.chairman = User.objects.create_user(username="wf_chairman", password="pass")
        Profile.objects.create(user=self.chairman, role=Role.CHAIRPERSON)
        self.commissioner = User.objects.create_user(username="wf_commissioner", password="pass")
        Profile.objects.create(user=self.commissioner, role=Role.PSC_COMMISSIONER)

        self.minutes = Minutes.objects.create(meeting=self.meeting, created_by=self.taker)

    def _post(self, user, path, data=None):
        self.client.force_authenticate(user=user)
        return self.client.post(f"/api/minutes/{self.minutes.id}/{path}/", data or {}, format="json")

    def test_full_lifecycle(self):
        res = self._post(self.taker, "submit-for-review")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], MinutesStatus.PENDING_SECRETARIAT_REVIEW)
        self.assertIsNotNone(res.data["review_due_at"])

        res = self._post(self.secretary, "secretariat-approve")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], MinutesStatus.PENDING_SECRETARIAT_REVIEW)
        self.assertIsNotNone(res.data["secretary_reviewed_at"])
        self.assertIsNone(res.data["chairman_reviewed_at"])

        res = self._post(self.chairman, "secretariat-approve")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], MinutesStatus.REVIEWED)

        res = self._post(self.secretary, "circulate-to-commissioners")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], MinutesStatus.CIRCULATED_TO_COMMISSIONERS)
        self.assertIsNotNone(res.data["commissioner_review_due_at"])

        res = self._post(self.commissioner, "comments", {"body": "Please correct the date in item 3."})
        self.assertEqual(res.status_code, 201, res.data)

        self.client.force_authenticate(user=self.secretary)
        res = self.client.get(f"/api/minutes/{self.minutes.id}/")
        self.assertEqual(len(res.data["comments"]), 1)
        self.assertEqual(res.data["comments"][0]["author_name"], "wf_commissioner")

        res = self._post(self.commissioner, "return-to-secretariat")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], MinutesStatus.RETURNED)

        res = self._post(self.taker, "mark-for-signature")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], MinutesStatus.AWAITING_SIGNATURE)

        self.client.force_authenticate(user=self.taker)
        scan = SimpleUploadedFile("signed.pdf", b"%PDF-1.4 fake", content_type="application/pdf")
        res = self.client.post(
            f"/api/minutes/{self.minutes.id}/upload-signed/",
            {"signed_document": scan}, format="multipart",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], MinutesStatus.SIGNED)
        self.assertIsNone(res.data["tasks_allocated_at"])

        # Task allocation is a separate, explicit Secretary action.
        res = self._post(self.commissioner, "allocate-tasks")
        self.assertEqual(res.status_code, 403)

        res = self._post(self.secretary, "allocate-tasks")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIsNotNone(res.data["tasks_allocated_at"])

        # Re-allocating is rejected, not silently repeated.
        res = self._post(self.secretary, "allocate-tasks")
        self.assertEqual(res.status_code, 400)

    def test_only_secretary_or_chairman_can_approve(self):
        self._post(self.taker, "submit-for-review")
        res = self._post(self.commissioner, "secretariat-approve")
        self.assertEqual(res.status_code, 403)

    def test_double_approval_by_same_role_rejected(self):
        self._post(self.taker, "submit-for-review")
        self._post(self.secretary, "secretariat-approve")
        res = self._post(self.secretary, "secretariat-approve")
        self.assertEqual(res.status_code, 400)

    def test_cannot_circulate_before_reviewed(self):
        res = self._post(self.secretary, "circulate-to-commissioners")
        self.assertEqual(res.status_code, 400)

    def test_only_senior_admin_officer_can_upload_signed(self):
        self.minutes.status = MinutesStatus.AWAITING_SIGNATURE
        self.minutes.save()
        self.client.force_authenticate(user=self.secretary)
        scan = SimpleUploadedFile("signed.pdf", b"%PDF-1.4 fake", content_type="application/pdf")
        res = self.client.post(
            f"/api/minutes/{self.minutes.id}/upload-signed/",
            {"signed_document": scan}, format="multipart",
        )
        self.assertEqual(res.status_code, 403)

"""The signed-minutes-to-tasks practice exercise, walked end to end:
seed → CSU uploads the signed scan → Secretary allocates → unit manager
assigns an officer → officer completes → cleanup leaves nothing behind.
"""

from unittest import mock

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tracker.management.commands.seed_decision_tasks_practice import MEETING_REF, PAPERS
from tracker.models import (
    CommissionTask,
    Meeting,
    Minutes,
    MinutesStatus,
    Profile,
    Role,
    RoleDefinition,
    Submission,
    SystemPermission,
    WorkflowStage,
)


def _user(username, role):
    user = User.objects.create_user(username=username, password="pass", email=f"{username}@example.org")
    Profile.objects.create(user=user, role=role)
    return user


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DecisionTasksPracticeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = _user("dt_admin", Role.PSC_ADMIN)
        self.secretary = _user("dt_secretary", Role.PSC_SECRETARY)
        self.csu_manager = _user("dt_csu_mgr", Role.CSU_MANAGER)
        self.csu_senior = _user("dt_csu_senior", Role.CSU_SENIOR)
        self.odu_manager = _user("dt_odu_mgr", Role.ODU_MANAGER)
        self.odu_senior = _user("dt_odu_senior", Role.ODU_SENIOR)
        self.hr_senior = _user("dt_hr_senior", Role.HR_UNIT_SENIOR)
        for name, role in (
            ("dt_vipam_mgr", Role.VIPAM_MANAGER),
            ("dt_hr_mgr", Role.HR_UNIT_MANAGER),
            ("dt_compliance_mgr", Role.COMPLIANCE_MANAGER),
        ):
            _user(name, role)
        # The permissions these roles hold in production (the test database
        # has no role definitions of its own).
        assign, _ = SystemPermission.objects.get_or_create(code="assign_task", defaults={"label": "assign_task"})
        work, _ = SystemPermission.objects.get_or_create(
            code="update_implementation", defaults={"label": "update_implementation"})
        for role, perms in (
            (Role.ODU_MANAGER, (assign, work)),
            (Role.ODU_SENIOR, (work,)),
            (Role.HR_UNIT_SENIOR, (work,)),
        ):
            definition, _ = RoleDefinition.objects.get_or_create(role=role)
            definition.permissions.add(*perms)
        call_command("seed_decision_tasks_practice", verbosity=0)
        self.minutes = Minutes.objects.get(meeting__reference_number=MEETING_REF)
        self.url = f"/api/minutes/{self.minutes.id}"

    def _upload(self, user, name="signed.pdf"):
        self.client.force_authenticate(user=user)
        scan = SimpleUploadedFile(name, b"%PDF-1.4 practice signed scan", content_type="application/pdf")
        return self.client.post(f"{self.url}/upload-signed/", {"signed_document": scan}, format="multipart")

    def test_seed_is_ready_for_signature_and_fires_nothing(self):
        self.assertEqual(self.minutes.status, MinutesStatus.AWAITING_SIGNATURE)
        self.assertEqual(len(self.minutes.content["agenda_items"]), len(PAPERS))
        self.assertEqual(CommissionTask.objects.count(), 0)
        self.assertEqual(
            Submission._base_manager.filter(reference_number__startswith="TRAIN-TASK-", is_test=True).count(),
            len(PAPERS),
        )

    def test_csu_senior_reaches_and_uploads_but_other_staff_cannot(self):
        # Out for signature: CSU Senior can open them, an ODU officer cannot.
        self.client.force_authenticate(user=self.csu_senior)
        self.assertEqual(self.client.get(f"{self.url}/").status_code, 200)
        self.client.force_authenticate(user=self.odu_senior)
        self.assertEqual(self.client.get(f"{self.url}/").status_code, 404)

        self.assertEqual(self._upload(self.odu_senior).status_code, 404)
        self.assertEqual(self._upload(self.secretary).status_code, 403)

        res = self._upload(self.csu_senior)
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], MinutesStatus.SIGNED)
        # She can check what she uploaded, and Manager CSU can replace it.
        self.assertEqual(self.client.get(f"{self.url}/signed-document/").status_code, 200)
        self.assertEqual(self._upload(self.csu_manager, "better.pdf").status_code, 200)

    def test_csu_senior_does_not_see_drafts(self):
        meeting = Meeting.objects.create(title="Draft sitting", date="2026-09-01", time="09:00", venue="Boardroom")
        draft = Minutes.objects.create(meeting=meeting, created_by=self.admin)
        self.client.force_authenticate(user=self.csu_senior)
        self.assertEqual(self.client.get(f"/api/minutes/{draft.id}/").status_code, 404)

    @mock.patch("tracker.decision_allocation.queue_post_signing_automation")
    def test_whole_exercise_then_cleanup(self, _queued):
        self.assertEqual(self._upload(self.csu_senior).status_code, 200)

        # Uploading alone allocates nothing; the Secretary's click does.
        self.assertEqual(CommissionTask.objects.count(), 0)
        self.client.force_authenticate(user=self.secretary)
        res = self.client.post(f"{self.url}/allocate-tasks/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(CommissionTask.objects.count(), len(PAPERS))

        task = CommissionTask.objects.get(submission__reference_number="TRAIN-TASK-001")
        self.assertEqual(task.assigned_manager, self.odu_manager)
        self.assertEqual(
            Submission._base_manager.filter(reference_number__startswith="TRAIN-TASK-")
            .exclude(current_stage=WorkflowStage.FORWARDED_TO_COMMISSION).count(),
            len(PAPERS),
        )

        # Managers see the whole register but can only assign their own tasks.
        hr_task = CommissionTask.objects.get(submission__reference_number="TRAIN-TASK-003")
        self.client.force_authenticate(user=self.odu_manager)
        res = self.client.post(
            f"/api/commission-tasks/{hr_task.id}/reassign/",
            {"assigned_staff_m2m": [self.hr_senior.id]}, format="json",
        )
        self.assertEqual(res.status_code, 403)
        res = self.client.post(
            f"/api/commission-tasks/{task.id}/reassign/",
            {"assigned_staff_m2m": [self.hr_senior.id]}, format="json",
        )
        self.assertEqual(res.status_code, 400)  # not an officer of this unit
        res = self.client.post(
            f"/api/commission-tasks/{task.id}/reassign/",
            {"assigned_staff_m2m": [self.odu_senior.id]}, format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)

        # Officer: works the task through to completed.
        self.client.force_authenticate(user=self.odu_senior)
        for status in ("in_progress", "completed"):
            res = self.client.patch(f"/api/commission-tasks/{task.id}/", {"status": status}, format="json")
            self.assertEqual(res.status_code, 200, res.data)
        task.refresh_from_db()
        self.assertEqual(task.status, "completed")

        scan_name = Minutes.objects.get(pk=self.minutes.pk).signed_document.name
        storage = self.minutes.signed_document.storage
        call_command("seed_decision_tasks_practice", "--cleanup", verbosity=0)
        self.assertEqual(CommissionTask.objects.count(), 0)
        self.assertFalse(Meeting._base_manager.filter(reference_number=MEETING_REF).exists())
        self.assertFalse(Submission._base_manager.filter(reference_number__startswith="TRAIN-TASK-").exists())
        self.assertFalse(storage.exists(scan_name))

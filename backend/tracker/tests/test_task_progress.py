"""Completing a decision task is logged, kept in step with the decision
register, and tells the people who allocated or manage it."""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tracker.models import (
    CommissionImplementationStatus,
    CommissionTask,
    CommissionTaskStatus,
    Notification,
    Profile,
    Role,
    SystemPermission,
    RoleDefinition,
)


def _user(username, role):
    user = User.objects.create_user(username=username, password="pass")
    Profile.objects.create(user=user, role=role)
    return user


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class TaskProgressTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.allocator = _user("tp_allocator", Role.PSC_ADMIN)
        self.manager = _user("tp_manager", Role.ODU_MANAGER)
        self.officer = _user("tp_officer", Role.ODU_SENIOR)
        work, _ = SystemPermission.objects.get_or_create(
            code="update_implementation", defaults={"label": "update_implementation"})
        assign, _ = SystemPermission.objects.get_or_create(
            code="assign_task", defaults={"label": "assign_task"})
        rd, _ = RoleDefinition.objects.get_or_create(role=Role.ODU_SENIOR)
        rd.permissions.add(work)
        rd, _ = RoleDefinition.objects.get_or_create(role=Role.ODU_MANAGER)
        rd.permissions.add(assign, work)
        self.task = CommissionTask.objects.create(
            title="Decision 1", assigned_manager=self.manager, created_by=self.allocator,
        )
        self.task.assigned_staff_m2m.add(self.officer)
        self.url = f"/api/commission-tasks/{self.task.id}/"

    def _patch(self, user, status):
        self.client.force_authenticate(user=user)
        return self.client.patch(self.url, {"status": status}, format="json")

    def test_completing_logs_syncs_register_and_notifies(self):
        res = self._patch(self.officer, CommissionTaskStatus.COMPLETED)
        self.assertEqual(res.status_code, 200, res.data)
        self.task.refresh_from_db()
        self.assertEqual(self.task.completed_by, self.officer)
        self.assertIsNotNone(self.task.completed_at)
        self.assertEqual(self.task.implementation_status, CommissionImplementationStatus.ACTIONED)
        log = self.task.status_updates.get()
        self.assertEqual(log.kind, "status")
        self.assertIn("Completed", log.body)
        who = set(Notification.objects.filter(title__startswith="Task completed").values_list(
            "recipient__username", flat=True))
        self.assertEqual(who, {"tp_manager", "tp_allocator"})

    def test_reopening_clears_completion(self):
        self._patch(self.officer, CommissionTaskStatus.COMPLETED)
        res = self._patch(self.manager, CommissionTaskStatus.IN_PROGRESS)
        self.assertEqual(res.status_code, 200, res.data)
        self.task.refresh_from_db()
        self.assertIsNone(self.task.completed_at)
        self.assertIsNone(self.task.completed_by)
        self.assertEqual(self.task.implementation_status, CommissionImplementationStatus.WITH_UNIT)
        self.assertEqual(self.task.status_updates.count(), 2)

    def test_same_status_writes_nothing(self):
        self._patch(self.officer, CommissionTaskStatus.OPEN)
        self.assertEqual(self.task.status_updates.count(), 0)
        self.assertEqual(Notification.objects.count(), 0)

    def test_comment_notifies_everyone_but_the_author(self):
        self.client.force_authenticate(user=self.officer)
        res = self.client.post(f"{self.url}status-updates/", {"body": "Letter drafted."}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        who = set(Notification.objects.filter(title__startswith="New update").values_list(
            "recipient__username", flat=True))
        self.assertEqual(who, {"tp_manager", "tp_allocator"})

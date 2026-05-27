from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase

from tracker.models import CommissionTask, Ministry, Profile, Role
from tracker.opsc_access import user_can_view_all_commission_tasks, user_can_work_commission_task
from tracker.views import _commission_task_queryset_for


class OpscCommissionAccessTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("sync_opsc_role_permissions", verbosity=0)

    def setUp(self):
        self.ministry, _ = Ministry.objects.get_or_create(
            code="OPSC",
            defaults={"name": "Office of the Public Service Commission"},
        )
        self.manager = User.objects.create_user("odu.mgr", password="x")
        Profile.objects.create(user=self.manager, role=Role.ODU_MANAGER, ministry=self.ministry)
        self.principal = User.objects.create_user("odu.prin", password="x")
        Profile.objects.create(user=self.principal, role=Role.ODU_PRINCIPAL, ministry=self.ministry)
        self.other_mgr = User.objects.create_user("hr.mgr", password="x")
        Profile.objects.create(user=self.other_mgr, role=Role.HR_UNIT_MANAGER, ministry=self.ministry)

        self.task = CommissionTask.objects.create(
            title="Test decision task",
            assigned_manager=self.manager,
            assigned_staff=self.principal,
            created_by=self.manager,
        )

    def test_manager_sees_all_tasks(self):
        qs = _commission_task_queryset_for(self.manager)
        self.assertEqual(qs.count(), CommissionTask.objects.count())

    def test_principal_sees_all_tasks(self):
        qs = _commission_task_queryset_for(self.principal)
        self.assertEqual(qs.count(), CommissionTask.objects.count())

    def test_manager_can_work_assigned_task(self):
        self.assertTrue(user_can_work_commission_task(self.manager, self.task))

    def test_other_manager_cannot_work_unassigned_task(self):
        other_task = CommissionTask.objects.create(
            title="HR task",
            assigned_manager=self.other_mgr,
            created_by=self.other_mgr,
        )
        self.assertFalse(user_can_work_commission_task(self.manager, other_task))

    def test_view_all_flag_for_unit_roles(self):
        self.assertTrue(user_can_view_all_commission_tasks(self.principal))

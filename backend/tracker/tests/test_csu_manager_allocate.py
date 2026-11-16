"""Manager CSU can allocate decision tasks once the seeded role carries the
``allocate_decision`` permission; roles without it still cannot."""

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tracker.models import Meeting, Minutes, MinutesStatus, Profile, Role


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class CsuManagerAllocateTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_tracker")

    def setUp(self):
        self.client = APIClient()
        meeting = Meeting.objects.create(
            title="Sitting", date="2026-09-01", time="09:00", venue="Boardroom",
        )
        taker = User.objects.create_user(username="al_taker", password="pass")
        Profile.objects.create(user=taker, role=Role.SENIOR_ADMIN_OFFICER)
        self.minutes = Minutes.objects.create(
            meeting=meeting, created_by=taker, status=MinutesStatus.SIGNED,
        )

    def _allocate(self, username, role):
        user = User.objects.create_user(username=username, password="pass")
        Profile.objects.create(user=user, role=role)
        self.client.force_authenticate(user=user)
        return self.client.post(f"/api/minutes/{self.minutes.id}/allocate-tasks/", {}, format="json")

    def test_csu_manager_can_allocate(self):
        res = self._allocate("al_csu", Role.CSU_MANAGER)
        self.assertEqual(res.status_code, 200, getattr(res, "data", None))
        self.assertIsNotNone(res.data["tasks_allocated_at"])

    def test_commissioner_cannot_allocate(self):
        res = self._allocate("al_comm", Role.PSC_COMMISSIONER)
        self.assertEqual(res.status_code, 403)

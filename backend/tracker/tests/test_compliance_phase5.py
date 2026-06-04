"""Phase 5 — case detail write actions: notes, litigation, stage updates."""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from ..compliance_actions import create_compliance_case
from ..compliance_models import CaseFamily, StageStatus
from ..models import Ministry, Profile, Role


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class CompliancePhase5Test(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        Ministry.objects.get_or_create(code="OPSC", defaults={"name": "Office of the PSC"})
        cls.manager = User.objects.create_user(username="p5_mgr", password="x")
        Profile.objects.update_or_create(user=cls.manager, defaults={"role": Role.COMPLIANCE_MANAGER})
        cls.ministry_user = User.objects.create_user(username="p5_hr", password="x")
        Profile.objects.update_or_create(user=cls.ministry_user, defaults={"role": Role.MINISTRY_HR})
        cls.case = create_compliance_case(
            creator=cls.manager, case_family=CaseFamily.EMPLOYEE_DISCIPLINARY, subject_name="S5",
        )

    def _c(self, user):
        c = APIClient(); c.force_authenticate(user); return c

    def test_add_note(self):
        r = self._c(self.manager).post(f"/api/compliance/cases/{self.case.id}/notes/", {"text": "Opened file"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(self.case.case_notes.count(), 1)

    def test_add_litigation(self):
        r = self._c(self.manager).post(f"/api/compliance/cases/{self.case.id}/litigation/", {
            "description": "Judicial review", "estimated_cost": "150000.00",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(self.case.litigation_records.count(), 1)

    def test_complete_stage_updates_status(self):
        stage = self.case.stages.order_by("stage_order").first()
        r = self._c(self.manager).post(f"/api/compliance/cases/{self.case.id}/stage/", {
            "stage_id": stage.id, "status": StageStatus.COMPLETED,
        }, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        stage.refresh_from_db()
        self.assertEqual(stage.status, StageStatus.COMPLETED)
        self.assertIsNotNone(stage.completed_at)

    def test_ministry_cannot_add_note(self):
        r = self._c(self.ministry_user).post(f"/api/compliance/cases/{self.case.id}/notes/", {"text": "x"}, format="json")
        self.assertEqual(r.status_code, 403)

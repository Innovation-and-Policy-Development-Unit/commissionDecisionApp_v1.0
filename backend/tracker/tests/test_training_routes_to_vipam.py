"""A ministry HR officer's training submission reaches VIPAM's Manager."""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..intake_routing import routed_unit_for_form_type
from ..models import FormCategory, Ministry, Profile, Role, Submission, WorkflowStage
from ..views import SubmissionViewSet


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class TrainingRoutesToVipamTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TRMIN", name="Training Ministry")
        self.cat = FormCategory.objects.get_or_create(code="training", defaults={"name": "Training"})[0]
        self.hr = User.objects.create_user("tr_hr", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.vipam_manager = User.objects.create_user("tr_vm", password="x")
        Profile.objects.create(user=self.vipam_manager, role=Role.VIPAM_MANAGER)
        self.hr_manager = User.objects.create_user("tr_hm", password="x")
        Profile.objects.create(user=self.hr_manager, role=Role.HR_UNIT_MANAGER)

    def _lodged(self, code):
        return Submission.objects.create(
            title=f"{code} lodged by ministry HR", form_category=self.cat, form_type_code=code,
            ministry=self.ministry, created_by=self.hr, received_at=timezone.now(),
            current_stage=WorkflowStage.SUBMITTED,
        )

    def test_both_training_forms_name_vipam(self):
        self.assertEqual(routed_unit_for_form_type("PSC 5-1"), "vipam")
        self.assertEqual(routed_unit_for_form_type("PSC 5-2"), "vipam")

    def test_lodging_reaches_vipam_managers_checklist_review(self):
        for code in ("PSC 5-1", "PSC 5-2"):
            sub = self._lodged(code)
            SubmissionViewSet()._auto_advance_submitted_to_checklist_review(sub)
            sub.refresh_from_db()
            self.assertEqual(sub.routed_unit, "vipam")
            self.assertEqual(sub.current_stage, WorkflowStage.MANAGER_CHECKLIST_REVIEW)
            client = APIClient()
            client.force_authenticate(user=self.vipam_manager)
            self.assertEqual(client.get(f"/api/submissions/{sub.id}/").status_code, 200)
            client.force_authenticate(user=self.hr_manager)
            self.assertEqual(client.get(f"/api/submissions/{sub.id}/").status_code, 404)

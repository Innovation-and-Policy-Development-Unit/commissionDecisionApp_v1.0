"""
The Director-General no longer approves papers in SCDMS: the DG signs the paper
on paper and Ministry HR uploads the signed copy, then submits straight to PSC.
"""
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import Ministry, Profile, Role, Submission, WorkflowStage


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DgRemovedFromWorkflowTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_DGR", name="DG Removed Ministry")
        self.hr = User.objects.create_user("dgr_hr", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.dg = User.objects.create_user("dgr_dg", password="x")
        Profile.objects.create(user=self.dg, role=Role.HEAD_OF_AGENCY, ministry=self.ministry)
        self.sub = Submission.objects.create(
            title="Establishment of a new post", ministry=self.ministry,
            form_type_code="TEST-NONE-XYZ", current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(), created_by=self.hr,
        )

    def _move(self, user, stage):
        client = APIClient()
        client.force_authenticate(user=user)
        return client.post(
            f"/api/submissions/{self.sub.id}/transition/", {"new_stage": stage}, format="json",
        )

    def test_hr_submits_a_draft_straight_to_psc(self):
        res = self._move(self.hr, "submitted")
        self.assertEqual(res.status_code, 200, res.content)
        self.sub.refresh_from_db()
        self.assertNotEqual(self.sub.current_stage, WorkflowStage.DRAFT)
        self.assertFalse(self.sub.events.filter(new_stage=WorkflowStage.PENDING_DG_ENDORSEMENT).exists())

    def test_hr_can_no_longer_send_a_draft_to_the_dg(self):
        res = self._move(self.hr, "pending_dg_endorsement")
        self.assertEqual(res.status_code, 403)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.DRAFT)

    def test_hr_transition_options_from_draft_exclude_the_dg(self):
        client = APIClient()
        client.force_authenticate(user=self.hr)
        res = client.get(f"/api/submissions/{self.sub.id}/allowed_transitions/")
        self.assertEqual(res.status_code, 200, res.content)
        allowed = res.data.get("allowed") or res.data.get("allowed_transitions") or []
        self.assertIn("submitted", allowed)
        self.assertNotIn("pending_dg_endorsement", allowed)

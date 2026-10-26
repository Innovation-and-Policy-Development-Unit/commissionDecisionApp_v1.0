"""
Sending a paper to the Director-General is off until the switch is on and the
ministry has exactly one active DG account with an email. HR can always submit
straight to PSC with the DG's paper approval attested (the fallback path).
"""
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import Ministry, Profile, Role, Submission, SystemSetting, WorkflowStage


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DgSendGatingTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_DGR", name="DG Gating Ministry")
        self.hr = User.objects.create_user("dgr_hr", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.dg = User.objects.create_user("dgr_dg", password="x", email="dg@ministry.gov.vu")
        Profile.objects.create(user=self.dg, role=Role.HEAD_OF_AGENCY, ministry=self.ministry)
        self.sub = Submission.objects.create(
            title="Establishment of a new post", ministry=self.ministry,
            form_type_code="TEST-NONE-XYZ", current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(), created_by=self.hr,
        )

    def _move(self, user, stage):
        client = APIClient()
        client.force_authenticate(user=user)
        body = {"new_stage": stage}
        if stage == "submitted":
            body.update(dg_approval_name="Mr. John Kalo", dg_approval_date=timezone.localdate().isoformat())
        return client.post(f"/api/submissions/{self.sub.id}/transition/", body, format="json")

    def _allowed(self):
        client = APIClient()
        client.force_authenticate(user=self.hr)
        res = client.get(f"/api/submissions/{self.sub.id}/allowed_transitions/")
        self.assertEqual(res.status_code, 200, res.content)
        return res.data.get("allowed") or res.data.get("allowed_transitions") or []

    def _switch(self, on=True, ministries=""):
        SystemSetting.objects.update_or_create(key="DG_EMAIL_APPROVAL_ENABLED", defaults={"value": "true" if on else "false"})
        SystemSetting.objects.update_or_create(key="DG_EMAIL_APPROVAL_MINISTRIES", defaults={"value": ministries})

    def test_hr_submits_a_draft_straight_to_psc(self):
        res = self._move(self.hr, "submitted")
        self.assertEqual(res.status_code, 200, res.content)
        self.sub.refresh_from_db()
        self.assertNotEqual(self.sub.current_stage, WorkflowStage.DRAFT)
        self.assertFalse(self.sub.events.filter(new_stage=WorkflowStage.PENDING_DG_ENDORSEMENT).exists())

    def test_send_to_dg_is_refused_while_the_switch_is_off(self):
        res = self._move(self.hr, "pending_dg_endorsement")
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn("not enabled", res.data["detail"])
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.DRAFT)

    def test_send_to_dg_is_hidden_while_the_switch_is_off(self):
        allowed = self._allowed()
        self.assertIn("submitted", allowed)
        self.assertNotIn("pending_dg_endorsement", allowed)

    def test_send_to_dg_is_offered_when_switch_is_on_and_a_dg_exists(self):
        self._switch()
        self.assertIn("pending_dg_endorsement", self._allowed())

    def test_ministry_allowlist_limits_the_feature(self):
        self._switch(ministries="OTHER")
        self.assertNotIn("pending_dg_endorsement", self._allowed())
        self._switch(ministries="zz_dgr")
        self.assertIn("pending_dg_endorsement", self._allowed())

    def test_no_dg_account_blocks_with_a_clear_message(self):
        self._switch()
        self.dg.is_active = False
        self.dg.save()
        res = self._move(self.hr, "pending_dg_endorsement")
        self.assertEqual(res.status_code, 400)
        self.assertIn("no active Director-General", res.data["detail"])

    def test_two_active_dgs_block(self):
        self._switch()
        other = User.objects.create_user("dgr_dg2", password="x", email="acting@ministry.gov.vu")
        Profile.objects.create(user=other, role=Role.HEAD_OF_AGENCY, ministry=self.ministry)
        res = self._move(self.hr, "pending_dg_endorsement")
        self.assertEqual(res.status_code, 400)
        self.assertIn("more than one", res.data["detail"])

    def test_dg_without_email_blocks(self):
        self._switch()
        self.dg.email = ""
        self.dg.save()
        res = self._move(self.hr, "pending_dg_endorsement")
        self.assertEqual(res.status_code, 400)
        self.assertIn("no email", res.data["detail"])

    def test_dg_cannot_start_the_step_on_a_draft(self):
        self._switch()
        res = self._move(self.dg, "pending_dg_endorsement")
        self.assertEqual(res.status_code, 403)

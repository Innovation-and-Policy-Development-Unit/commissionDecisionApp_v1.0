"""Secretary hold on a decision, and the responsible unit's sign-off of the AI brief."""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from datetime import timedelta
from unittest import mock

from .. import brief_review
from ..models import (
    FormCategory, Ministry, PSCFormType, Profile, Role, Submission,
    SystemSetting, WorkflowStage,
)
from ..minutes_review import commissioner_review_days


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DecisionHoldTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="TST-H", name="Test Ministry H")
        cat = FormCategory.objects.get_or_create(code="psc_3_6", defaults={"name": "PSC 3.6"})[0]
        self.secretary = User.objects.create_user("sec", password="x")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)
        self.admin = User.objects.create_user("adm", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.hr = User.objects.create_user("hr", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.sub = Submission.objects.create(
            title="Held paper", form_category=cat, form_type_code="PSC 3.6",
            ministry=self.ministry, received_at=timezone.now(), created_by=self.hr,
            current_stage=WorkflowStage.APPROVED,
            ai_letter_subject="s", ai_letter_content="body",
        )

    def _post(self, user, action, data=None):
        self.client.force_authenticate(user=user)
        return self.client.post(
            f"/api/submissions/{self.sub.id}/{action}/", data or {}, format="json")

    def test_only_secretary_can_hold_and_release(self):
        self.assertEqual(self._post(self.admin, "hold-decision", {"reason": "x"}).status_code, 403)
        self.assertEqual(self._post(self.hr, "hold-decision", {"reason": "x"}).status_code, 403)
        self.assertEqual(self._post(self.secretary, "hold-decision", {"reason": "Legal"}).status_code, 200)
        self.assertEqual(self._post(self.admin, "release-decision").status_code, 403)
        self.assertEqual(self._post(self.secretary, "release-decision").status_code, 200)

    def test_hold_needs_a_reason(self):
        self.assertEqual(self._post(self.secretary, "hold-decision", {"reason": "  "}).status_code, 400)

    def test_held_decision_cannot_be_served(self):
        self._post(self.secretary, "hold-decision", {"reason": "Awaiting legal advice"})
        resp = self._post(self.secretary, "serve-decision",
                          {"letter_subject": "s", "letter_body": "b"})
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(resp.json().get("on_hold"))

    def test_release_restarts_the_chase_window_and_clears_the_mark(self):
        self._post(self.secretary, "hold-decision", {"reason": "r"})
        self._post(self.secretary, "release-decision")
        self.sub.refresh_from_db()
        self.assertFalse(self.sub.decision_hold_active)
        self.assertIsNotNone(self.sub.decision_hold_released_at)

    def test_ministry_does_not_see_the_hold(self):
        self._post(self.secretary, "hold-decision", {"reason": "Sensitive"})
        self.client.force_authenticate(user=self.hr)
        resp = self.client.get(f"/api/submissions/{self.sub.id}/decision-service/")
        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(resp.json()["hold"])
        self.assertNotIn("Sensitive", resp.content.decode())

    def test_held_decision_is_not_chased(self):
        from ..tasks import remind_unserved_decisions

        self._post(self.secretary, "hold-decision", {"reason": "r"})
        remind_unserved_decisions()
        self.sub.refresh_from_db()
        self.assertIsNone(self.sub.decision_service_reminded_at)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class BriefReviewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="TST-B", name="Test Ministry B")
        cat = FormCategory.objects.get_or_create(code="psc_3_6", defaults={"name": "PSC 3.6"})[0]
        self.officer = User.objects.create_user("off", password="x")
        Profile.objects.create(user=self.officer, role=Role.HR_UNIT_SENIOR)
        self.other = User.objects.create_user("oth", password="x")
        Profile.objects.create(user=self.other, role=Role.HR_UNIT_SENIOR)
        self.manager = User.objects.create_user("mgr", password="x")
        Profile.objects.create(user=self.manager, role=Role.HR_UNIT_MANAGER)
        self.odu_mgr = User.objects.create_user("odu", password="x")
        Profile.objects.create(user=self.odu_mgr, role=Role.ODU_MANAGER)
        self.sub = Submission.objects.create(
            title="Briefed paper", form_category=cat, form_type_code="PSC 3.6",
            ministry=self.ministry, received_at=timezone.now(), created_by=self.officer,
            current_stage=WorkflowStage.UNDER_ASSESSMENT, routed_unit="hr",
            assigned_to=self.officer, ready_for_manager_at=timezone.now(),
            ai_brief_summary="Original AI text.", ai_brief_processed=True,
        )

    def _review(self, user, data=None):
        self.client.force_authenticate(user=user)
        return self.client.post(
            f"/api/submissions/{self.sub.id}/review-brief/", data or {}, format="json")

    def test_who_may_review(self):
        self.assertTrue(brief_review.can_review_brief(self.officer, self.sub))
        self.assertTrue(brief_review.can_review_brief(self.manager, self.sub))
        self.assertFalse(brief_review.can_review_brief(self.other, self.sub))
        self.assertFalse(brief_review.can_review_brief(self.odu_mgr, self.sub))
        self.assertIn(self._review(self.other).status_code, (403, 404))

    def test_confirm_as_written(self):
        self.assertTrue(brief_review.brief_review_pending(self.sub))
        self.assertEqual(self._review(self.officer).status_code, 200)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.ai_brief_reviewed_by, self.officer)
        self.assertFalse(self.sub.ai_brief_edited)
        self.assertEqual(self.sub.ai_brief_summary, "Original AI text.")

    def test_confirm_with_correction_replaces_text(self):
        self._review(self.officer, {"summary": "Corrected text."})
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.ai_brief_summary, "Corrected text.")
        self.assertTrue(self.sub.ai_brief_edited)

    def test_no_brief_means_nothing_to_review_and_no_block(self):
        self.sub.ai_brief_summary = "AI brief could not be generated: no key"
        self.sub.save()
        self.assertEqual(brief_review.blocker(self.sub), "")
        self.assertEqual(self._review(self.officer).status_code, 400)

    def test_unreviewed_brief_blocks_hand_off_to_secretary(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            f"/api/submissions/{self.sub.id}/transition/",
            {"new_stage": WorkflowStage.PENDING_SECRETARY_APPROVAL}, format="json")
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertTrue(resp.json().get("brief_review_required"), resp.content)

    def _submit_to_manager(self, user=None):
        self.client.force_authenticate(user=user or self.officer)
        return self.client.post(
            f"/api/submissions/{self.sub.id}/submit-to-manager/",
            {"assessment_html": "<p>Assessed.</p>"}, format="json")

    def test_unreviewed_brief_blocks_hand_back_at_assessment(self):
        resp = self._submit_to_manager()
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertTrue(resp.json().get("brief_review_required"), resp.content)

    def test_unreviewed_brief_blocks_hand_back_at_checklist_review(self):
        self.sub.current_stage = WorkflowStage.MANAGER_CHECKLIST_REVIEW
        self.sub.ready_for_manager_at = None
        self.sub.save(update_fields=["current_stage", "ready_for_manager_at"])
        resp = self._submit_to_manager()
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertTrue(resp.json().get("brief_review_required"), resp.content)
        self.sub.refresh_from_db()
        self.assertIsNone(self.sub.ready_for_manager_at)  # nothing was half-applied

    def test_reviewed_brief_lets_checklist_review_hand_back(self):
        self.sub.current_stage = WorkflowStage.MANAGER_CHECKLIST_REVIEW
        self.sub.ready_for_manager_at = None
        self.sub.save(update_fields=["current_stage", "ready_for_manager_at"])
        self.assertEqual(self._review(self.officer).status_code, 200)
        resp = self._submit_to_manager()
        self.assertFalse(resp.json().get("brief_review_required"), resp.content)
        self.assertEqual(resp.status_code, 200, resp.content)

    def test_no_brief_does_not_block_checklist_review_hand_back(self):
        self.sub.current_stage = WorkflowStage.MANAGER_CHECKLIST_REVIEW
        self.sub.ready_for_manager_at = None
        self.sub.ai_brief_processed = False
        self.sub.ai_brief_summary = ""
        self.sub.save(update_fields=["current_stage", "ready_for_manager_at",
                                     "ai_brief_processed", "ai_brief_summary"])
        resp = self._submit_to_manager()
        self.assertFalse(resp.json().get("brief_review_required"), resp.content)

    # ── a brief that is still being written ──────────────────────────────────
    def _brief_generating(self):
        self.sub.ai_brief_processed = False
        self.sub.ai_brief_summary = ""
        self.sub.save(update_fields=["ai_brief_processed", "ai_brief_summary"])

    def test_brief_still_generating_blocks_hand_back(self):
        self._brief_generating()
        with mock.patch("tracker.ai.claude_client.ai_enabled", return_value=True):
            resp = self._submit_to_manager()
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertTrue(resp.json().get("brief_review_required"), resp.content)
        self.assertIn("still being prepared", resp.json()["detail"])

    def test_brief_still_generating_blocks_manager_forwarding(self):
        self._brief_generating()
        self.client.force_authenticate(user=self.manager)
        with mock.patch("tracker.ai.claude_client.ai_enabled", return_value=True):
            resp = self.client.post(
                f"/api/submissions/{self.sub.id}/transition/",
                {"new_stage": WorkflowStage.PENDING_SECRETARY_APPROVAL}, format="json")
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertIn("still being prepared", resp.json()["detail"])

    def test_generating_brief_released_after_grace_period(self):
        self._brief_generating()
        Submission.objects.filter(pk=self.sub.pk).update(
            updated_at=timezone.now() - brief_review.GENERATION_GRACE - timedelta(minutes=1))
        self.sub.refresh_from_db()
        with mock.patch("tracker.ai.claude_client.ai_enabled", return_value=True):
            self.assertFalse(brief_review.brief_generation_pending(self.sub))
            self.assertEqual(brief_review.blocker(self.sub), "")

    def test_nothing_pending_when_ai_is_off(self):
        self._brief_generating()
        with mock.patch("tracker.ai.claude_client.ai_enabled", return_value=False):
            self.assertFalse(brief_review.brief_generation_pending(self.sub))
            self.assertEqual(brief_review.blocker(self.sub), "")

    def test_finished_brief_is_not_pending_generation(self):
        with mock.patch("tracker.ai.claude_client.ai_enabled", return_value=True):
            self.assertFalse(brief_review.brief_generation_pending(self.sub))

    def test_regenerating_clears_the_sign_off(self):
        self._review(self.officer)
        self.sub.refresh_from_db()
        self.sub.save(update_fields=brief_review.clear_review(self.sub))
        self.sub.refresh_from_db()
        self.assertIsNone(self.sub.ai_brief_reviewed_at)


class SeededDefaultsTests(TestCase):
    def test_commissioner_review_is_three_days(self):
        self.assertEqual(commissioner_review_days(), 3)

    def test_seo_report_type_routes_to_hr(self):
        ft = PSCFormType.objects.get(code="SEO-PA-REPORT")
        self.assertEqual(ft.routed_unit, "hr")
        self.assertTrue(ft.is_active)

    def test_seo_report_form_is_digitised_with_required_report_document(self):
        from ..models import PSCFormField, RequiredDocument

        ft = PSCFormType.objects.get(code="SEO-PA-REPORT")
        self.assertTrue(ft.is_digitized)
        fields = PSCFormField.objects.filter(form_type=ft)
        keys = set(fields.values_list("field_key", flat=True))
        self.assertEqual(len(keys), fields.count())  # no duplicate keys
        for needed in ("purpose", "issue", "compliance_rate", "recommendation", "result_by_ministry"):
            self.assertIn(needed, keys)
        self.assertTrue(fields.filter(field_type="section_header", start_new_page=True).exists())
        self.assertTrue(RequiredDocument.objects.filter(form_type=ft).exists())

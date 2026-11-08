"""Business Plan and Corporate Plan: the same two documents and automatic AI review as the Annual Report."""

from datetime import datetime
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..ai import annual_report_review as ar
from ..models import (
    DocumentOcrStatus, Ministry, Profile, ReportAIReview, Role, RoutedUnit, Submission,
    SubmissionDocument, WorkflowStage,
)
from ..submission_checklist import resolve_required_documents


def _user(name, role, **kw):
    u = User.objects.create_user(name, password="x")
    Profile.objects.create(user=u, role=role, **kw)
    return u


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _fake_ai(period=None):
    """Chunk call: every criterion met. Reports ``period`` as (start, end) when asked for it."""

    def fake(system, user, tier="haiku", max_tokens=0):
        if "ONE PART" in system:
            keys = [line.split("key=")[1].split(":")[0] for line in user.splitlines() if line.startswith("- key=")]
            out = {"items": {k: {"status": "met", "evidence": "quote", "note": "there"} for k in keys}}
            if "plan_period" in system and period:
                out["plan_period"] = {"start_year": period[0], "end_year": period[1], "evidence": "Corporate Plan"}
            return out, None
        return {"summary": "Complete.", "recommendation": "accept"}, None

    return fake


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class PlanReviewTests(TestCase):
    def setUp(self):
        from django.core.management import call_command

        call_command("seed_report_checklists", verbosity=0)
        self.ministry = Ministry.objects.create(code="MP", name="Ministry P")
        self.hr = _user("hr_pl", Role.MINISTRY_HR, ministry=self.ministry)
        self.odu = _user("odu_pl", Role.ODU_PRINCIPAL)

    def _sub(self, code, received=datetime(2026, 2, 20, 9, 0), ref="SUB-PL-1"):
        return Submission.objects.create(
            reference_number=ref, title=f"{code} 2026", form_type_code=code,
            ministry=self.ministry, current_stage=WorkflowStage.MANAGER_CHECKLIST_REVIEW,
            routed_unit=RoutedUnit.ODU, assigned_to=self.odu, created_by=self.hr,
            received_at=timezone.make_aware(received),
        )

    def _doc(self, sub, text="Plan text. " * 40):
        return SubmissionDocument.objects.create(
            submission=sub, original_name="plan.pdf", extracted_text=text,
            ocr_status=DocumentOcrStatus.COMPLETED, uploaded_by=self.hr,
        )

    # ── required documents ──
    def test_business_plan_asks_for_the_cover_letter_and_the_plan_only(self):
        names = list(resolve_required_documents(self._sub("BUSINESS-PLAN")).order_by("order").values_list("name", flat=True))
        self.assertEqual(names, ["Signed Cover Letter by Director General", "Business Plan (copy)"])

    def test_corporate_plan_asks_for_the_cover_letter_and_the_plan_only(self):
        names = list(resolve_required_documents(self._sub("CORPORATE-PLAN")).order_by("order").values_list("name", flat=True))
        self.assertEqual(names, ["Signed Cover Letter by Director General", "Corporate Plan (copy)"])

    # ── guideline coverage ──
    def test_every_checklist_item_has_its_own_guideline_wording(self):
        for code in ("BUSINESS-PLAN", "CORPORATE-PLAN"):
            profile = ar.profile_for(code)
            for item in ar.checklist_items(profile):
                self.assertIn(item["key"], profile.guidelines, f"{code}: {item['key']}")

    def test_items_that_belong_to_the_submission_form_are_not_put_to_the_ai(self):
        for code in ("BUSINESS-PLAN", "CORPORATE-PLAN"):
            keys = {i["key"] for i in ar.checklist_items(ar.profile_for(code))}
            self.assertFalse(keys & {"issue_check", "discussion_check", "recommendation_check"}, code)

    def test_corporate_checklist_has_the_five_year_item(self):
        keys = {i["key"] for i in ar.checklist_items(ar.profile_for("CORPORATE-PLAN"))}
        self.assertIn("plan_five_year_check", keys)

    # ── deadline ──
    def test_business_plan_is_late_after_28_february(self):
        on_time = self._sub("BUSINESS-PLAN", datetime(2026, 2, 28, 9, 0))
        self.assertFalse(ar.late_info(on_time)["late"])
        late = self._sub("BUSINESS-PLAN", datetime(2026, 3, 10, 9, 0), ref="SUB-PL-2")
        info = ar.late_info(late)
        self.assertTrue(info["late"])
        self.assertEqual(info["days_late"], 10)
        self.assertEqual(info["deadline_text"], "28 February")

    def test_corporate_plan_has_no_deadline(self):
        info = ar.late_info(self._sub("CORPORATE-PLAN", datetime(2026, 12, 1, 9, 0)))
        self.assertFalse(info["late"])
        self.assertIsNone(info["deadline"])

    def test_annual_report_deadline_is_unchanged(self):
        info = ar.late_info(self._sub("ANNUAL-REPORT", datetime(2026, 4, 10, 9, 0)))
        self.assertEqual((info["late"], info["days_late"], info["deadline_text"]), (True, 10, "31 March"))

    # ── review ──
    def _review(self, code, period=None):
        sub = self._sub(code)
        self._doc(sub)
        with patch.object(ar, "complete_json_with_error", _fake_ai(period)), patch.object(ar, "ai_enabled", lambda: True):
            return sub, *ar.review_report(sub)

    def test_a_five_year_corporate_plan_passes_the_period_check(self):
        _, result, err = self._review("CORPORATE-PLAN", period=(2026, 2030))
        self.assertIsNone(err)
        self.assertTrue(result["plan_period"]["five_years"])
        self.assertEqual(result["items"]["plan_five_year_check"]["status"], "met")
        self.assertEqual(result["recommendation"], "accept")

    def test_a_three_year_corporate_plan_is_flagged_and_never_a_clean_pass(self):
        _, result, _ = self._review("CORPORATE-PLAN", period=(2026, 2028))
        self.assertEqual(result["plan_period"]["years"], 3)
        self.assertFalse(result["plan_period"]["five_years"])
        item = result["items"]["plan_five_year_check"]
        self.assertEqual(item["status"], "not_found")
        self.assertIn("five years", item["note"])
        self.assertEqual(result["recommendation"], "accept_with_follow_up")

    def test_a_missing_period_is_reported_as_not_found(self):
        _, result, _ = self._review("CORPORATE-PLAN", period=None)
        self.assertFalse(result["plan_period"]["found"])
        self.assertEqual(result["items"]["plan_five_year_check"]["status"], "not_found")

    def test_the_model_cannot_decide_the_five_year_verdict_itself(self):
        # Years in the wrong order or out of range are ignored, not trusted.
        self.assertFalse(ar._plan_period({"start_year": 2030, "end_year": 2026})["found"])
        self.assertFalse(ar._plan_period({"start_year": "2026", "end_year": 2030})["found"])
        self.assertFalse(ar._plan_period({"start_year": 1, "end_year": 5})["found"])

    def test_business_plan_review_has_no_period_check(self):
        _, result, err = self._review("BUSINESS-PLAN")
        self.assertIsNone(err)
        self.assertIsNone(result["plan_period"])
        self.assertNotIn("plan_five_year_check", result["items"])
        self.assertEqual(result["total"], len(ar.checklist_items(ar.profile_for("BUSINESS-PLAN"))))

    def test_other_form_types_get_no_review(self):
        sub = self._sub("HALF-YEARLY-REPORT")
        with patch.object(ar, "ai_enabled", lambda: True):
            result, err = ar.review_report(sub)
        self.assertIsNone(result)
        self.assertIn("no AI review", err)

    # ── task, submit hook and screen ──
    def test_task_reviews_a_corporate_plan_and_names_it_to_the_officer(self):
        from ..models import Notification
        from ..tasks import review_annual_report_task

        sub = self._sub("CORPORATE-PLAN")
        self._doc(sub)
        with patch.object(ar, "complete_json_with_error", _fake_ai((2026, 2030))), patch.object(ar, "ai_enabled", lambda: True):
            review_annual_report_task.apply(args=[sub.id])
        self.assertEqual(ReportAIReview.objects.get(submission=sub).state, "done")
        self.assertTrue(Notification.objects.filter(recipient=self.odu, title="AI review of the Corporate Plan is ready").exists())

    def test_task_ignores_papers_that_are_not_reviewed_types(self):
        from ..tasks import review_annual_report_task

        sub = self._sub("HALF-YEARLY-REPORT")
        review_annual_report_task.apply(args=[sub.id])
        self.assertFalse(ReportAIReview.objects.filter(submission=sub).exists())

    def test_screen_payload_names_the_document_and_carries_the_period(self):
        sub = self._sub("CORPORATE-PLAN")
        ReportAIReview.objects.create(
            submission=sub, state="done",
            result={"counts": {"met": 1}, "plan_period": {"found": True, "years": 5, "five_years": True,
                                                         "start_year": 2026, "end_year": 2030}},
        )
        resp = _client(self.odu).get(f"/api/submission-checklists/ensure/?submission={sub.id}")
        self.assertEqual(resp.status_code, 200)
        review = resp.json()["ai_review"]
        self.assertEqual(review["label"], "Corporate Plan")
        self.assertEqual(review["guideline_name"], "Ministry Corporate Plan Guideline")
        self.assertTrue(review["plan_period"]["five_years"])

    def test_odu_can_rerun_the_review_for_a_business_plan_and_the_ministry_cannot(self):
        sub = self._sub("BUSINESS-PLAN")
        with patch("tracker.tasks.review_annual_report_task.delay") as delay:
            self.assertEqual(_client(self.hr).post("/api/submission-checklists/ai-review/", {"submission": sub.id}).status_code, 403)
            ok = _client(self.odu).post("/api/submission-checklists/ai-review/", {"submission": sub.id})
        self.assertEqual(ok.status_code, 202)
        delay.assert_called_once_with(sub.id)

    def test_rerun_is_refused_for_other_form_types(self):
        sub = self._sub("QUARTERLY-REPORT")
        resp = _client(self.odu).post("/api/submission-checklists/ai-review/", {"submission": sub.id})
        self.assertEqual(resp.status_code, 400)

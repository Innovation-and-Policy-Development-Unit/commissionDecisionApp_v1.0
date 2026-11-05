"""Annual Report: two required documents, and an automatic AI first-pass review for ODU."""

from datetime import datetime
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..ai import annual_report_review as ar
from ..models import (
    DocumentOcrStatus, Ministry, Profile, PSCFormField, PSCFormType, ReportAIReview, Role,
    RoutedUnit, Submission, SubmissionDocument, WorkflowStage,
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


def _fake_ai(system, user, tier="haiku", max_tokens=0):
    """Chunk call: first three criteria met, the rest absent. Summary call: a note."""
    if "ONE PART" in system:
        keys = [line.split("key=")[1].split(":")[0] for line in user.splitlines() if line.startswith("- key=")]
        return {"items": {
            k: ({"status": "met", "evidence": "quote", "note": "there"} if i < 3
                else {"status": "not_found", "evidence": "", "note": ""})
            for i, k in enumerate(keys)
        }}, None
    return {"summary": "Mostly missing.", "recommendation": "return_for_clarification"}, None


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class AnnualReportReviewTests(TestCase):
    def setUp(self):
        from django.core.management import call_command

        call_command("seed_report_checklists", verbosity=0)
        self.ministry = Ministry.objects.create(code="MA", name="Ministry A")
        self.hr = _user("hr_ar", Role.MINISTRY_HR, ministry=self.ministry)
        self.odu = _user("odu_ar", Role.ODU_PRINCIPAL)
        self.sub = Submission.objects.create(
            reference_number="SUB-AR-1", title="Annual Report 2025", form_type_code="ANNUAL-REPORT",
            ministry=self.ministry, current_stage=WorkflowStage.MANAGER_CHECKLIST_REVIEW,
            routed_unit=RoutedUnit.ODU, assigned_to=self.odu, created_by=self.hr,
            received_at=timezone.make_aware(datetime(2026, 3, 20, 9, 0)),
        )

    def _doc(self, text="Minister's statement. " * 40, ocr=DocumentOcrStatus.COMPLETED):
        return SubmissionDocument.objects.create(
            submission=self.sub, original_name="report.pdf", extracted_text=text,
            ocr_status=ocr, uploaded_by=self.hr,
        )

    def test_ministry_is_asked_for_the_cover_letter_and_the_report_only(self):
        names = list(resolve_required_documents(self.sub).order_by("order").values_list("name", flat=True))
        self.assertEqual(names, ["Signed Cover Letter by Director General", "Annual Report (copy)"])

    def test_checklist_covers_the_financial_statements(self):
        keys = set(PSCFormField.objects.filter(form_type__code="ANNUAL-REPORT-CHECKLIST").values_list("field_key", flat=True))
        self.assertTrue({"fin_representation_check", "fin_appropriation_check",
                         "fin_expense_summary_check", "fin_commitments_check", "leave_accrual_check"} <= keys)

    def test_every_checklist_item_has_a_guideline_requirement(self):
        for item in ar.checklist_items():
            self.assertIn(item["key"], ar.GUIDELINE, item["key"])

    def test_lateness_is_measured_from_31_march(self):
        self.assertFalse(ar.late_info(self.sub)["late"])
        self.sub.received_at = timezone.make_aware(datetime(2026, 4, 10, 9, 0))
        info = ar.late_info(self.sub)
        self.assertTrue(info["late"])
        self.assertEqual(info["days_late"], 10)

    def test_review_merges_findings_and_recommends(self):
        self._doc()
        with patch.object(ar, "complete_json_with_error", _fake_ai), patch.object(ar, "ai_enabled", lambda: True):
            result, err = ar.review_report(self.sub)
        self.assertIsNone(err)
        self.assertEqual(result["counts"]["met"], 3)
        self.assertEqual(result["recommendation"], "return_for_clarification")
        self.assertEqual(result["total"], len(ar.checklist_items()))

    def test_a_report_with_no_readable_text_is_not_judged_empty(self):
        self._doc(text="")
        with patch.object(ar, "ai_enabled", lambda: True):
            result, err = ar.review_report(self.sub)
        self.assertIsNone(result)
        self.assertIn("readable text", err)

    def test_task_stores_result_and_tells_the_allocated_officer(self):
        from ..models import Notification
        from ..tasks import review_annual_report_task

        self._doc()
        with patch.object(ar, "complete_json_with_error", _fake_ai), patch.object(ar, "ai_enabled", lambda: True):
            review_annual_report_task.apply(args=[self.sub.id])
        review = ReportAIReview.objects.get(submission=self.sub)
        self.assertEqual(review.state, "done")
        self.assertTrue(Notification.objects.filter(recipient=self.odu, title__icontains="AI review").exists())

    def test_task_failure_is_recorded_not_left_running(self):
        from ..tasks import review_annual_report_task

        self._doc()
        with patch.object(ar, "ai_enabled", lambda: False):
            review_annual_report_task.apply(args=[self.sub.id])
        review = ReportAIReview.objects.get(submission=self.sub)
        self.assertEqual(review.state, "failed")
        self.assertTrue(review.error)

    def test_review_reaches_the_checklist_screen_for_odu_but_never_the_ministry(self):
        ReportAIReview.objects.create(submission=self.sub, state="done", result={"counts": {"met": 1}})
        resp = _client(self.odu).get(f"/api/submission-checklists/ensure/?submission={self.sub.id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["ai_review"]["state"], "done")
        # The ministry is not allowed on the checklist at all.
        self.assertIn(_client(self.hr).get(f"/api/submission-checklists/ensure/?submission={self.sub.id}").status_code, (403, 404))

    def test_only_odu_reviewers_can_rerun_the_review(self):
        with patch("tracker.tasks.review_annual_report_task.delay") as delay:
            self.assertEqual(_client(self.hr).post("/api/submission-checklists/ai-review/", {"submission": self.sub.id}).status_code, 403)
            ok = _client(self.odu).post("/api/submission-checklists/ai-review/", {"submission": self.sub.id})
        self.assertEqual(ok.status_code, 202)
        delay.assert_called_once_with(self.sub.id)

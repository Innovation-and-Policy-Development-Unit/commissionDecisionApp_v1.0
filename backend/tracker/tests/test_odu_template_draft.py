"""AI first draft of the text of ODU's own papers on the general template."""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..ai import odu_template_draft as dr
from ..models import (
    Department, Ministry, Profile, ReportAIReview, Role, RoutedUnit, Submission, SubmissionDocument,
    WorkflowStage,
)
from ..odu_consolidation import cover_all


def _user(name, role, **kw):
    u = User.objects.create_user(name, password="x")
    Profile.objects.create(user=u, role=role, **kw)
    return u


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


GOOD = {
    "subject": "Business Plans 2026: ODU assessment",
    "issue": "The Commission is asked to note the Business Plans lodged for 2026.",
    "discussion": "Two ministries lodged. One was late. The first-pass review suggests gaps in the cash flow.",
    "recommendation": "It is recommended that the Public Service Commission note the plans and decide on the late one.",
    "ministries_of_concern": [{"ministry": "Ministry B", "reason": "Lodged late and cash flow missing"}, {"ministry": " "}, 5],
}


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class OduTemplateDraftTests(TestCase):
    def setUp(self):
        opm = Ministry.objects.create(code="OPM", name="Ministry of the Prime Minister")
        Department.objects.create(ministry=opm, code="OPSC", name="Office of the Public Service Commission")
        self.ma = Ministry.objects.create(code="MA", name="Ministry A")
        self.mb = Ministry.objects.create(code="MB", name="Ministry B")
        self.senior = _user("td_senior", Role.ODU_SENIOR)
        self.principal = _user("td_principal", Role.ODU_PRINCIPAL)
        self.hr = _user("td_hr", Role.MINISTRY_HR, ministry=self.ma)
        self.other_unit = _user("td_hr_unit", Role.HR_UNIT_MANAGER)

    def _plan(self, ministry, received, with_review=True):
        sub = Submission.objects.create(
            reference_number=f"SUB-TD-{ministry.code}", title=f"{ministry.name} Business Plan", form_type_code="BUSINESS-PLAN",
            ministry=ministry, current_stage=WorkflowStage.NOTED, routed_unit=RoutedUnit.ODU, received_at=received,
            created_by=self.hr,
        )
        if with_review:
            ReportAIReview.objects.create(submission=sub, state="done", result={
                "summary": "The cash flow forecast is missing.", "recommendation": "return_for_clarification",
                "counts": {"met": 20, "partial": 3, "not_found": 9}, "total": 32,
                "items": {"cashflow_matrix_check": {"status": "not_found"}, "kpis_check": {"status": "met"}},
            })
        return sub

    def _paper(self, code="ODU-BUSINESS-PLANS", title="Business Plans 2026"):
        res = _client(self.senior).post("/api/submissions/", {
            "title": title, "form_type_code": code, "received_at": timezone.now().isoformat(),
        }, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        return Submission.objects.get(pk=res.data["id"])

    def _attach_text(self, paper, text="ODU assessment: overall plans are weak on cash flow."):
        SubmissionDocument.objects.create(submission=paper, original_name="assessment.pdf", extracted_text=text, uploaded_by=self.senior)

    def _on_time(self):
        return timezone.make_aware(timezone.datetime(timezone.now().year, 2, 20, 9, 0))

    def _late(self):
        return timezone.make_aware(timezone.datetime(timezone.now().year, 3, 10, 9, 0))

    # ── what the AI is given ──
    def test_the_material_has_every_ministry_its_lateness_and_its_first_pass_review(self):
        paper = self._paper()
        self._plan(self.ma, self._on_time())
        self._plan(self.mb, self._late())
        self._attach_text(paper)
        material, based_on = dr.build_context(paper)
        self.assertIn("Ministry A", material)
        self.assertIn("Ministry B", material)
        self.assertIn("LATE by 10 day(s) after 28 February", material)
        self.assertIn("The cash flow forecast is missing.", material)
        self.assertNotIn("kpis_check", material)
        self.assertIn("overall plans are weak on cash flow", material)
        self.assertEqual((based_on["ministries"], based_on["attachment_read"]), (2, True))

    def test_the_material_names_ministries_not_ready_to_go_up(self):
        paper = self._paper()
        self._plan(self.ma, self._on_time())
        Submission.objects.create(
            reference_number="SUB-TD-W", title="w", form_type_code="BUSINESS-PLAN", ministry=self.mb,
            current_stage=WorkflowStage.MANAGER_CHECKLIST_REVIEW, received_at=self._on_time(), created_by=self.hr)
        material, _ = dr.build_context(paper)
        self.assertIn("Not ready to go up yet", material)
        self.assertIn("Ministry B", material)

    def test_test_papers_and_waiting_plans_are_not_drafted_as_covered(self):
        paper = self._paper()
        plan = self._plan(self.ma, self._on_time())
        plan.is_test = True
        plan.save()
        material, based_on = dr.build_context(paper)
        self.assertIsNone(material)
        self.assertEqual(based_on["ministries"], 0)

    def test_the_performance_report_is_drafted_from_its_attachment_only(self):
        paper = self._paper("ODU-OPA-FEEDBACK-REPORT", "Org performance 2026")
        self.assertIsNone(dr.build_context(paper)[0])
        self._attach_text(paper, "Ministry X scored 41 percent overall; Ministry Y scored 88 percent.")
        material, based_on = dr.build_context(paper)
        self.assertIn("Ministry X scored 41 percent", material)
        self.assertEqual(based_on["ministries"], 0)

    def test_the_draft_is_cleaned_and_junk_dropped(self):
        out = dr._sanitize(GOOD)
        self.assertEqual(out["ministries_of_concern"], [{"ministry": "Ministry B", "reason": "Lodged late and cash flow missing"}])
        self.assertEqual(dr._sanitize("nonsense"), {})

    # ── what each plan says ──
    DIGEST = {"headline": "Grow rural health access.", "period": "2026 to 2030",
              "priorities": ["Rural clinics", "Staff housing"], "targets": ["20 new clinics"],
              "budget_staffing": "VT 2.1 billion", "notable": []}

    def _digest(self, plan):
        r, _ = ReportAIReview.objects.get_or_create(submission=plan)
        r.plan_digest = dict(self.DIGEST)
        r.save()

    def test_the_material_carries_what_each_plan_says_and_never_claims_odu_assessed_it(self):
        paper = self._paper()
        plan = self._plan(self.ma, self._on_time(), with_review=False)
        self._digest(plan)
        material, _ = dr.build_context(paper)
        self.assertIn("Grow rural health access.", material)
        self.assertIn("20 new clinics", material)
        self.assertIn("VT 2.1 billion", material)
        self.assertIn("did NOT assess", dr.SYSTEM)

    def test_the_draft_lists_the_plans_received_for_the_discussion(self):
        paper = self._paper()
        plan = self._plan(self.ma, self._on_time(), with_review=False)
        self._digest(plan)
        with patch.object(dr, "ai_enabled", lambda: True), patch.object(dr, "complete_json_with_error", return_value=(GOOD, None)):
            draft, _, err = dr.draft_template(paper)
        self.assertIsNone(err)
        self.assertEqual(draft["plans"][0]["ministry"], "Ministry A")
        self.assertEqual(draft["plans"][0]["priorities"], ["Rural clinics", "Staff housing"])
        self.assertIn("Plans received:", draft["plans_text"])
        self.assertIn("period 2026 to 2030", draft["plans_text"])

    def test_the_digest_task_stores_the_summary_and_keeps_the_review(self):
        from ..ai import plan_digest as pd
        from ..tasks import digest_plan_task

        plan = self._plan(self.ma, self._on_time())
        SubmissionDocument.objects.create(submission=plan, original_name="plan.pdf", extracted_text="Our plan.", uploaded_by=self.hr)
        with patch.object(pd, "ai_enabled", lambda: True), patch.object(pd, "complete_json_with_error", return_value=(self.DIGEST, None)):
            digest_plan_task.apply(args=[plan.id])
        review = ReportAIReview.objects.get(submission=plan)
        self.assertEqual(review.plan_digest["priorities"], ["Rural clinics", "Staff housing"])
        self.assertEqual(review.state, "done")  # the first-pass review is untouched

    def test_a_failed_digest_is_recorded_and_does_not_break_the_draft(self):
        from ..ai import plan_digest as pd

        paper = self._paper()
        plan = self._plan(self.ma, self._on_time(), with_review=False)
        with patch.object(pd, "ai_enabled", lambda: False):
            dr.ensure_digests(paper)
        self.assertIn("error", ReportAIReview.objects.get(submission=plan).plan_digest)
        material, _ = dr.build_context(paper)
        self.assertIn("Ministry A", material)

    def test_acknowledging_a_plan_queues_its_summary(self):
        manager = _user("td_manager", Role.ODU_MANAGER)
        plan = self._plan(self.ma, self._on_time(), with_review=False)
        plan.current_stage = WorkflowStage.MANAGER_CHECKLIST_REVIEW
        plan.save()
        with patch("tracker.tasks.digest_plan_task.delay") as delay:
            with self.captureOnCommitCallbacks(execute=True):
                res = _client(manager).post(f"/api/submissions/{plan.id}/transition/",
                                            {"new_stage": "noted", "remarks": "Received."}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        delay.assert_called_once_with(plan.id)

    # ── the task ──
    def test_the_task_stores_the_draft_beside_the_paper_and_never_in_it(self):
        from ..tasks import draft_odu_template_task

        paper = self._paper()
        self._plan(self.ma, self._on_time())
        with patch.object(dr, "ai_enabled", lambda: True), patch.object(dr, "complete_json_with_error", return_value=(GOOD, None)):
            draft_odu_template_task.apply(args=[paper.id])
        review = ReportAIReview.objects.get(submission=paper)
        self.assertEqual(review.state, "done")
        self.assertEqual(review.result["draft"]["subject"], GOOD["subject"])
        self.assertFalse(hasattr(paper, "dynamic_form_response") and getattr(paper, "dynamic_form_response", None))

    def test_nothing_to_draft_from_is_told_plainly_and_not_retried(self):
        from ..tasks import draft_odu_template_task

        paper = self._paper()
        with patch.object(dr, "ai_enabled", lambda: True), patch.object(dr, "complete_json_with_error") as ai:
            draft_odu_template_task.apply(args=[paper.id])
        ai.assert_not_called()
        review = ReportAIReview.objects.get(submission=paper)
        self.assertEqual(review.state, "failed")
        self.assertIn("nothing to draft from", review.error)

    def test_a_provider_failure_shows_a_plain_message_and_not_the_raw_error(self):
        from ..tasks import draft_odu_template_task

        paper = self._paper()
        self._plan(self.ma, self._on_time())
        with patch.object(dr, "ai_enabled", lambda: True), \
             patch.object(dr, "complete_json_with_error", return_value=(None, "Gemini API HTTP 404: model not found")):
            draft_odu_template_task.apply(args=[paper.id])
        review = ReportAIReview.objects.get(submission=paper)
        self.assertEqual(review.state, "failed")
        self.assertNotIn("404", review.error)
        self.assertIn("try again", review.error.lower())

    def test_the_task_ignores_other_papers(self):
        from ..tasks import draft_odu_template_task

        plan = self._plan(self.ma, self._on_time())
        draft_odu_template_task.apply(args=[plan.id])
        self.assertEqual(ReportAIReview.objects.get(submission=plan).state, "done")  # its own first-pass review, untouched

    # ── the endpoints ──
    def test_odu_can_ask_and_read_the_draft(self):
        paper = self._paper()
        self._plan(self.ma, self._on_time())
        with patch("tracker.tasks.draft_odu_template_task.delay") as delay:
            res = _client(self.senior).post(f"/api/submissions/{paper.id}/ai-template-draft/run/")
        self.assertEqual(res.status_code, 202, res.content)
        delay.assert_called_once_with(paper.id)
        got = _client(self.principal).get(f"/api/submissions/{paper.id}/ai-template-draft/")
        self.assertEqual(got.status_code, 200)
        self.assertEqual(got.data["state"], "running")
        self.assertIn("edit", got.data["disclaimer"])

    def test_a_second_request_while_one_is_running_is_not_queued_again(self):
        paper = self._paper()
        ReportAIReview.objects.create(submission=paper, state="running")
        with patch("tracker.tasks.draft_odu_template_task.delay") as delay:
            res = _client(self.senior).post(f"/api/submissions/{paper.id}/ai-template-draft/run/")
        self.assertEqual(res.status_code, 202)
        delay.assert_not_called()

    def test_it_is_not_offered_for_other_papers_stages_or_people(self):
        plan = self._plan(self.ma, self._on_time())
        self.assertEqual(_client(self.principal).post(f"/api/submissions/{plan.id}/ai-template-draft/run/").status_code, 400)
        paper = self._paper()
        self.assertEqual(_client(self.hr).get(f"/api/submissions/{paper.id}/ai-template-draft/").status_code, 404)
        # another unit's manager cannot even see ODU's internal paper
        self.assertIn(_client(self.other_unit).post(f"/api/submissions/{paper.id}/ai-template-draft/run/").status_code, (403, 404))
        Submission.objects.filter(pk=paper.pk).update(current_stage=WorkflowStage.PENDING_SECRETARY_APPROVAL)
        self.assertEqual(_client(self.senior).post(f"/api/submissions/{paper.id}/ai-template-draft/run/").status_code, 400)

    def test_a_paper_that_was_never_drafted_reads_as_empty(self):
        paper = self._paper()
        got = _client(self.senior).get(f"/api/submissions/{paper.id}/ai-template-draft/")
        self.assertEqual((got.data["state"], got.data["draft"]), ("", None))

    def test_lateness_uses_the_vanuatu_date_not_the_utc_date(self):
        # 8am on 1 March in Vanuatu is 9pm on 28 February in UTC: it is late, by one day.
        from ..ai.annual_report_review import late_info
        year = timezone.now().year
        plan = self._plan(self.ma, timezone.make_aware(timezone.datetime(year, 3, 1, 8, 0)))
        info = late_info(plan)
        self.assertEqual((info["late"], info["days_late"]), (True, 1))

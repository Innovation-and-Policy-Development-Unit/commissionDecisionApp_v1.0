"""ODU's consolidated papers: one paper per type covering every ministry plan or report ODU noted."""

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    Department, Ministry, PSCFormType, Profile, RequiredDocument, Role, RoutedUnit, Submission,
    WorkflowStage,
)
from ..odu_consolidation import consolidation_gaps, coverage_payload, cover_all, ready_to_cover, waiting
from ..submission_checklist import resolve_required_documents
from ..transitions import iter_allowed_targets

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
ATTACHMENT = "Attachment (ODU assessment report or other supporting document)"


def _user(name, role, **kw):
    u = User.objects.create_user(name, password="x")
    Profile.objects.create(user=u, role=role, **kw)
    return u


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class ConsolidatedPaperTests(TestCase):
    def setUp(self):
        self.opm = Ministry.objects.create(code="OPM", name="Ministry of the Prime Minister")
        Department.objects.create(ministry=self.opm, code="OPSC", name="Office of the Public Service Commission")
        self.ma = Ministry.objects.create(code="MA", name="Ministry A")
        self.mb = Ministry.objects.create(code="MB", name="Ministry B")
        self.senior = _user("cp_senior", Role.ODU_SENIOR)
        self.principal = _user("cp_principal", Role.ODU_PRINCIPAL)
        self.manager = _user("cp_manager", Role.ODU_MANAGER)
        self.hr_a = _user("cp_hr_a", Role.MINISTRY_HR, ministry=self.ma)

    def _plan(self, ministry, stage=WorkflowStage.NOTED, code="BUSINESS-PLAN", ref=None, **kw):
        ref = ref or f"SUB-{code[:2]}-{ministry.code}-{stage[:4]}"
        return Submission.objects.create(
            reference_number=ref, title=f"{ministry.name} {code}", form_type_code=code, ministry=ministry,
            current_stage=stage, routed_unit=RoutedUnit.ODU, assigned_to=self.principal,
            received_at=kw.pop("received_at", timezone.now()), created_by=self.hr_a, **kw,
        )

    _n = 0

    def _paper(self, code="ODU-BUSINESS-PLANS", user=None):
        type(self)._n += 1  # the system refuses two open papers with the same title
        res = _client(user or self.senior).post("/api/submissions/", {
            "title": f"Ministry plans 2027: ODU assessment ({type(self)._n})", "form_type_code": code,
            "received_at": timezone.now().isoformat(),
        }, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        return Submission.objects.get(pk=res.data["id"])

    def _attach(self, user, paper):
        slot = RequiredDocument.objects.get(form_type__code=paper.form_type_code, name=ATTACHMENT)
        return _client(user).post(
            f"/api/submissions/{paper.id}/documents/",
            {"file": SimpleUploadedFile("assessment.pdf", PDF, "application/pdf"), "required_document": slot.id},
            format="multipart",
        )

    def _move(self, user, sub, stage):
        return _client(user).post(f"/api/submissions/{sub.id}/transition/",
                                  {"new_stage": stage, "remarks": "See comments."}, format="json")

    # ── the types ──
    def test_three_consolidated_types_use_the_general_template_and_one_open_attachment(self):
        for code, agenda in (("ODU-BUSINESS-PLANS", "business_plan"), ("ODU-CORPORATE-PLANS", "corporate_plan"),
                             ("ODU-ANNUAL-REPORTS", "annual_report")):
            ft = PSCFormType.objects.get(code=code)
            self.assertEqual((ft.routed_unit, ft.agenda_category, ft.is_digitized), ("odu", agenda, True), code)
            keys = {f.field_key for f in ft.fields.exclude(field_type="section_header")}
            self.assertEqual(keys, {"subject", "issue", "discussion", "recommendation"})
            self.assertEqual(list(RequiredDocument.objects.filter(form_type=ft, is_active=True).values_list("name", flat=True)), [ATTACHMENT])

    def test_ministries_send_the_cover_letter_and_the_plan_with_no_form_to_complete(self):
        for code in ("ANNUAL-REPORT", "BUSINESS-PLAN", "CORPORATE-PLAN"):
            self.assertFalse(PSCFormType.objects.get(code=code).is_digitized, code)
        names = list(resolve_required_documents(self._plan(self.ma, WorkflowStage.DRAFT, ref="SUB-X-1")).order_by("order").values_list("name", flat=True))
        self.assertEqual(names, ["Signed Cover Letter by Director General", "Business Plan (copy)"])

    def test_odu_creates_the_consolidated_papers_as_internal_odu_papers(self):
        for user in (self.senior, self.principal, self.manager):
            paper = self._paper(user=user)
            self.assertTrue(paper.is_internal)
            self.assertEqual((paper.routed_unit, paper.current_stage), ("odu", WorkflowStage.DRAFT))

    # ── the ministry plan ends at ODU as Noted ──
    def test_the_manager_can_note_a_ministry_plan_but_not_send_it_to_the_secretary(self):
        targets = iter_allowed_targets(Role.ODU_MANAGER, WorkflowStage.MANAGER_CHECKLIST_REVIEW, form_type_code="BUSINESS-PLAN")
        self.assertIn(WorkflowStage.NOTED, targets)
        self.assertNotIn(WorkflowStage.PENDING_SECRETARY_APPROVAL, targets)

    def test_other_papers_are_unchanged_the_manager_still_sends_them_to_the_secretary(self):
        targets = iter_allowed_targets(Role.ODU_MANAGER, WorkflowStage.MANAGER_CHECKLIST_REVIEW, form_type_code="PSC 2-2")
        self.assertIn(WorkflowStage.PENDING_SECRETARY_APPROVAL, targets)
        self.assertNotIn(WorkflowStage.NOTED, targets)

    def test_noting_a_plan_closes_it_at_odu(self):
        plan = self._plan(self.ma, WorkflowStage.MANAGER_CHECKLIST_REVIEW, ref="SUB-NOTE-1",
                          ready_for_manager_at=timezone.now())  # the Principal has handed it back
        from ..submission_checklist import ensure_submission_checklist_items
        ensure_submission_checklist_items(plan)
        plan.checklist_items.update(is_present=True)  # ODU has confirmed the documents are there
        res = self._move(self.manager, plan, WorkflowStage.NOTED)
        self.assertEqual(res.status_code, 200, res.content)
        plan.refresh_from_db()
        self.assertEqual(plan.current_stage, WorkflowStage.NOTED)

    def test_the_manager_cannot_send_a_plan_to_the_secretary(self):
        plan = self._plan(self.ma, WorkflowStage.MANAGER_CHECKLIST_REVIEW, ref="SUB-NOTE-2")
        self.assertEqual(self._move(self.manager, plan, WorkflowStage.PENDING_SECRETARY_APPROVAL).status_code, 403)

    # ── ODU only acknowledges receipt of Business and Corporate Plans ──
    def test_the_manager_can_only_acknowledge_a_business_or_corporate_plan(self):
        for code in ("BUSINESS-PLAN", "CORPORATE-PLAN"):
            for role in (Role.ODU_MANAGER, Role.PSC_ADMIN):
                self.assertEqual(
                    iter_allowed_targets(role, WorkflowStage.MANAGER_CHECKLIST_REVIEW, form_type_code=code),
                    [WorkflowStage.NOTED], (role, code),
                )

    def test_an_annual_report_is_still_reviewed_before_it_is_noted(self):
        targets = iter_allowed_targets(Role.ODU_MANAGER, WorkflowStage.MANAGER_CHECKLIST_REVIEW, form_type_code="ANNUAL-REPORT")
        self.assertIn(WorkflowStage.NOTED, targets)
        self.assertGreater(len(targets), 1)  # not acknowledge-only: other routes remain open

    def test_acknowledging_needs_no_principal_review_and_no_checklist(self):
        # Assigned to a principal who never handed it back, documents not ticked: still acknowledged.
        plan = self._plan(self.ma, WorkflowStage.MANAGER_CHECKLIST_REVIEW, code="CORPORATE-PLAN", ref="SUB-ACK-1")
        res = self._move(self.manager, plan, WorkflowStage.NOTED)
        self.assertEqual(res.status_code, 200, res.content)
        plan.refresh_from_db()
        self.assertEqual(plan.current_stage, WorkflowStage.NOTED)

    def test_the_manager_cannot_return_a_plan_to_the_ministry(self):
        plan = self._plan(self.ma, WorkflowStage.MANAGER_CHECKLIST_REVIEW, ref="SUB-ACK-2")
        self.assertEqual(self._move(self.manager, plan, WorkflowStage.RETURNED_FOR_CLARIFICATION).status_code, 403)

    # ── the receipt due date opens the paper ──
    def test_the_paper_waits_for_its_own_receipt_due_date(self):
        import datetime
        from unittest import mock

        self._plan(self.ma, WorkflowStage.NOTED, code="CORPORATE-PLAN", ref="SUB-DUE-1")
        paper = self._paper("ODU-CORPORATE-PLANS")
        year = timezone.localdate().year
        with mock.patch.dict("os.environ", {"ODU_RECEIPT_DUE_CORPORATE_PLAN": "12-31"}):
            gaps = consolidation_gaps(paper)
            self.assertEqual(len(gaps), 1)
            self.assertIn(f"31 December {year}", gaps[0])
            self.assertFalse(coverage_payload(paper)["receipt_due_passed"])
            with mock.patch("django.utils.timezone.localdate", return_value=datetime.date(year + 1, 1, 1)):
                self.assertEqual(consolidation_gaps(paper), [])
        with mock.patch.dict("os.environ", {"ODU_RECEIPT_DUE_CORPORATE_PLAN": "01-01"}):
            self.assertEqual(consolidation_gaps(paper), [])  # passed long ago

    def test_the_two_plan_types_have_different_due_dates(self):
        from ..odu_consolidation import receipt_due_date
        self.assertEqual(receipt_due_date("BUSINESS-PLAN", 2027).isoformat(), "2027-02-28")
        self.assertIsNone(receipt_due_date("CORPORATE-PLAN", 2027))

    # ── coverage ──
    def test_noted_plans_are_ready_to_be_covered_and_unnoted_ones_hold_the_paper_up(self):
        paper = self._paper()
        self._plan(self.ma, WorkflowStage.NOTED)
        self._plan(self.mb, WorkflowStage.MANAGER_CHECKLIST_REVIEW)
        self.assertEqual(ready_to_cover(paper).count(), 1)
        self.assertEqual(waiting(paper).count(), 1)
        gaps = consolidation_gaps(paper)
        self.assertEqual(len(gaps), 1)
        self.assertIn("Ministry B", gaps[0])

    def test_a_plan_back_with_its_ministry_for_clarification_also_holds_it_up(self):
        paper = self._paper()
        self._plan(self.ma, WorkflowStage.NOTED)
        self._plan(self.mb, WorkflowStage.RETURNED_FOR_CLARIFICATION)
        self.assertTrue(consolidation_gaps(paper))

    def test_drafts_and_recalled_papers_have_not_been_lodged_so_they_do_not_hold_it_up(self):
        paper = self._paper()
        self._plan(self.ma, WorkflowStage.NOTED)
        self._plan(self.mb, WorkflowStage.DRAFT, ref="SUB-D-1")
        self._plan(self.mb, WorkflowStage.RECALLED, ref="SUB-D-2")
        self.assertEqual(consolidation_gaps(paper), [])

    def test_test_papers_neither_hold_it_up_nor_join_it(self):
        paper = self._paper()
        self._plan(self.ma, WorkflowStage.NOTED)
        self._plan(self.mb, WorkflowStage.MANAGER_CHECKLIST_REVIEW, is_test=True, ref="SUB-T-1")
        self.assertEqual(consolidation_gaps(paper), [])

    def test_a_paper_with_nothing_to_cover_cannot_go_up(self):
        self.assertIn("no noted", consolidation_gaps(self._paper())[0])

    def test_only_the_covered_type_counts(self):
        paper = self._paper("ODU-BUSINESS-PLANS")
        self._plan(self.ma, WorkflowStage.NOTED, code="BUSINESS-PLAN", ref="SUB-BP-1")
        self._plan(self.mb, WorkflowStage.MANAGER_CHECKLIST_REVIEW, code="CORPORATE-PLAN", ref="SUB-CP-1")
        self.assertEqual(consolidation_gaps(paper), [])

    # ── going up ──
    def test_the_paper_goes_up_when_every_lodged_plan_is_noted_and_covers_them(self):
        paper = self._paper()
        plan_a = self._plan(self.ma, WorkflowStage.NOTED)
        plan_b = self._plan(self.mb, WorkflowStage.NOTED)
        self.assertEqual(self._attach(self.senior, paper).status_code, 201)
        res = self._move(self.senior, paper, WorkflowStage.PENDING_PRINCIPAL_REVIEW)
        self.assertEqual(res.status_code, 200, res.content)
        plan_a.refresh_from_db(); plan_b.refresh_from_db()
        self.assertEqual((plan_a.consolidated_into_id, plan_b.consolidated_into_id), (paper.id, paper.id))

    def test_it_will_not_go_up_while_a_lodged_plan_is_still_with_odu(self):
        paper = self._paper()
        self._plan(self.ma, WorkflowStage.NOTED)
        late_one = self._plan(self.mb, WorkflowStage.MANAGER_CHECKLIST_REVIEW)
        self.assertEqual(self._attach(self.senior, paper).status_code, 201)
        res = self._move(self.senior, paper, WorkflowStage.PENDING_PRINCIPAL_REVIEW)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Ministry B", res.data["detail"])
        self.assertTrue(res.data["consolidation_gaps"])
        late_one.refresh_from_db()
        self.assertIsNone(late_one.consolidated_into_id)  # nothing was linked by the refused attempt

    def test_it_still_needs_its_attachment(self):
        paper = self._paper()
        self._plan(self.ma, WorkflowStage.NOTED)
        res = self._move(self.senior, paper, WorkflowStage.PENDING_PRINCIPAL_REVIEW)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Attachment", res.data["detail"])

    def test_a_plan_noted_after_the_paper_went_up_waits_for_the_next_paper(self):
        first = self._paper()
        self._plan(self.ma, WorkflowStage.NOTED)
        cover_all(first)
        late = self._plan(self.mb, WorkflowStage.NOTED)
        second = self._paper()
        self.assertEqual(list(ready_to_cover(second)), [late])
        self.assertEqual(len(covered_ids(first)), 1)
        self.assertNotIn(late.id, covered_ids(first))

    # ── the screen ──
    def test_the_coverage_payload_lists_every_plan_and_who_has_not_lodged(self):
        paper = self._paper()
        covered_plan = self._plan(self.ma, WorkflowStage.NOTED)
        self._plan(self.mb, WorkflowStage.MANAGER_CHECKLIST_REVIEW)
        res = _client(self.manager).get(f"/api/submissions/{paper.id}/coverage/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data["counts"], {"covered": 0, "will_cover": 1, "waiting": 1})
        self.assertEqual({r["state"] for r in res.data["rows"]}, {"will_cover", "waiting"})
        self.assertFalse(res.data["can_go_up"])
        self.assertNotIn("Ministry A", res.data["not_lodged"])
        self.assertNotIn("Ministry B", res.data["not_lodged"])
        self.assertNotIn("Ministry of the Prime Minister", res.data["not_lodged"])
        self.assertTrue(covered_plan.id in {r["id"] for r in res.data["rows"]})

    def test_the_ministry_cannot_open_the_coverage(self):
        paper = self._paper()
        self.assertEqual(_client(self.hr_a).get(f"/api/submissions/{paper.id}/coverage/").status_code, 404)

    def test_coverage_is_refused_for_an_ordinary_submission(self):
        plan = self._plan(self.ma, WorkflowStage.NOTED)
        self.assertEqual(_client(self.manager).get(f"/api/submissions/{plan.id}/coverage/").status_code, 400)

    def test_a_late_business_plan_is_flagged_in_the_table(self):
        paper = self._paper()
        import datetime
        self._plan(self.ma, WorkflowStage.NOTED,
                   received_at=timezone.make_aware(datetime.datetime(timezone.now().year, 3, 10, 9, 0)))
        row = coverage_payload(paper)["rows"][0]
        self.assertTrue(row["late"])
        self.assertEqual(row["deadline_text"], "28 February")


def covered_ids(paper):
    from ..odu_consolidation import covered
    return set(covered(paper).values_list("id", flat=True))

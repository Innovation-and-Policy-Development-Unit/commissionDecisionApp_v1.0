"""ODU feedback round: restructure documents + three analyses, and the overseas travel
report as ODU's own internal paper."""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    BoardPaperStatus, Department, Ministry, ODURestructureBoardPaper, PSCFormType, Profile,
    RequiredDocument, Role, RoutedUnit, Submission, SubmissionChecklistItem,
    SubmissionDocument, WorkflowStage,
)
from ..submission_checklist import resolve_required_documents

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def _user(name, role, **kw):
    u = User.objects.create_user(name, password="x")
    Profile.objects.create(user=u, role=role, **kw)
    return u


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class RestructureDocumentsTests(TestCase):
    def test_ministry_is_asked_for_the_listed_documents_and_not_odus_analyses(self):
        ft = PSCFormType.objects.get(code="ORG-3.1")
        ministry = Ministry.objects.create(code="MR", name="M")
        sub = Submission.objects.create(
            reference_number="SUB-R-1", title="r", form_type_code="ORG-3.1", ministry=ministry,
            current_stage=WorkflowStage.DRAFT, received_at=timezone.now(),
            created_by=_user("mhr_r", Role.MINISTRY_HR, ministry=ministry),
        )
        names = set(resolve_required_documents(sub).values_list("name", flat=True))
        self.assertIn("Confirmation Letter from Finance (budget)", names)
        self.assertIn("Current Organisation Structure (signed)", names)
        self.assertIn("Current Job Description", names)
        self.assertNotIn("Other Supporting Documents", names)
        self.assertFalse({"DSSPAC Analysis", "GRT Analysis", "Finance Analysis"} & names)
        analyses = RequiredDocument.objects.filter(form_type=ft, opsc_supplied=True)
        self.assertEqual(analyses.count(), 3)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class OduPaperAnalysesTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="MP", name="Ministry P")
        self.principal = _user("odu_p_an", Role.ODU_PRINCIPAL)
        self.manager = _user("odu_m_an", Role.ODU_MANAGER)
        self.ministry_hr = _user("mhr_an", Role.MINISTRY_HR, ministry=self.ministry)
        self.sub = Submission.objects.create(
            reference_number="SUB-AN-1", title="Restructure", form_type_code="ORG-3.1",
            ministry=self.ministry, current_stage=WorkflowStage.UNDER_ASSESSMENT,
            routed_unit=RoutedUnit.ODU, assigned_to=self.principal,
            received_at=timezone.now(), created_by=self.ministry_hr,
        )
        self.paper = ODURestructureBoardPaper.objects.create(
            submission=self.sub, created_by=self.principal,
        )

    def _attach(self, user, kind):
        return _client(user).post(
            f"/api/odu-board-papers/{self.paper.id}/analysis/",
            {"kind": kind, "file": SimpleUploadedFile(f"{kind}.pdf", PDF, "application/pdf")},
            format="multipart",
        )

    def _submit(self):
        return _client(self.principal).post(f"/api/odu-board-papers/{self.paper.id}/submit/")

    def test_paper_cannot_be_submitted_without_the_analyses_or_summaries(self):
        res = self._submit()
        self.assertEqual(res.status_code, 400)
        self.assertIn("DSSPAC", res.data["detail"])
        self.paper.refresh_from_db()
        self.assertEqual(self.paper.status, BoardPaperStatus.DRAFT)

    def test_attachments_alone_are_not_enough_the_summaries_are_needed_too(self):
        for kind in ("dsspac", "grt", "finance"):
            self.assertEqual(self._attach(self.principal, kind).status_code, 201)
        res = self._submit()
        self.assertEqual(res.status_code, 400)
        self.assertIn("summarise", res.data["detail"])

    def test_submits_once_all_three_are_attached_and_summarised(self):
        for kind in ("dsspac", "grt", "finance"):
            self.assertEqual(self._attach(self.principal, kind).status_code, 201)
        self.paper.dsspac_summary = "d"
        self.paper.grt_summary = "g"
        self.paper.finance_summary = "f"
        self.paper.save()
        self.assertEqual(self._submit().status_code, 200)

    def test_manager_cannot_skip_the_analyses_by_approving_a_draft(self):
        res = _client(self.manager).post(f"/api/odu-board-papers/{self.paper.id}/manager-approve/")
        self.assertEqual(res.status_code, 400)

    def test_replacing_an_analysis_archives_the_old_file(self):
        self._attach(self.principal, "grt")
        self._attach(self.principal, "grt")
        docs = SubmissionDocument.all_objects.filter(
            submission=self.sub, required_document__name="GRT Analysis")
        self.assertEqual(docs.count(), 2)
        self.assertEqual(docs.filter(archived_at__isnull=True).count(), 1)

    def test_analyses_never_reach_the_ministry_or_its_checklist(self):
        self._attach(self.principal, "finance")
        doc = SubmissionDocument.objects.get(submission=self.sub)
        res = _client(self.ministry_hr).get(f"/api/submissions/{self.sub.id}/documents/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual([d["id"] for d in res.data], [])
        self.assertEqual(
            _client(self.ministry_hr).get(f"/api/submissions/{self.sub.id}/documents/{doc.id}/").status_code,
            404,
        )
        self.assertFalse(SubmissionChecklistItem.objects.filter(
            submission=self.sub, document__opsc_supplied=True).exists())
        # ODU itself still sees it.
        res = _client(self.principal).get(f"/api/submissions/{self.sub.id}/documents/")
        self.assertEqual(len(res.data), 1)

    def test_a_stranger_cannot_attach(self):
        outsider = _user("odu_other", Role.HR_UNIT_PRINCIPAL)
        self.assertEqual(self._attach(outsider, "grt").status_code, 403)

    @patch("tracker.tasks.draft_odu_paper_task.delay")
    def test_ai_draft_is_queued_and_only_suggests(self, delay):
        with self.captureOnCommitCallbacks(execute=True):
            res = _client(self.principal).post(f"/api/odu-board-papers/{self.paper.id}/ai-draft/")
        self.assertEqual(res.status_code, 202)
        self.assertEqual(res.data["ai_draft_state"], "running")
        delay.assert_called_once_with(self.paper.id)

    def test_ai_draft_task_stores_suggestions_without_touching_the_paper(self):
        from ..tasks import draft_odu_paper_task

        self.paper.background = "ODU wrote this"
        self.paper.save()
        fake = {"background": "AI wrote this", "gaps": ["no GRT text"], "costing_rows": [{"current_title": "X"}]}
        with patch("tracker.ai.odu_paper_draft.draft_paper", return_value=(fake, None)):
            draft_odu_paper_task(self.paper.id)
        self.paper.refresh_from_db()
        self.assertEqual(self.paper.ai_draft_state, "done")
        self.assertEqual(self.paper.ai_draft["background"], "AI wrote this")
        self.assertEqual(self.paper.background, "ODU wrote this")

    def test_failed_draft_still_offers_the_ministry_costing(self):
        from ..tasks import draft_odu_paper_task

        with patch("tracker.ai.odu_paper_draft.draft_paper", return_value=(None, "no key")):
            draft_odu_paper_task(self.paper.id)
        self.paper.refresh_from_db()
        self.assertEqual(self.paper.ai_draft_state, "failed")
        self.assertEqual(self.paper.ai_draft_error, "no key")
        self.assertIn("costing_rows", self.paper.ai_draft)

    def test_summary_without_analysis_text_is_dropped(self):
        from ..ai.odu_paper_draft import draft_paper

        data = {"subject": "S", "dsspac_summary": "invented", "gaps": []}
        with patch("tracker.ai.odu_paper_draft.ai_enabled", return_value=True), \
                patch("tracker.ai.odu_paper_draft.complete_json_with_error", return_value=(data, None)):
            out, err = draft_paper(self.paper)
        self.assertIsNone(err)
        self.assertEqual(out["subject"], "S")
        self.assertEqual(out["dsspac_summary"], "")


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class OduTravelReportTests(TestCase):
    def setUp(self):
        opm = Ministry.objects.create(code="OPM", name="Ministry of the Prime Minister")
        Department.objects.create(ministry=opm, code="OPSC", name="Office of the Public Service Commission")
        self.senior = _user("tr_senior", Role.ODU_SENIOR)
        self.principal = _user("tr_principal", Role.ODU_PRINCIPAL)
        self.manager = _user("tr_manager", Role.ODU_MANAGER)

    def _create(self, user, code="ODU-TRAVEL-REPORT", title="Overseas travel Q3 2026"):
        return _client(user).post("/api/submissions/", {
            "title": title, "form_type_code": code, "received_at": timezone.now().isoformat(),
        }, format="json")

    def _make(self, user=None):
        res = self._create(user or self.senior)
        self.assertEqual(res.status_code, 201, res.content)
        return Submission.objects.get(pk=res.data["id"])

    def _move(self, user, sub, stage):
        return _client(user).post(
            f"/api/submissions/{sub.id}/transition/",
            {"new_stage": stage, "remarks": "Please see my comments."}, format="json")

    def test_every_odu_tier_creates_an_internal_odu_paper(self):
        for i, user in enumerate((self.senior, self.principal, self.manager)):
            res = self._create(user, title=f"Travel report {i}")
            self.assertEqual(res.status_code, 201, res.content)
            sub = Submission.objects.get(pk=res.data["id"])
            self.assertTrue(sub.is_internal)
            self.assertFalse(sub.follows_normal_route)
            self.assertEqual(sub.routed_unit, "odu")
            self.assertEqual(sub.current_stage, WorkflowStage.DRAFT)

    def test_odu_cannot_create_anything_else(self):
        res = self._create(self.senior, code="ORG-3.1", title="Restructure by ODU")
        self.assertEqual(res.status_code, 400)

    def test_the_report_is_a_required_document_and_blocks_sending_up(self):
        sub = self._make()
        res = _client(self.senior).get(f"/api/submissions/{sub.id}/checklist/")
        self.assertEqual([i["document_name"] for i in res.data], ["Overseas Travel Report"])
        blocked = self._move(self.senior, sub, WorkflowStage.PENDING_PRINCIPAL_REVIEW)
        self.assertEqual(blocked.status_code, 400)
        self.assertIn("Overseas Travel Report", blocked.data["detail"])

    def test_with_the_report_attached_it_climbs_the_ladder_to_the_secretary_gate(self):
        sub = self._make()
        slot = RequiredDocument.objects.get(form_type__code="ODU-TRAVEL-REPORT")
        up = _client(self.senior).post(
            f"/api/submissions/{sub.id}/documents/",
            {"file": SimpleUploadedFile("report.pdf", PDF, "application/pdf"),
             "required_document": slot.id},
            format="multipart",
        )
        self.assertEqual(up.status_code, 201, up.content)
        self.assertEqual(self._move(self.senior, sub, WorkflowStage.PENDING_PRINCIPAL_REVIEW).status_code, 200)
        self.assertEqual(self._move(self.principal, sub, WorkflowStage.RETURNED_FOR_CLARIFICATION).status_code, 200)
        self.assertEqual(self._move(self.senior, sub, WorkflowStage.PENDING_MANAGER_APPROVAL).status_code, 200)
        self.assertEqual(self._move(self.manager, sub, WorkflowStage.PENDING_SECRETARY_APPROVAL).status_code, 200)

    def test_a_principal_can_attach_the_report_to_a_seniors_draft(self):
        sub = self._make()
        slot = RequiredDocument.objects.get(form_type__code="ODU-TRAVEL-REPORT")
        up = _client(self.principal).post(
            f"/api/submissions/{sub.id}/documents/",
            {"file": SimpleUploadedFile("report.pdf", PDF, "application/pdf"),
             "required_document": slot.id},
            format="multipart",
        )
        self.assertEqual(up.status_code, 201, up.content)

    def test_ordinary_odu_work_is_untouched(self):
        ministry = Ministry.objects.create(code="MX", name="MX")
        hr = _user("tr_mhr", Role.MINISTRY_HR, ministry=ministry)
        sub = Submission.objects.create(
            reference_number="SUB-TR-9", title="Restructure", form_type_code="ORG-3.1",
            ministry=ministry, current_stage=WorkflowStage.UNDER_ASSESSMENT,
            routed_unit=RoutedUnit.ODU, assigned_to=self.principal,
            received_at=timezone.now(), created_by=hr,
        )
        res = _client(self.principal).get(f"/api/submissions/{sub.id}/")
        self.assertEqual(res.status_code, 200)

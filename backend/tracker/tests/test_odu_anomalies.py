"""ODU Anomalies: the ministry's short Submission Paper plus three documents, and ODU's own
Commission paper (like a restructure, but with no analyses)."""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    BoardPaperStatus, Ministry, ODURestructureBoardPaper, PSCFormField, PSCFormType, Profile,
    Role, RoutedUnit, Submission, WorkflowStage,
)
from ..odu_checklist_rules import (
    ODU_BOARD_PAPER_FORM_CODES, submission_eligible_for_board_paper,
    submission_viewable_board_paper,
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


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class AnomaliesTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="MA", name="Ministry A")
        self.hr = _user("hr_an", Role.MINISTRY_HR, ministry=self.ministry)
        self.principal = _user("odu_p_anom", Role.ODU_PRINCIPAL)
        self.manager = _user("odu_m_anom", Role.ODU_MANAGER)
        self.secretary = _user("sec_anom", Role.PSC_SECRETARY)

    def _sub(self, code="ANOMALIES", stage=WorkflowStage.UNDER_ASSESSMENT, ref="SUB-ANOM-1"):
        return Submission.objects.create(
            reference_number=ref, title="Salary step anomaly", form_type_code=code,
            ministry=self.ministry, current_stage=stage, routed_unit=RoutedUnit.ODU,
            assigned_to=self.principal, received_at=timezone.now(), created_by=self.hr,
        )

    # ── the form type ──
    def test_the_form_type_is_set_up_for_odu_and_the_anomalies_agenda_section(self):
        ft = PSCFormType.objects.get(code="ANOMALIES")
        self.assertEqual((ft.routed_unit, ft.agenda_category, ft.is_digitized, ft.is_active), ("odu", "anomalies", True, True))
        self.assertIsNone(ft.checklist_form_type)  # no 20-item checklist and no AI review

    def test_the_submission_paper_asks_for_the_essentials(self):
        fields = {f.field_key: f for f in PSCFormField.objects.filter(form_type__code="ANOMALIES")}
        for key in ("subject", "officers_positions", "anomaly_description", "issue", "discussion", "recommendation"):
            self.assertTrue(fields[key].is_required, key)

    def test_the_ministry_sends_exactly_the_three_documents(self):
        names = list(resolve_required_documents(self._sub(stage=WorkflowStage.DRAFT)).order_by("order").values_list("name", flat=True))
        self.assertEqual(names, [
            "Signed Cover Letter by Director General",
            "Structure / Job Description of the Position",
            "Smartstream Screenshot",
        ])

    # ── the Commission paper ──
    def test_anomalies_and_restructures_use_the_odu_paper_other_papers_do_not(self):
        self.assertEqual(ODU_BOARD_PAPER_FORM_CODES, {"ORG-3.1", "PSC 2-1", "ANOMALIES"})
        self.assertTrue(submission_eligible_for_board_paper(self._sub()))
        self.assertFalse(submission_eligible_for_board_paper(self._sub("ANNUAL-REPORT", ref="SUB-ANOM-2")))

    def test_the_paper_is_only_open_while_odu_has_the_submission(self):
        self.assertFalse(submission_viewable_board_paper(self._sub(stage=WorkflowStage.DRAFT, ref="SUB-ANOM-3")))
        self.assertTrue(submission_viewable_board_paper(self._sub(stage=WorkflowStage.MANAGER_CHECKLIST_REVIEW, ref="SUB-ANOM-4")))

    def test_odu_can_start_the_paper_and_it_carries_no_analyses(self):
        sub = self._sub()
        res = _client(self.principal).get(f"/api/odu-board-papers/ensure/?submission={sub.id}")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["analysis_documents"], [])
        self.assertEqual(res.data["gaps"], [])
        self.assertTrue(ODURestructureBoardPaper.objects.filter(submission=sub).exists())

    def test_the_paper_goes_up_the_chain_without_any_analyses(self):
        sub = self._sub()
        paper = ODURestructureBoardPaper.objects.create(submission=sub, created_by=self.principal, subject="s")
        self.assertEqual(_client(self.principal).post(f"/api/odu-board-papers/{paper.id}/submit/").status_code, 200)
        self.assertEqual(_client(self.manager).post(f"/api/odu-board-papers/{paper.id}/manager-approve/").status_code, 200)
        self.assertEqual(_client(self.secretary).post(f"/api/odu-board-papers/{paper.id}/secretary-approve/").status_code, 200)
        paper.refresh_from_db()
        self.assertEqual(paper.status, BoardPaperStatus.SECRETARY_APPROVED)

    def test_a_restructure_paper_is_still_held_back_for_its_analyses(self):
        sub = self._sub("ORG-3.1", ref="SUB-ANOM-5")
        paper = ODURestructureBoardPaper.objects.create(submission=sub, created_by=self.principal)
        res = _client(self.principal).post(f"/api/odu-board-papers/{paper.id}/submit/")
        self.assertEqual(res.status_code, 400)
        self.assertIn("DSSPAC", res.data["detail"])
        self.assertEqual(len(_client(self.principal).get(f"/api/odu-board-papers/ensure/?submission={sub.id}").data["analysis_documents"]), 3)

    def test_the_restructure_ai_draft_is_not_offered_for_anomalies(self):
        paper = ODURestructureBoardPaper.objects.create(submission=self._sub(), created_by=self.principal)
        with patch("tracker.tasks.draft_odu_paper_task.delay", create=True) as delay:
            res = _client(self.principal).post(f"/api/odu-board-papers/{paper.id}/ai-draft/")
        self.assertEqual(res.status_code, 400)
        delay.assert_not_called()

    def test_the_ministry_cannot_open_the_odu_paper(self):
        sub = self._sub()
        res = _client(self.hr).get(f"/api/odu-board-papers/ensure/?submission={sub.id}")
        self.assertEqual(res.status_code, 403)

    def test_an_odu_principal_can_return_an_anomaly_straight_to_the_ministry(self):
        from ..odu_checklist_rules import ODU_PRINCIPAL_DIRECT_CLARIFICATION_FORM_CODES

        self.assertIn("ANOMALIES", ODU_PRINCIPAL_DIRECT_CLARIFICATION_FORM_CODES)

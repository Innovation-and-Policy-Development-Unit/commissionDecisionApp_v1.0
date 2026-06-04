"""Phase 2 — statutory SLA timeline materialisation and roll-up."""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from ..compliance_workflows import (
    WORKFLOW_STAGES,
    compute_due_date,
    get_stages_for_family,
    recompute_case_sla,
    sla_status_for_stage,
)
from ..models import (
    CaseFamily,
    ComplianceCase,
    ComplianceCaseStage,
    Ministry,
    SLAStatus,
    StageStatus,
    Submission,
    WorkflowStage,
)


class ComplianceWorkflowTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(username="cmpl2", password="x")
        cls.ministry = Ministry.objects.create(code="OPSC", name="Office of the PSC")

    def _case(self, family=CaseFamily.EMPLOYEE_DISCIPLINARY, received=None):
        sub = Submission.objects.create(
            title="Matter", form_type_code="COMP-SMDR", ministry=self.ministry,
            received_at=timezone.now(), created_by=self.user, is_internal=True,
            current_stage=WorkflowStage.DRAFT,
        )
        return ComplianceCase.objects.create(
            submission=sub, case_family=family, subject_name="Subject",
            date_received=received or date.today(),
        )

    def test_all_families_have_templates(self):
        for family in (
            CaseFamily.EMPLOYEE_DISCIPLINARY, CaseFamily.SERIOUS_MISCONDUCT_EMPLOYEE,
            CaseFamily.TEMPORARY_SUSPENSION, CaseFamily.GRIEVANCE,
            CaseFamily.SENIOR_SERIOUS_MISCONDUCT, CaseFamily.SENIOR_POOR_PERFORMANCE,
        ):
            self.assertGreater(len(get_stages_for_family(family)), 0, family)

    def test_stages_materialised_on_case_creation(self):
        case = self._case(CaseFamily.EMPLOYEE_DISCIPLINARY)
        # 7 stages in the employee disciplinary template
        self.assertEqual(case.stages.count(), len(WORKFLOW_STAGES[CaseFamily.EMPLOYEE_DISCIPLINARY]))
        first = case.stages.order_by("stage_order").first()
        self.assertEqual(first.stage_code, "allegation_notice")
        self.assertIsNotNone(first.due_date)

    def test_working_day_due_date_skips_weekend(self):
        # Friday 2026-06-05 + 1 working day = Monday 2026-06-08
        friday = date(2026, 6, 5)
        self.assertEqual(compute_due_date(friday, 1, True), date(2026, 6, 8))
        # calendar-day variant lands on Saturday
        self.assertEqual(compute_due_date(friday, 1, False), date(2026, 6, 6))

    def test_sla_status_overdue_and_at_risk(self):
        case = self._case()
        stage = case.stages.order_by("stage_order").first()

        stage.due_date = date.today() - timedelta(days=1)
        self.assertEqual(sla_status_for_stage(stage), SLAStatus.OVERDUE)

        stage.due_date = date.today() + timedelta(days=1)
        self.assertEqual(sla_status_for_stage(stage), SLAStatus.AT_RISK)

        stage.due_date = date.today() + timedelta(days=30)
        self.assertEqual(sla_status_for_stage(stage), SLAStatus.ON_TRACK)

        stage.status = StageStatus.COMPLETED
        self.assertEqual(sla_status_for_stage(stage), SLAStatus.COMPLETED)

    def test_recompute_case_sla_persists(self):
        case = self._case()
        case.stages.update(due_date=date.today() - timedelta(days=2))
        changed = recompute_case_sla(case)
        self.assertGreater(changed, 0)
        self.assertTrue(all(s.sla_status == SLAStatus.OVERDUE for s in case.stages.all()))

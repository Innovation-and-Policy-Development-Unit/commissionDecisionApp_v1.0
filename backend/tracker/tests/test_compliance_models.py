"""Phase 1 — smoke tests for the merged compliance data models."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from ..models import (
    CaseFamily,
    CaseNote,
    Complaint,
    ComplaintStatus,
    ComplianceCase,
    LitigationRecord,
    Ministry,
    Submission,
    WorkflowStage,
)


class ComplianceModelsTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(username="cmpl", password="x")
        cls.ministry = Ministry.objects.create(code="OPSC", name="Office of the PSC")

    def _make_submission(self):
        return Submission.objects.create(
            title="Disciplinary matter",
            form_type_code="COMP-SMDR",
            ministry=self.ministry,
            received_at=timezone.now(),
            created_by=self.user,
            is_internal=True,
            current_stage=WorkflowStage.DRAFT,
        )

    def test_complaint_reference_autoallocated(self):
        c = Complaint.objects.create(
            title="Late attendance pattern",
            ministry=self.ministry,
            lodged_by=self.user,
            subject_name="John Doe",
        )
        self.assertTrue(c.reference_number.startswith("CMP-"))
        self.assertEqual(c.status, ComplaintStatus.RECEIVED)

    def test_compliance_case_one_to_one_and_children(self):
        sub = self._make_submission()
        case = ComplianceCase.objects.create(
            submission=sub,
            case_family=CaseFamily.EMPLOYEE_DISCIPLINARY,
            subject_name="John Doe",
            subject_ministry="Ministry of Health",
        )
        # reverse accessor from Submission
        self.assertEqual(sub.compliance_case, case)

        # Statutory stages are auto-materialised by the post_save signal (Phase 2).
        self.assertTrue(case.stages.exists())

        LitigationRecord.objects.create(case=case, description="Judicial review filed")
        CaseNote.objects.create(case=case, author=self.user, text="Opened case file")

        self.assertEqual(case.litigation_records.count(), 1)
        self.assertEqual(case.case_notes.count(), 1)

    def test_complaint_links_to_case_on_accept(self):
        sub = self._make_submission()
        case = ComplianceCase.objects.create(
            submission=sub,
            case_family=CaseFamily.GRIEVANCE,
            subject_name="Jane Roe",
        )
        c = Complaint.objects.create(title="Grievance vs DG", ministry=self.ministry)
        c.compliance_case = case
        c.status = ComplaintStatus.CONVERTED
        c.save()
        self.assertEqual(case.source_complaints.first(), c)

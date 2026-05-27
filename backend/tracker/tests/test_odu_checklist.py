"""ODU restructure checklist eligibility and prefill."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from tracker.models import (
    Ministry,
    ODURestructureChecklist,
    RoutedUnit,
    Submission,
    WorkflowStage,
)
from tracker.odu_checklist_prefill import build_odu_checklist_prefill
from tracker.odu_checklist_rules import (
    submission_eligible_for_odu_checklist,
    submission_in_odu_review_phase,
)

User = get_user_model()


class OduChecklistRulesTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(name="Test Ministry", code="TM")
        self.submission = Submission.objects.create(
            reference_number="SUB-ODU-001",
            title="Restructure proposal",
            form_type_code="ORG-3.1",
            ministry=self.ministry,
            routed_unit=RoutedUnit.ODU,
            current_stage=WorkflowStage.MANAGER_CHECKLIST_REVIEW,
            received_at=timezone.now(),
        )

    def test_eligible_when_odu_review_restructure(self):
        self.assertTrue(submission_in_odu_review_phase(self.submission))
        self.assertTrue(submission_eligible_for_odu_checklist(self.submission))

    def test_not_eligible_wrong_stage(self):
        self.submission.current_stage = WorkflowStage.UNDER_ASSESSMENT
        self.assertFalse(submission_eligible_for_odu_checklist(self.submission))

    def test_prefill_section_a_from_submission(self):
        user = User.objects.create_user(username="odu_p", password="x")
        prefill = build_odu_checklist_prefill(self.submission, user=user)
        self.assertEqual(prefill["ministry_department"], "Test Ministry")
        self.assertEqual(prefill["submission_type"], ODURestructureChecklist.SubmissionType.FULL_RESTRUCTURE)
        self.assertEqual(prefill["odu_officer_assigned"], "odu_p")

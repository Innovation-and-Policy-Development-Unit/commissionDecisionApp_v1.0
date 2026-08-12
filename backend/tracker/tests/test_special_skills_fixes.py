"""PSC 2-8 (Special Skills Allowance) fixes: reachability (dedicated agenda
section + routing, kept separate from the shared "extra_responsibility"
bucket) and corrected 12-item checklist."""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from ..models import AgendaSection, Ministry, PSCFormType, Submission, WorkflowStage
from ..submission_checklist import resolve_required_documents


class SpecialSkillsReachabilityTests(TestCase):
    def test_dedicated_agenda_section_exists(self):
        section = AgendaSection.objects.get(code='special_skills_allowance')
        self.assertTrue(section.is_active)

    def test_form_type_routing_and_agenda_category(self):
        ft = PSCFormType.objects.get(code='SPECIAL-SKILLS')
        self.assertEqual(ft.agenda_category, 'special_skills_allowance')
        self.assertEqual(ft.routed_unit, 'odu')

    def test_shared_bucket_and_sibling_form_untouched(self):
        # The generic "extra_responsibility" bucket (and PSC 4-1, which lives
        # in it) must not have been repointed at ODU by this fix.
        bucket = AgendaSection.objects.get(code='extra_responsibility')
        self.assertEqual(bucket.receiver_roles, [])
        overtime = PSCFormType.objects.filter(code='PSC 4-1').first()
        if overtime:
            self.assertNotEqual(overtime.routed_unit, 'odu')


class SpecialSkillsChecklistTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-SSC", name="Test Ministry SSC")
        self.hr = User.objects.create_user("hruser_ssc", password="x")

    def test_checklist_matches_twelve_item_list(self):
        submission = Submission.objects.create(
            reference_number="SUB-SSC-001",
            title="Special Skills Allowance for J. Doe",
            form_type_code="SPECIAL-SKILLS",
            ministry=self.ministry,
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        names = {d.name for d in resolve_required_documents(submission)}
        self.assertEqual(names, {
            "Request letter from ministry/organization",
            "Supporting letter from DG/Head of Organization",
            "Appointment Letter from Director or DG to undertake such tasks",
            "Point Matrix assessment form",
            "Original PSC decision approving the assignment (Optional)",
            "Officer CV or resume",
            "Substantive position details",
            "Job description",
            "TOR for special assignment",
            "Consultant cost comparison",
            "Confirmation of cost recovery/funding source",
            "Financial Impact Statement / Budget Capacity Letter",
        })

    def test_old_grouped_items_deactivated(self):
        from ..models import RequiredDocument
        old_names = [
            "A. Original PSC decision approving the assignment",
            "B. Performance appraisal or HR record",
            "C. List of key tasks and responsibilities",
            "C. Organizational context document",
            "D. PSSM Chapter 4 compliance statement",
        ]
        active_old = RequiredDocument.objects.filter(
            form_type__code="SPECIAL-SKILLS", name__in=old_names, is_active=True,
        )
        self.assertEqual(active_old.count(), 0)

"""Extra Responsibility Allowance (PSC ERA Form) — new submission type: own
PSCFormType, dedicated agenda section, ODU routing, 5-item checklist, no
digitized form."""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from ..models import AgendaSection, Ministry, PSCFormType, Submission, WorkflowStage
from ..submission_checklist import resolve_required_documents


class ExtraResponsibilityAllowanceReachabilityTests(TestCase):
    def test_dedicated_agenda_section_exists(self):
        section = AgendaSection.objects.get(code='extra_responsibility_allowance')
        self.assertTrue(section.is_active)
        self.assertEqual(section.receiver_roles, ['odu_manager'])

    def test_form_type_routing_and_agenda_category(self):
        ft = PSCFormType.objects.get(code='EXTRA-RESPONSIBILITY')
        self.assertEqual(ft.agenda_category, 'extra_responsibility_allowance')
        self.assertEqual(ft.routed_unit, 'odu')
        self.assertFalse(ft.is_digitized)

    def test_shared_bucket_and_sibling_form_untouched(self):
        bucket = AgendaSection.objects.get(code='extra_responsibility')
        self.assertEqual(bucket.receiver_roles, [])
        overtime = PSCFormType.objects.filter(code='PSC 4-1').first()
        if overtime:
            self.assertNotEqual(overtime.routed_unit, 'odu')


class ExtraResponsibilityAllowanceChecklistTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-ERA", name="Test Ministry ERA")
        self.hr = User.objects.create_user("hruser_era", password="x")

    def test_checklist_matches_five_item_list(self):
        submission = Submission.objects.create(
            reference_number="SUB-ERA-001",
            title="Extra Responsibility Allowance for J. Doe",
            form_type_code="EXTRA-RESPONSIBILITY",
            ministry=self.ministry,
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        names = {d.name for d in resolve_required_documents(submission)}
        self.assertEqual(names, {
            "Letter from Director or DG request to undertake the Task",
            "JD for Substantive Position and/or JD for other Position",
            "List of Tasks",
            "Impact Report of Task undertaken",
            "PSC ERA Form",
        })

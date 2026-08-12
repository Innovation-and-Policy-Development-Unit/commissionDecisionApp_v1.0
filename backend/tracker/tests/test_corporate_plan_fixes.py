"""PSC 2-6 (Ministry Corporate Plan) fixes: reachability (agenda section +
routing), corrected single-item checklist, and field pagination."""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from ..models import AgendaSection, Ministry, PSCFormType, RequiredDocument, Submission, WorkflowStage
from ..submission_checklist import resolve_required_documents


class CorporatePlanReachabilityTests(TestCase):
    def test_dedicated_agenda_section_exists(self):
        section = AgendaSection.objects.get(code='corporate_plan')
        self.assertTrue(section.is_active)
        self.assertEqual(section.digitized_form.code, 'CORPORATE-PLAN')

    def test_form_type_routing_and_agenda_category(self):
        ft = PSCFormType.objects.get(code='CORPORATE-PLAN')
        self.assertEqual(ft.agenda_category, 'corporate_plan')
        self.assertEqual(ft.routed_unit, 'odu')


class CorporatePlanChecklistTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-CPC", name="Test Ministry CPC")
        self.hr = User.objects.create_user("hruser_cpc", password="x")

    def test_checklist_matches_single_item_list(self):
        submission = Submission.objects.create(
            reference_number="SUB-CPC-001",
            title="Ministry Corporate Plan 2027-2030",
            form_type_code="CORPORATE-PLAN",
            ministry=self.ministry,
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        names = {d.name for d in resolve_required_documents(submission)}
        self.assertEqual(names, {"Signed Ministry Corporate Plan Document"})

    def test_old_generic_items_deactivated(self):
        old_names = [
            "Signed corporate plan document",
            "Ministry vision and mission statements",
            "NSDP alignment statement",
            "Strategic priorities outline",
            "Organizational structure overview",
            "Budget and resource allocation",
            "Capacity building plan",
        ]
        active_old = RequiredDocument.objects.filter(
            form_type__code="CORPORATE-PLAN", name__in=old_names, is_active=True,
        )
        self.assertEqual(active_old.count(), 0)


class CorporatePlanFieldPaginationTests(TestCase):
    def test_section_headers_marked_as_page_breaks(self):
        ft = PSCFormType.objects.get(code='CORPORATE-PLAN')
        paged_keys = set(
            ft.fields.filter(start_new_page=True).values_list('field_key', flat=True)
        )
        self.assertEqual(paged_keys, {
            'sec_strategic', 'sec_programs', 'sec_org',
            'sec_resources', 'sec_capacity', 'sec_risk', 'sec_issue',
        })

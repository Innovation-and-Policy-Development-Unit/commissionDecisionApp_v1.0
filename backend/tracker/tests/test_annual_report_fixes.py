"""PSC 2-7 (Ministry Annual Report) fixes: reachability (agenda section +
routing), corrected checklist with a real Business Plan cross-reference,
deadline reminders, and field pagination."""

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    AgendaSection,
    Ministry,
    Notification,
    PSCFormType,
    Profile,
    Role,
    RoutedUnit,
    Submission,
    SubmissionChecklistItem,
    WorkflowStage,
)
from ..submission_checklist import resolve_required_documents
from ..tasks import send_annual_report_deadline_reminders


class AnnualReportReachabilityTests(TestCase):
    def test_dedicated_agenda_section_exists(self):
        section = AgendaSection.objects.get(code='annual_report')
        self.assertTrue(section.is_active)
        self.assertEqual(section.digitized_form.code, 'ANNUAL-REPORT')

    def test_form_type_routing_and_agenda_category(self):
        ft = PSCFormType.objects.get(code='ANNUAL-REPORT')
        self.assertEqual(ft.agenda_category, 'annual_report')
        self.assertEqual(ft.routed_unit, 'odu')


class AnnualReportChecklistTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-ARC", name="Test Ministry ARC")
        self.hr = User.objects.create_user("hruser_arc", password="x")

    def test_checklist_matches_three_item_list(self):
        submission = Submission.objects.create(
            reference_number="SUB-ARC-001",
            title="Ministry Annual Report 2026",
            form_type_code="ANNUAL-REPORT",
            ministry=self.ministry,
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        names = {d.name for d in resolve_required_documents(submission)}
        self.assertEqual(names, {
            "Ministry Annual Report Document",
            "Checklist as Per AR Guideline",
            "Copy of Signed Business Plan for the Report Year",
        })

    def test_business_plan_item_has_required_form_set(self):
        from ..models import RequiredDocument
        item = RequiredDocument.objects.get(
            form_type__code="ANNUAL-REPORT",
            name="Copy of Signed Business Plan for the Report Year",
            is_active=True,
        )
        self.assertEqual(item.required_form.code, "BUSINESS-PLAN")


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class LinkBusinessPlanToAnnualReportTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-ARL", name="Test Ministry ARL")
        self.hr = User.objects.create_user("hruser_arl", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)

        self.annual_report = Submission.objects.create(
            reference_number="SUB-ARL-AR",
            title="Ministry Annual Report 2026",
            form_type_code="ANNUAL-REPORT",
            ministry=self.ministry,
            routed_unit=RoutedUnit.ODU,
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        self.business_plan = Submission.objects.create(
            reference_number="SUB-ARL-BP",
            title="Ministry Business Plan 2026",
            form_type_code="BUSINESS-PLAN",
            ministry=self.ministry,
            current_stage=WorkflowStage.APPROVED,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.hr)

    def test_link_approved_business_plan_marks_checklist_present(self):
        resp = self.client.post(
            f"/api/submissions/{self.business_plan.id}/link-as-attachment/",
            {"parent_submission": self.annual_report.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.business_plan.refresh_from_db()
        self.assertTrue(self.business_plan.is_attachment)
        self.assertEqual(self.business_plan.parent_submission_id, self.annual_report.id)

        item = SubmissionChecklistItem.objects.get(
            submission=self.annual_report,
            document__name="Copy of Signed Business Plan for the Report Year",
        )
        self.assertTrue(item.is_present)


class AnnualReportReminderTaskTests(TestCase):
    def setUp(self):
        self.ministry_no_report = Ministry.objects.create(code="TST-ARR1", name="Ministry Without Report")
        self.ministry_with_report = Ministry.objects.create(code="TST-ARR2", name="Ministry With Report")
        self.hr1 = User.objects.create_user("hruser_arr1", password="x", email="arr1@example.test")
        Profile.objects.create(user=self.hr1, role=Role.MINISTRY_HR, ministry=self.ministry_no_report)
        self.hr2 = User.objects.create_user("hruser_arr2", password="x", email="arr2@example.test")
        Profile.objects.create(user=self.hr2, role=Role.MINISTRY_HR, ministry=self.ministry_with_report)

        Submission.objects.create(
            reference_number="SUB-ARR-002",
            title="Already lodged Annual Report",
            form_type_code="ANNUAL-REPORT",
            ministry=self.ministry_with_report,
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=self.hr2,
        )

    def test_reminder_sent_only_to_ministry_without_a_report(self):
        send_annual_report_deadline_reminders()

        self.assertTrue(
            Notification.objects.filter(recipient=self.hr1, title__icontains="Annual Report due").exists()
        )
        self.assertFalse(
            Notification.objects.filter(recipient=self.hr2, title__icontains="Annual Report due").exists()
        )
        self.assertTrue(any("Annual Report due" in m.subject for m in mail.outbox))


class AnnualReportFieldPaginationTests(TestCase):
    def test_section_headers_marked_as_page_breaks(self):
        ft = PSCFormType.objects.get(code='ANNUAL-REPORT')
        paged_keys = set(
            ft.fields.filter(start_new_page=True).values_list('field_key', flat=True)
        )
        self.assertEqual(paged_keys, {
            'sec_dg_statement', 'sec_structure', 'sec_overview',
            'sec_corporate_plan_perf', 'sec_adr_targets', 'sec_budget_narrative',
            'sec_policy', 'sec_legislation', 'sec_conventions', 'sec_hr',
            'sec_risks', 'sec_dev_projects', 'sec_authorities',
            'sec_auditor_general', 'sec_ombudsman', 'sec_rti',
            'sec_court_decisions', 'sec_complaints', 'sec_financial',
        })

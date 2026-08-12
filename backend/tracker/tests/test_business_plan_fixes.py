"""PSC 2-5 (Ministry Business Plan) fixes: reachability (agenda section +
routing), corrected checklist with a real Corporate Plan cross-reference,
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
from ..tasks import send_business_plan_deadline_reminders


class BusinessPlanReachabilityTests(TestCase):
    def test_dedicated_agenda_section_exists(self):
        section = AgendaSection.objects.get(code='business_plan')
        self.assertTrue(section.is_active)
        self.assertEqual(section.digitized_form.code, 'BUSINESS-PLAN')

    def test_form_type_routing_and_agenda_category(self):
        ft = PSCFormType.objects.get(code='BUSINESS-PLAN')
        self.assertEqual(ft.agenda_category, 'business_plan')
        self.assertEqual(ft.routed_unit, 'odu')


class BusinessPlanChecklistTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-BPC", name="Test Ministry BPC")
        self.hr = User.objects.create_user("hruser_bpc", password="x")

    def test_checklist_matches_three_item_list(self):
        submission = Submission.objects.create(
            reference_number="SUB-BPC-001",
            title="Ministry Business Plan 2027",
            form_type_code="BUSINESS-PLAN",
            ministry=self.ministry,
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        names = {d.name for d in resolve_required_documents(submission)}
        self.assertEqual(names, {
            "Signed Ministry Business Plan Document",
            "Copy of Signed Ministry Corporate Plan",
            "Checklist as Per BP Guideline",
        })

    def test_corporate_plan_item_has_required_form_set(self):
        from ..models import RequiredDocument
        item = RequiredDocument.objects.get(
            form_type__code="BUSINESS-PLAN",
            name="Copy of Signed Ministry Corporate Plan",
            is_active=True,
        )
        self.assertEqual(item.required_form.code, "CORPORATE-PLAN")


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class LinkExistingAttachmentTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-LNK", name="Test Ministry LNK")
        self.hr = User.objects.create_user("hruser_lnk", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)

        self.business_plan = Submission.objects.create(
            reference_number="SUB-LNK-BP",
            title="Ministry Business Plan 2027",
            form_type_code="BUSINESS-PLAN",
            ministry=self.ministry,
            routed_unit=RoutedUnit.ODU,
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        self.corporate_plan = Submission.objects.create(
            reference_number="SUB-LNK-CP",
            title="Ministry Corporate Plan 2025-2028",
            form_type_code="CORPORATE-PLAN",
            ministry=self.ministry,
            current_stage=WorkflowStage.APPROVED,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.hr)

    def test_link_approved_corporate_plan_marks_checklist_present(self):
        resp = self.client.post(
            f"/api/submissions/{self.corporate_plan.id}/link-as-attachment/",
            {"parent_submission": self.business_plan.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.corporate_plan.refresh_from_db()
        self.assertTrue(self.corporate_plan.is_attachment)
        self.assertEqual(self.corporate_plan.parent_submission_id, self.business_plan.id)

        item = SubmissionChecklistItem.objects.get(
            submission=self.business_plan,
            document__name="Copy of Signed Ministry Corporate Plan",
        )
        self.assertTrue(item.is_present)

    def test_link_non_approved_corporate_plan_does_not_mark_present(self):
        self.corporate_plan.current_stage = WorkflowStage.UNDER_ASSESSMENT
        self.corporate_plan.save(update_fields=["current_stage"])

        resp = self.client.post(
            f"/api/submissions/{self.corporate_plan.id}/link-as-attachment/",
            {"parent_submission": self.business_plan.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertFalse(
            SubmissionChecklistItem.objects.filter(
                submission=self.business_plan,
                document__name="Copy of Signed Ministry Corporate Plan",
                is_present=True,
            ).exists()
        )

    def test_cannot_link_already_attached_submission(self):
        other_parent = Submission.objects.create(
            reference_number="SUB-LNK-OTHER",
            title="Some other business plan",
            form_type_code="BUSINESS-PLAN",
            ministry=self.ministry,
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        self.corporate_plan.is_attachment = True
        self.corporate_plan.parent_submission = other_parent
        self.corporate_plan.save(update_fields=["is_attachment", "parent_submission"])

        resp = self.client.post(
            f"/api/submissions/{self.corporate_plan.id}/link-as-attachment/",
            {"parent_submission": self.business_plan.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_cannot_link_mismatched_form_type(self):
        unrelated = Submission.objects.create(
            reference_number="SUB-LNK-UNREL",
            title="Unrelated leave payout",
            form_type_code="LEAVE-PAYOUT",
            ministry=self.ministry,
            current_stage=WorkflowStage.APPROVED,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        resp = self.client.post(
            f"/api/submissions/{unrelated.id}/link-as-attachment/",
            {"parent_submission": self.business_plan.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_cannot_link_to_parent_from_another_ministry(self):
        other_ministry = Ministry.objects.create(code="TST-LNK2", name="Other Ministry LNK")
        other_parent = Submission.objects.create(
            reference_number="SUB-LNK-OTHERMIN",
            title="Someone else's business plan",
            form_type_code="BUSINESS-PLAN",
            ministry=other_ministry,
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        resp = self.client.post(
            f"/api/submissions/{self.corporate_plan.id}/link-as-attachment/",
            {"parent_submission": other_parent.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


class BusinessPlanReminderTaskTests(TestCase):
    def setUp(self):
        self.ministry_no_plan = Ministry.objects.create(code="TST-RMD1", name="Ministry Without Plan")
        self.ministry_with_plan = Ministry.objects.create(code="TST-RMD2", name="Ministry With Plan")
        self.hr1 = User.objects.create_user("hruser_rmd1", password="x", email="hr1@example.test")
        Profile.objects.create(user=self.hr1, role=Role.MINISTRY_HR, ministry=self.ministry_no_plan)
        self.hr2 = User.objects.create_user("hruser_rmd2", password="x", email="hr2@example.test")
        Profile.objects.create(user=self.hr2, role=Role.MINISTRY_HR, ministry=self.ministry_with_plan)

        Submission.objects.create(
            reference_number="SUB-RMD-002",
            title="Already lodged Business Plan",
            form_type_code="BUSINESS-PLAN",
            ministry=self.ministry_with_plan,
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=self.hr2,
        )

    def test_reminder_sent_only_to_ministry_without_a_plan(self):
        send_business_plan_deadline_reminders()

        self.assertTrue(
            Notification.objects.filter(recipient=self.hr1, title__icontains="Business Plan due").exists()
        )
        self.assertFalse(
            Notification.objects.filter(recipient=self.hr2, title__icontains="Business Plan due").exists()
        )
        self.assertTrue(any("Business Plan due" in m.subject for m in mail.outbox))


class BusinessPlanFieldPaginationTests(TestCase):
    def test_section_headers_marked_as_page_breaks(self):
        ft = PSCFormType.objects.get(code='BUSINESS-PLAN')
        paged_keys = set(
            ft.fields.filter(start_new_page=True).values_list('field_key', flat=True)
        )
        self.assertEqual(paged_keys, {
            'sec_executive', 'sec_me_framework', 'sec_hr_plan',
            'sec_cashflow', 'sec_procurement', 'sec_issue',
        })

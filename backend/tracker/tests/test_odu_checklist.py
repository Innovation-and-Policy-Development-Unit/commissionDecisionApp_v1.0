"""ODU restructure checklist eligibility and prefill."""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import (
    Ministry,
    ODUChecklistStatus,
    ODURestructureChecklist,
    Profile,
    Role,
    RoutedUnit,
    Submission,
    WorkflowStage,
)
from tracker.odu_checklist_prefill import build_odu_checklist_prefill
from tracker.odu_checklist_rules import (
    submission_eligible_for_odu_checklist,
    submission_in_odu_review_phase,
    user_can_view_odu_checklist,
)

User = get_user_model()


class OduChecklistRulesTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(name="Test Ministry", code="TM")
        self.creator = User.objects.create_user(username="odu_rules_creator", password="x")
        self.submission = Submission.objects.create(
            reference_number="SUB-ODU-001",
            title="Restructure proposal",
            form_type_code="ORG-3.1",
            ministry=self.ministry,
            routed_unit=RoutedUnit.ODU,
            current_stage=WorkflowStage.MANAGER_CHECKLIST_REVIEW,
            received_at=timezone.now(),
            created_by=self.creator,
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

    def test_prefill_officer_assigned_blank_until_allocated(self):
        # Whoever is merely viewing/creating the checklist (e.g. the ministry
        # submitter during Draft) must never leak into odu_officer_assigned.
        viewer = User.objects.create_user(username="hr_viewer", password="x")
        prefill = build_odu_checklist_prefill(self.submission, user=viewer)
        self.assertEqual(prefill["odu_officer_assigned"], "")

    def test_prefill_officer_assigned_from_submission_assignment(self):
        officer = User.objects.create_user(username="real_odu_officer", password="x")
        self.submission.assigned_to = officer
        self.submission.save(update_fields=["assigned_to"])
        prefill = build_odu_checklist_prefill(self.submission)
        self.assertEqual(prefill["odu_officer_assigned"], "real_odu_officer")


class UserCanViewOduChecklistTests(TestCase):
    """user_can_view_odu_checklist() must mirror canShowOduChecklist() in
    frontend/src/utils/oduChecklist.js — per-phase role restriction, not
    just phase eligibility."""

    def setUp(self):
        self.ministry = Ministry.objects.create(name="Test Ministry V", code="TMV")
        self.hr = User.objects.create_user(username="hruser_view", password="x")

    def _submission(self, *, stage, routed_unit=None):
        kwargs = dict(
            reference_number=f"SUB-ODUV-{Submission.objects.count()}",
            title="Restructure proposal",
            form_type_code="ORG-3.1",
            ministry=self.ministry,
            current_stage=stage,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        if routed_unit is not None:
            kwargs["routed_unit"] = routed_unit
        return Submission.objects.create(**kwargs)

    def test_ministry_role_can_view_during_draft(self):
        submission = self._submission(stage=WorkflowStage.DRAFT)
        self.assertTrue(user_can_view_odu_checklist(submission, "ministry_hr"))

    def test_odu_manager_cannot_view_during_draft(self):
        submission = self._submission(stage=WorkflowStage.DRAFT)
        self.assertFalse(user_can_view_odu_checklist(submission, "odu_manager"))

    def test_odu_manager_can_view_during_review(self):
        submission = self._submission(
            stage=WorkflowStage.MANAGER_CHECKLIST_REVIEW, routed_unit=RoutedUnit.ODU,
        )
        self.assertTrue(user_can_view_odu_checklist(submission, "odu_manager"))

    def test_ministry_role_cannot_view_during_review(self):
        submission = self._submission(
            stage=WorkflowStage.MANAGER_CHECKLIST_REVIEW, routed_unit=RoutedUnit.ODU,
        )
        self.assertFalse(user_can_view_odu_checklist(submission, "ministry_hr"))

    def test_broad_view_role_can_view_after_review(self):
        submission = self._submission(
            stage=WorkflowStage.UNDER_ASSESSMENT, routed_unit=RoutedUnit.ODU,
        )
        self.assertTrue(user_can_view_odu_checklist(submission, "psc_officer"))

    def test_ministry_role_cannot_view_after_review(self):
        submission = self._submission(
            stage=WorkflowStage.UNDER_ASSESSMENT, routed_unit=RoutedUnit.ODU,
        )
        self.assertFalse(user_can_view_odu_checklist(submission, "ministry_hr"))

    def test_admin_can_always_view(self):
        submission = self._submission(stage=WorkflowStage.DRAFT)
        self.assertTrue(user_can_view_odu_checklist(submission, "odu_manager", is_admin=True))

    def test_non_restructure_form_type_never_viewable(self):
        submission = self._submission(stage=WorkflowStage.DRAFT)
        submission.form_type_code = "PSC 3-6"
        self.assertFalse(user_can_view_odu_checklist(submission, "ministry_hr"))


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class OduChecklistMinistryWriteAllowlistTests(TestCase):
    """Ministry PATCHes to the Draft checklist may only touch their own 16
    items + submission_type — never ODU-internal routing fields, even via a
    direct API call bypassing the UI (the frontend hides them, but the
    backend must enforce it independently)."""

    def setUp(self):
        self.ministry = Ministry.objects.create(name="Test Ministry W", code="TMW")
        self.hr = User.objects.create_user(username="hruser_write", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.submission = Submission.objects.create(
            reference_number="SUB-ODUW-001",
            title="Restructure proposal",
            form_type_code="ORG-3.1",
            ministry=self.ministry,
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        self.checklist = ODURestructureChecklist.objects.create(
            submission=self.submission, created_by=self.hr, status=ODUChecklistStatus.DRAFT,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.hr)

    def test_odu_officer_assigned_write_is_dropped(self):
        resp = self.client.patch(
            f"/api/odu-checklists/{self.checklist.id}/",
            {"odu_officer_assigned": "hr.moet", "b1_cover_letter": True},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.checklist.refresh_from_db()
        self.assertEqual(self.checklist.odu_officer_assigned, "")
        self.assertTrue(self.checklist.b1_cover_letter)

    def test_manager_odu_write_is_dropped(self):
        resp = self.client.patch(
            f"/api/odu-checklists/{self.checklist.id}/",
            {"manager_odu": "not.the.real.manager"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.checklist.refresh_from_db()
        self.assertEqual(self.checklist.manager_odu, "")

    def test_ministry_department_write_is_dropped(self):
        resp = self.client.patch(
            f"/api/odu-checklists/{self.checklist.id}/",
            {"ministry_department": "Some Other Ministry"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.checklist.refresh_from_db()
        self.assertEqual(self.checklist.ministry_department, "")

    def test_submission_type_write_is_allowed(self):
        resp = self.client.patch(
            f"/api/odu-checklists/{self.checklist.id}/",
            {"submission_type": ODURestructureChecklist.SubmissionType.FULL_RESTRUCTURE},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.checklist.refresh_from_db()
        self.assertEqual(self.checklist.submission_type, ODURestructureChecklist.SubmissionType.FULL_RESTRUCTURE)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class OduChecklistManagerOnlyWriteAllowlistTests(TestCase):
    """b20_manager_final_check / manager_verifier_name / manager_verifier_date
    certify the Manager ODU's own final sign-off — an odu_principal doing the
    rest of the review (recommendation, comments, b17-b19) must not be able
    to write these via a direct API call, even though the frontend disables
    them (frontend-only gates don't stop a direct request)."""

    def setUp(self):
        self.ministry = Ministry.objects.create(name="Test Ministry MO", code="TMO")
        self.principal = User.objects.create_user(username="odu_principal_write", password="x")
        Profile.objects.create(user=self.principal, role=Role.ODU_PRINCIPAL)
        self.manager = User.objects.create_user(username="odu_manager_write", password="x")
        Profile.objects.create(user=self.manager, role=Role.ODU_MANAGER)
        self.submission = Submission.objects.create(
            reference_number="SUB-ODUMO-001",
            title="Restructure proposal",
            form_type_code="ORG-3.1",
            ministry=self.ministry,
            current_stage=WorkflowStage.MANAGER_CHECKLIST_REVIEW,
            routed_unit=RoutedUnit.ODU,
            received_at=timezone.now(),
            created_by=self.manager,
        )
        self.checklist = ODURestructureChecklist.objects.create(
            submission=self.submission, created_by=self.manager, status=ODUChecklistStatus.SUBMITTED,
        )
        self.client = APIClient()

    def test_principal_cannot_write_manager_final_check(self):
        self.client.force_authenticate(user=self.principal)
        resp = self.client.patch(
            f"/api/odu-checklists/{self.checklist.id}/",
            {"b20_manager_final_check": True, "officer_comments": "Looks complete."},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.checklist.refresh_from_db()
        self.assertIsNone(self.checklist.b20_manager_final_check)
        self.assertEqual(self.checklist.officer_comments, "Looks complete.")

    def test_principal_cannot_write_manager_verifier_fields(self):
        self.client.force_authenticate(user=self.principal)
        resp = self.client.patch(
            f"/api/odu-checklists/{self.checklist.id}/",
            {"manager_verifier_name": "Not The Manager", "manager_verifier_date": "2026-08-07"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.checklist.refresh_from_db()
        self.assertEqual(self.checklist.manager_verifier_name, "")
        self.assertIsNone(self.checklist.manager_verifier_date)

    def test_manager_can_write_manager_only_fields(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.patch(
            f"/api/odu-checklists/{self.checklist.id}/",
            {"b20_manager_final_check": True, "manager_verifier_name": "Real Manager"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.checklist.refresh_from_db()
        self.assertTrue(self.checklist.b20_manager_final_check)
        self.assertEqual(self.checklist.manager_verifier_name, "Real Manager")

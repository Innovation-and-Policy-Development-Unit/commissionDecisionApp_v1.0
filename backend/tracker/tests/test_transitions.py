from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.core.exceptions import PermissionDenied
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    Ministry,
    ODUChecklistStatus,
    ODURestructureChecklist,
    Profile,
    Role,
    Submission,
    WorkflowStage,
)
from ..transitions import assert_transition_allowed, iter_allowed_targets


class TransitionTests(TestCase):
    def _call(self, role, current, target):
        assert_transition_allowed(role=role, current_stage=current, target_stage=target)

    def _denied(self, role, current, target):
        with self.assertRaises(PermissionDenied):
            self._call(role, current, target)

    # ── Ministry roles ────────────────────────────────────────────────────
    def test_ministry_hr_submits_draft_to_dg(self):
        self._call(Role.MINISTRY_HR, WorkflowStage.DRAFT, WorkflowStage.PENDING_DG_ENDORSEMENT)

    def test_ministry_hr_cannot_submit_directly_to_psc(self):
        # HR must route through the DG; direct Draft -> Submitted is no longer allowed.
        self._denied(Role.MINISTRY_HR, WorkflowStage.DRAFT, WorkflowStage.SUBMITTED)

    def test_ministry_hr_cannot_skip_to_assessment(self):
        self._denied(Role.MINISTRY_HR, WorkflowStage.DRAFT, WorkflowStage.UNDER_ASSESSMENT)

    def test_ministry_hr_cannot_approve(self):
        self._denied(Role.MINISTRY_HR, WorkflowStage.FORWARDED_TO_COMMISSION, WorkflowStage.APPROVED)

    def test_dept_admin_submits_draft_to_dg(self):
        self._call(Role.DEPT_ADMIN, WorkflowStage.DRAFT, WorkflowStage.PENDING_DG_ENDORSEMENT)

    def test_ministry_can_resubmit_after_clarification(self):
        self._call(Role.MINISTRY_HR, WorkflowStage.RETURNED_FOR_CLARIFICATION, WorkflowStage.PENDING_DG_ENDORSEMENT)

    def test_ministry_can_respond_to_deferral(self):
        self._call(Role.MINISTRY_HR, WorkflowStage.DEFERRED_BACK_TO_HR, WorkflowStage.DRAFT)

    # ── Director-General (Head of Agency) endorsement ─────────────────────
    # Option A: DG endorsement uses the dedicated /endorse/ endpoint which
    # chains PENDING_DG_ENDORSEMENT → DG_APPROVED → SUBMITTED in one call.
    # The standard transition endpoint no longer allows DG → SUBMITTED directly.
    def test_dg_cannot_submit_to_psc_via_standard_transition(self):
        """DG must use /endorse/ endpoint; direct SUBMITTED is blocked."""
        self._denied(Role.HEAD_OF_AGENCY, WorkflowStage.PENDING_DG_ENDORSEMENT, WorkflowStage.SUBMITTED)

    def test_dg_can_return_to_hr(self):
        self._call(Role.HEAD_OF_AGENCY, WorkflowStage.PENDING_DG_ENDORSEMENT, WorkflowStage.DRAFT)

    def test_hr_cannot_endorse_to_psc(self):
        self._denied(Role.MINISTRY_HR, WorkflowStage.PENDING_DG_ENDORSEMENT, WorkflowStage.SUBMITTED)

    def test_hr_targets_from_draft_is_pending_dg(self):
        targets = iter_allowed_targets(Role.MINISTRY_HR, WorkflowStage.DRAFT)
        self.assertEqual(targets, [WorkflowStage.PENDING_DG_ENDORSEMENT.value])

    def test_dg_targets_from_pending(self):
        """DG can return to draft or endorse via DG_APPROVED; SUBMITTED is via /endorse/."""
        targets = iter_allowed_targets(Role.HEAD_OF_AGENCY, WorkflowStage.PENDING_DG_ENDORSEMENT)
        # Return to HR is still available via standard transition
        self.assertIn(WorkflowStage.DRAFT.value, targets)
        # SUBMITTED is no longer a direct standard transition target (use /endorse/ instead)
        self.assertNotIn(WorkflowStage.SUBMITTED.value, targets)

    # ── Receptionist (registry intake) ────────────────────────────────────
    def test_receptionist_can_route_to_manager(self):
        self._call(Role.RECEPTIONIST, WorkflowStage.DRAFT, WorkflowStage.MANAGER_CHECKLIST_REVIEW)

    def test_receptionist_cannot_submit_to_psc(self):
        self._denied(Role.RECEPTIONIST, WorkflowStage.DRAFT, WorkflowStage.SUBMITTED)

    def test_receptionist_cannot_assess(self):
        self._denied(Role.RECEPTIONIST, WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT)

    def test_receptionist_targets_from_draft(self):
        targets = iter_allowed_targets(Role.RECEPTIONIST, WorkflowStage.DRAFT)
        self.assertEqual(targets, [WorkflowStage.MANAGER_CHECKLIST_REVIEW.value])

    # ── Unit manager roles ────────────────────────────────────────────────
    def test_vipam_manager_can_review_checklist(self):
        self._call(Role.VIPAM_MANAGER, WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT)

    def test_vipam_manager_cannot_transition_outside_checklist(self):
        self._denied(Role.VIPAM_MANAGER, WorkflowStage.UNDER_ASSESSMENT, WorkflowStage.FORWARDED_TO_COMMISSION)

    def test_hr_unit_manager_can_review_checklist(self):
        self._call(Role.HR_UNIT_MANAGER, WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT)

    def test_compliance_manager_can_review_checklist(self):
        self._call(Role.COMPLIANCE_MANAGER, WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT)

    # ── PSC Officer ───────────────────────────────────────────────────────
    def test_officer_can_assess(self):
        self._call(Role.PSC_OFFICER, WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT)

    def test_officer_cannot_forward_to_commission(self):
        self._denied(Role.PSC_OFFICER, WorkflowStage.UNDER_ASSESSMENT, WorkflowStage.FORWARDED_TO_COMMISSION)

    def test_officer_cannot_record_decision(self):
        self._denied(Role.PSC_OFFICER, WorkflowStage.COMMISSION_SITTING, WorkflowStage.APPROVED)

    # ── PSC Secretary ─────────────────────────────────────────────────────
    def test_secretary_can_forward_to_commission(self):
        self._call(Role.PSC_SECRETARY, WorkflowStage.UNDER_ASSESSMENT, WorkflowStage.FORWARDED_TO_COMMISSION)

    # Secretariat records the Commission's decision from the signed minutes.
    def test_secretary_can_approve(self):
        self._call(Role.PSC_SECRETARY, WorkflowStage.COMMISSION_SITTING, WorkflowStage.APPROVED)

    def test_secretary_can_manage_minutes(self):
        self._call(Role.PSC_SECRETARY, WorkflowStage.COMMISSION_SITTING, WorkflowStage.MINUTES_DRAFTED_SIGNED)

    # ── Senior Admin Officer (minute-taker, records decisions) ─────────────
    def test_sao_can_approve(self):
        self._call(Role.SENIOR_ADMIN_OFFICER, WorkflowStage.COMMISSION_SITTING, WorkflowStage.APPROVED)

    def test_sao_can_reject(self):
        self._call(Role.SENIOR_ADMIN_OFFICER, WorkflowStage.COMMISSION_SITTING, WorkflowStage.REJECTED)

    # ── PSC Commissioner — does not action submissions directly ────────────
    def test_commissioner_cannot_approve(self):
        self._denied(Role.PSC_COMMISSIONER, WorkflowStage.COMMISSION_SITTING, WorkflowStage.APPROVED)

    def test_commissioner_cannot_reject(self):
        self._denied(Role.PSC_COMMISSIONER, WorkflowStage.COMMISSION_SITTING, WorkflowStage.REJECTED)

    def test_commissioner_cannot_assess(self):
        self._denied(Role.PSC_COMMISSIONER, WorkflowStage.SUBMITTED, WorkflowStage.UNDER_ASSESSMENT)

    # ── Chairperson — endorses agenda & signs minutes elsewhere, not here ──
    def test_chairperson_cannot_approve(self):
        self._denied(Role.CHAIRPERSON, WorkflowStage.COMMISSION_SITTING, WorkflowStage.APPROVED)

    # ── OPSC Manager (PSC_MANAGER) ────────────────────────────────────────
    def test_manager_can_enter_decision(self):
        self._call(Role.PSC_MANAGER, WorkflowStage.MINUTES_DRAFTED_SIGNED, WorkflowStage.DECISION_ENTERED_ASSIGNED)

    def test_manager_can_move_to_implementation(self):
        self._call(Role.PSC_MANAGER, WorkflowStage.DECISION_ENTERED_ASSIGNED, WorkflowStage.UNDER_IMPLEMENTATION)

    def test_manager_can_report_implementation(self):
        self._call(Role.PSC_MANAGER, WorkflowStage.UNDER_IMPLEMENTATION, WorkflowStage.IMPLEMENTATION_REPORT)

    def test_manager_cannot_assess(self):
        self._denied(Role.PSC_MANAGER, WorkflowStage.SUBMITTED, WorkflowStage.UNDER_ASSESSMENT)

    # ── Principal / Senior Officer ────────────────────────────────────────
    def test_principal_officer_can_update_implementation(self):
        self._call(Role.PRINCIPAL_OFFICER, WorkflowStage.DECISION_ENTERED_ASSIGNED, WorkflowStage.UNDER_IMPLEMENTATION)

    def test_principal_officer_cannot_approve(self):
        self._denied(Role.PRINCIPAL_OFFICER, WorkflowStage.COMMISSION_SITTING, WorkflowStage.APPROVED)

    def test_senior_officer_can_report_implementation(self):
        self._call(Role.SENIOR_OFFICER, WorkflowStage.UNDER_IMPLEMENTATION, WorkflowStage.IMPLEMENTATION_REPORT)

    # ── Matters Arising & Hold States ────────────────────────────────────
    def test_secretariat_can_move_to_matters_arising(self):
        self._call(Role.SENIOR_ADMIN_OFFICER, WorkflowStage.COMMISSION_SITTING, WorkflowStage.MATTERS_ARISING)

    def test_commissioner_cannot_move_to_matters_arising(self):
        self._denied(Role.PSC_COMMISSIONER, WorkflowStage.COMMISSION_SITTING, WorkflowStage.MATTERS_ARISING)

    def test_matters_arising_can_return_to_sitting(self):
        self._call(Role.PSC_SECRETARY, WorkflowStage.MATTERS_ARISING, WorkflowStage.COMMISSION_SITTING)

    def test_officer_can_refer_for_legal_advice(self):
        self._call(Role.PSC_OFFICER, WorkflowStage.UNDER_ASSESSMENT, WorkflowStage.AWAITING_LEGAL_ADVICE)

    def test_legal_advice_can_return_to_assessment(self):
        self._call(Role.PSC_OFFICER, WorkflowStage.AWAITING_LEGAL_ADVICE, WorkflowStage.UNDER_ASSESSMENT)

    def test_ministry_can_respond_to_matters_arising(self):
        self._call(Role.MINISTRY_HR, WorkflowStage.DEFERRED_BACK_TO_HR, WorkflowStage.MATTERS_ARISING)

    # ── PSC Admin (bypasses all) ─────────────────────────────────────────
    def test_admin_can_do_anything(self):
        for stage in WorkflowStage:
            self._call(Role.PSC_ADMIN, WorkflowStage.DRAFT, stage)

    # ── Stage graph validation ────────────────────────────────────────────
    def test_submitted_goes_to_manager_checklist(self):
        targets = iter_allowed_targets(Role.PSC_ADMIN, WorkflowStage.SUBMITTED)
        self.assertIn(WorkflowStage.MANAGER_CHECKLIST_REVIEW.value, targets)

    def test_implementation_report_can_reopen(self):
        targets = iter_allowed_targets(Role.PSC_ADMIN, WorkflowStage.IMPLEMENTATION_REPORT)
        self.assertIn(WorkflowStage.UNDER_IMPLEMENTATION.value, targets)

    def test_approved_can_skip_to_implementation(self):
        targets = iter_allowed_targets(Role.PSC_ADMIN, WorkflowStage.APPROVED)
        self.assertIn(WorkflowStage.UNDER_IMPLEMENTATION.value, targets)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class OduChecklistDraftGateTests(TestCase):
    """A restructure submission (ORG-3.1 / PSC 2-1) can't leave Draft until
    its ODU Restructure Submission Checklist has been Submitted."""

    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-G", name="Test Ministry G")
        self.hr = User.objects.create_user("hruser_gate", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.submission = Submission.objects.create(
            reference_number="SUB-GATE-001",
            title="Restructure proposal",
            form_type_code="ORG-3.1",
            ministry=self.ministry,
            current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(),
            created_by=self.hr,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.hr)

    def _transition(self, new_stage="pending_dg_endorsement"):
        return self.client.post(
            f"/api/submissions/{self.submission.id}/transition/",
            {"new_stage": new_stage},
            format="json",
        )

    def test_blocked_with_no_checklist(self):
        resp = self._transition()
        self.assertEqual(resp.status_code, 400)
        self.assertIn("ODU Restructure Submission Checklist", resp.data["detail"])

    def test_blocked_with_still_draft_checklist(self):
        ODURestructureChecklist.objects.create(
            submission=self.submission, status=ODUChecklistStatus.DRAFT, created_by=self.hr,
        )
        resp = self._transition()
        self.assertEqual(resp.status_code, 400)
        self.assertIn("ODU Restructure Submission Checklist", resp.data["detail"])

    def test_allowed_once_checklist_submitted(self):
        ODURestructureChecklist.objects.create(
            submission=self.submission, status=ODUChecklistStatus.SUBMITTED, created_by=self.hr,
        )
        resp = self._transition()
        self.assertEqual(resp.status_code, 200)
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.current_stage, WorkflowStage.PENDING_DG_ENDORSEMENT)

    def test_non_restructure_form_type_unaffected(self):
        # A form type with no seeded RequiredDocument rows, so the unrelated
        # mandatory-checklist gate (views.py's "Mandatory Checklist/Task
        # Gate") doesn't interfere with isolating this test to the ODU gate.
        self.submission.form_type_code = "TEST-NONE-XYZ"
        self.submission.save(update_fields=["form_type_code"])
        resp = self._transition()
        self.assertEqual(resp.status_code, 200)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DgEndorseActionTests(TestCase):
    """POST /submissions/{id}/endorse/ chains pending_dg_endorsement ->
    dg_approved -> submitted in one call. Regression coverage for two real
    bugs found while pilot-testing a restructure submission: a broken
    notification import that crashed the whole request after the stage
    change had already committed, and a missing auto-routing call that left
    endorsed submissions stuck at 'submitted' with no routed_unit."""

    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-E", name="Test Ministry E")
        self.dg = User.objects.create_user("dguser_endorse", password="x")
        Profile.objects.create(user=self.dg, role=Role.HEAD_OF_AGENCY, ministry=self.ministry)
        self.submission = Submission.objects.create(
            reference_number="SUB-ENDORSE-001",
            title="Restructure proposal",
            form_type_code="ORG-3.1",
            ministry=self.ministry,
            current_stage=WorkflowStage.PENDING_DG_ENDORSEMENT,
            received_at=timezone.now(),
            created_by=self.dg,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.dg)

    def test_endorse_does_not_crash_on_notification_dispatch(self):
        resp = self.client.post(f"/api/submissions/{self.submission.id}/endorse/")
        self.assertEqual(resp.status_code, 200)

    def test_endorse_auto_routes_to_manager_checklist_review(self):
        # ORG-3.1 routes to ODU (intake_routing.py) — ensure endorse() reaches
        # the same auto-advance transition() gets after every transition.
        resp = self.client.post(f"/api/submissions/{self.submission.id}/endorse/")
        self.assertEqual(resp.status_code, 200)
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.current_stage, WorkflowStage.MANAGER_CHECKLIST_REVIEW)
        self.assertEqual(self.submission.routed_unit, "odu")

    def test_endorse_stamps_dg_endorsed_by(self):
        resp = self.client.post(f"/api/submissions/{self.submission.id}/endorse/")
        self.assertEqual(resp.status_code, 200)
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.dg_endorsed_by_id, self.dg.id)
        self.assertIsNotNone(self.submission.dg_endorsed_at)

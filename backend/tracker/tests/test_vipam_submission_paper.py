"""The VIPAM Submission Paper: its form, and the review steps between VIPAM staff."""

from django.contrib.auth.models import User
from django.core.exceptions import PermissionDenied
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import (
    Ministry, Notification, PSCFormField, PSCFormType, Profile, RequiredDocument, Role, Submission, WorkflowStage,
)
from tracker.tests.gate_helpers import satisfy_submit_gate
from tracker.transitions import assert_transition_allowed, iter_allowed_targets

CODE = "VIPAM-SUBMISSION-PAPER"
D, R = WorkflowStage.DRAFT, WorkflowStage.RETURNED_FOR_CLARIFICATION
SENIOR_REV, PRINCIPAL_REV = WorkflowStage.PENDING_SENIOR_REVIEW, WorkflowStage.PENDING_PRINCIPAL_REVIEW
MANAGER_APPR, SEC_APPR = WorkflowStage.PENDING_MANAGER_APPROVAL, WorkflowStage.PENDING_SECRETARY_APPROVAL


def _allowed(role, cur, tgt):
    try:
        assert_transition_allowed(role=role, current_stage=cur, target_stage=tgt,
                                  is_internal=True, form_type_code=CODE)
        return True
    except PermissionDenied:
        return False


class FormTests(TestCase):
    def test_form_type_is_seeded(self):
        ft = PSCFormType.objects.get(code=CODE)
        self.assertEqual(ft.routed_unit, "vipam")
        self.assertEqual(ft.agenda_category, "training")
        self.assertTrue(ft.is_active and ft.is_digitized)
        if ft.form_category_id:
            self.assertEqual(ft.form_category.code, "INTERNAL")

    def test_submission_type_is_fixed_to_three_choices(self):
        f = PSCFormField.objects.get(form_type__code=CODE, field_key="submission_type")
        self.assertEqual(f.field_type, "select")
        self.assertEqual(f.choices.split("\n"), ["Internship", "Training", "Education"])
        self.assertTrue(f.is_required)

    def test_template_sections_are_fields(self):
        keys = set(PSCFormField.objects.filter(form_type__code=CODE).values_list("field_key", flat=True))
        for k in ("purpose", "strategic_alignment", "policy_and_sector", "background_information",
                  "current_situation", "proposed_action", "expected_outcome", "recommendation",
                  "prepared_by", "reviewed_by", "date_prepared"):
            self.assertIn(k, keys)

    def test_psc_form_is_a_required_document(self):
        docs = RequiredDocument.objects.filter(form_type__code=CODE, is_active=True)
        self.assertEqual(docs.count(), 1)
        self.assertIn("5-1", docs[0].name)
        self.assertIn("5-2", docs[0].name)


class LadderTests(TestCase):
    """Who may ask whom to review, and who may only send it back."""

    def test_senior_asks_principal_then_manager(self):
        S = Role.VIPAM_SENIOR
        self.assertTrue(_allowed(S, D, PRINCIPAL_REV))
        self.assertTrue(_allowed(S, R, MANAGER_APPR))
        self.assertFalse(_allowed(S, D, MANAGER_APPR))        # not before a Principal has reviewed
        self.assertFalse(_allowed(S, D, SEC_APPR))
        self.assertFalse(_allowed(S, D, SENIOR_REV))          # a Senior does not review their own

    def test_principal_may_ask_a_senior_or_go_to_the_manager(self):
        P = Role.VIPAM_PRINCIPAL
        self.assertTrue(_allowed(P, D, SENIOR_REV))
        self.assertTrue(_allowed(P, R, SENIOR_REV))
        self.assertTrue(_allowed(P, D, MANAGER_APPR))
        self.assertFalse(_allowed(P, D, SEC_APPR))            # only the Manager goes to the Secretary

    def test_manager_may_ask_principal_or_senior_or_go_straight_to_the_secretary(self):
        M = Role.VIPAM_MANAGER
        self.assertTrue(_allowed(M, D, PRINCIPAL_REV))
        self.assertTrue(_allowed(M, D, SENIOR_REV))
        self.assertTrue(_allowed(M, D, SEC_APPR))
        self.assertTrue(_allowed(M, R, SEC_APPR))

    def test_a_reviewing_senior_can_only_send_it_back(self):
        S = Role.VIPAM_SENIOR
        self.assertTrue(_allowed(S, SENIOR_REV, R))
        self.assertFalse(_allowed(S, SENIOR_REV, MANAGER_APPR))
        self.assertFalse(_allowed(S, SENIOR_REV, SEC_APPR))
        self.assertEqual(iter_allowed_targets(S, SENIOR_REV, is_internal=True), [R])

    def test_principal_and_manager_cannot_act_on_a_paper_waiting_for_senior_review(self):
        for role in (Role.VIPAM_PRINCIPAL, Role.VIPAM_MANAGER):
            self.assertFalse(_allowed(role, SENIOR_REV, SEC_APPR))
            self.assertEqual(iter_allowed_targets(role, SENIOR_REV, is_internal=True), [])

    def test_other_units_do_not_get_the_senior_review_step(self):
        for role in (Role.ODU_PRINCIPAL, Role.ODU_MANAGER, Role.HR_UNIT_PRINCIPAL, Role.COMPLIANCE_MANAGER):
            self.assertFalse(_allowed(role, D, SENIOR_REV))
        self.assertFalse(_allowed(Role.ODU_SENIOR, SENIOR_REV, R))

    def test_offered_actions_match_the_rules(self):
        self.assertIn(SENIOR_REV, iter_allowed_targets(Role.VIPAM_PRINCIPAL, D, is_internal=True))
        self.assertIn(SENIOR_REV, iter_allowed_targets(Role.VIPAM_MANAGER, D, is_internal=True))
        self.assertNotIn(SENIOR_REV, iter_allowed_targets(Role.VIPAM_SENIOR, D, is_internal=True))


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class WorkflowApiTests(TestCase):
    def setUp(self):
        self.principal = self._user("vp_principal", Role.VIPAM_PRINCIPAL)
        self.senior = self._user("vp_senior", Role.VIPAM_SENIOR)
        self.manager = self._user("vp_manager", Role.VIPAM_MANAGER)
        self.other_senior = self._user("vp_senior2", Role.VIPAM_SENIOR)
        self.odu_senior = self._user("vp_odu", Role.ODU_SENIOR)
        self.ministry = Ministry.objects.create(code="ZZ_VP", name="OPSC (test)")
        self.paper = Submission.objects.create(
            ministry=self.ministry, title="Scholarship intake", form_type_code=CODE, reference_number="PSC-2026-95001",
            is_internal=True, routed_unit="vipam", agenda_category="training",
            current_stage=D, received_at=timezone.now(), created_by=self.principal)

    def _user(self, name, role):
        u = User.objects.create_user(name, password="x", email=f"{name}@example.org")
        Profile.objects.create(user=u, role=role)
        return u

    def _move(self, user, target, note=""):
        client = APIClient()
        client.force_authenticate(user)
        return client.post(f"/api/submissions/{self.paper.id}/transition/",
                           {"new_stage": target, "remarks": note}, format="json")

    def test_the_psc_form_must_be_attached_before_asking_for_review(self):
        res = self._move(self.principal, SENIOR_REV)
        self.assertEqual(res.status_code, 400)
        self.assertIn("required document", res.json()["detail"].lower())
        self.paper.refresh_from_db()
        self.assertEqual(self.paper.current_stage, D)

    def test_principal_asks_a_senior_who_is_told_and_sends_it_back(self):
        satisfy_submit_gate(self.paper)
        with self.captureOnCommitCallbacks(execute=True):
            res = self._move(self.principal, SENIOR_REV)
        self.assertEqual(res.status_code, 200, res.content)
        self.paper.refresh_from_db()
        self.assertEqual(self.paper.current_stage, SENIOR_REV)
        # Every VIPAM Senior is told; nobody else is.
        for u in (self.senior, self.other_senior):
            self.assertTrue(Notification.objects.filter(recipient=u, title__startswith="Review required").exists())
        self.assertFalse(Notification.objects.filter(recipient=self.odu_senior).exists())

        back = self._move(self.senior, R, "Tighten the purpose")
        self.assertEqual(back.status_code, 200, back.content)
        self.paper.refresh_from_db()
        self.assertEqual(self.paper.current_stage, R)

        onward = self._move(self.principal, MANAGER_APPR)
        self.assertEqual(onward.status_code, 200, onward.content)

    def test_a_senior_cannot_approve_a_paper_waiting_for_their_review(self):
        satisfy_submit_gate(self.paper)
        self._move(self.principal, SENIOR_REV)
        res = self._move(self.senior, MANAGER_APPR)
        self.assertEqual(res.status_code, 403)

    def test_only_the_author_can_ask_for_review(self):
        satisfy_submit_gate(self.paper)
        res = self._move(self.manager, SENIOR_REV)  # not the creator
        self.assertEqual(res.status_code, 403)

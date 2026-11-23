"""A ministry paper goes to the Secretary first; she forwards it to the unit Manager."""

from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import (
    Ministry, Notification, Profile, PSCFormType, Role, Submission, WorkflowStage,
)
from tracker.tests.gate_helpers import satisfy_submit_gate
from tracker.transitions import assert_transition_allowed, iter_allowed_targets
from django.core.exceptions import PermissionDenied

SUBMIT = {"dg_approval_name": "Mr. John Kalo", "dg_approval_date": "2026-10-01"}


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"], SUBMISSION_RECALL_WINDOW_HOURS=0)
class SecretaryFirstTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_SEC1", name="Secretary First Ministry")
        self.hr = self._user("sf_hr", Role.MINISTRY_HR, ministry=self.ministry)
        self.secretary = self._user("sf_sec", Role.PSC_SECRETARY)
        self.hr_manager = self._user("sf_hrm", Role.HR_UNIT_MANAGER)
        self.odu_manager = self._user("sf_odum", Role.ODU_MANAGER)
        self.officer = self._user("sf_off", Role.PSC_OFFICER)
        PSCFormType.objects.create(code="SF-HR", name="HR form", routed_unit="hr", is_active=True)
        PSCFormType.objects.create(code="SF-NONE", name="Unmapped form", routed_unit="", is_active=True)
        self.sub = self._paper("SF-HR")

    def _user(self, name, role, **kw):
        u = User.objects.create_user(name, password="x", email=f"{name}@example.org")
        Profile.objects.create(user=u, role=role, **kw)
        return u

    def _paper(self, code):
        sub = Submission.objects.create(
            title="Paper", ministry=self.ministry, form_type_code=code,
            current_stage=WorkflowStage.DRAFT, received_at=timezone.now(), created_by=self.hr,
        )
        satisfy_submit_gate(sub, self.hr)
        return sub

    def api(self, user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    def post(self, user, sub, stage, **extra):
        with mock.patch("tracker.tasks.queue_external_submission_confirmation_emails"), \
                mock.patch("tracker.tasks.queue_dg_paper_notice_emails"), \
                self.captureOnCommitCallbacks(execute=True):
            return self.api(user).post(
                f"/api/submissions/{sub.id}/transition/", {"new_stage": stage, **extra}, format="json",
            )

    def submit(self, sub=None):
        sub = sub or self.sub
        res = self.post(self.hr, sub, "submitted", **SUBMIT)
        self.assertEqual(res.status_code, 200, res.content)
        sub.refresh_from_db()
        return sub

    def test_submission_lands_with_the_secretary_not_the_unit(self):
        self.submit()
        self.assertEqual(self.sub.current_stage, WorkflowStage.RECEIVED_BY_PSC)
        self.assertFalse(self.sub.routed_unit)
        self.assertTrue(Notification.objects.filter(recipient=self.secretary, submission=self.sub).exists())
        self.assertFalse(Notification.objects.filter(recipient=self.hr_manager, submission=self.sub).exists())

    def test_unit_manager_cannot_see_it_yet(self):
        self.submit()
        self.assertEqual(self.api(self.hr_manager).get(f"/api/submissions/{self.sub.id}/").status_code, 404)

    def test_secretary_forwards_to_the_form_types_unit(self):
        self.submit()
        res = self.post(self.secretary, self.sub, "manager_checklist_review", remarks_html="<p>Please review</p>")
        self.assertEqual(res.status_code, 200, res.content)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.MANAGER_CHECKLIST_REVIEW)
        self.assertEqual(self.sub.routed_unit, "hr")
        self.assertTrue(Notification.objects.filter(recipient=self.hr_manager, submission=self.sub).exists())
        self.assertFalse(Notification.objects.filter(recipient=self.odu_manager, submission=self.sub).exists())
        self.assertEqual(self.api(self.hr_manager).get(f"/api/submissions/{self.sub.id}/").status_code, 200)

    def test_secretary_can_choose_another_unit(self):
        self.submit()
        res = self.post(self.secretary, self.sub, "manager_checklist_review", routed_unit="odu")
        self.assertEqual(res.status_code, 200, res.content)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.routed_unit, "odu")
        self.assertTrue(Notification.objects.filter(recipient=self.odu_manager, submission=self.sub).exists())

    def test_secretary_must_pick_a_unit_when_the_form_has_none(self):
        sub = self.submit(self._paper("SF-NONE"))
        res = self.post(self.secretary, sub, "manager_checklist_review")
        self.assertEqual(res.status_code, 400)
        self.assertTrue(res.json().get("needs_routed_unit"))
        sub.refresh_from_db()
        self.assertEqual(sub.current_stage, WorkflowStage.RECEIVED_BY_PSC)

    def test_secretary_can_return_it_to_the_ministry_with_a_comment(self):
        self.submit()
        self.assertEqual(self.post(self.secretary, self.sub, "returned_for_clarification").status_code, 400)
        res = self.post(self.secretary, self.sub, "returned_for_clarification", remarks_html="<p>Missing letter</p>")
        self.assertEqual(res.status_code, 200, res.content)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.RETURNED_FOR_CLARIFICATION)

    def test_only_the_secretary_acts_on_it(self):
        self.submit()
        for user in (self.officer, self.hr_manager, self.hr):
            res = self.post(user, self.sub, "manager_checklist_review")
            self.assertIn(res.status_code, (403, 404), (user.username, res.status_code))
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.RECEIVED_BY_PSC)
        with self.assertRaises(PermissionDenied):
            assert_transition_allowed(
                role=Role.PSC_OFFICER, current_stage=WorkflowStage.RECEIVED_BY_PSC,
                target_stage=WorkflowStage.MANAGER_CHECKLIST_REVIEW,
            )
        self.assertEqual(
            set(iter_allowed_targets(Role.PSC_SECRETARY, WorkflowStage.RECEIVED_BY_PSC)),
            {WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.RETURNED_FOR_CLARIFICATION},
        )
        self.assertEqual(iter_allowed_targets(Role.PSC_OFFICER, WorkflowStage.RECEIVED_BY_PSC), [])

    def test_resubmission_after_return_goes_to_the_secretary_again(self):
        self.submit()
        self.post(self.secretary, self.sub, "returned_for_clarification", remarks_html="<p>Fix</p>")
        self.sub.refresh_from_db()
        satisfy_submit_gate(self.sub, self.hr)  # the package is validated again before resubmitting
        sub = self.submit()
        self.assertEqual(sub.current_stage, WorkflowStage.RECEIVED_BY_PSC)

    def test_opsc_lodged_paper_still_routes_straight_to_the_unit(self):
        from tracker.views import SubmissionViewSet

        self.sub.lodged_from_paper = True
        self.sub.current_stage = WorkflowStage.SUBMITTED
        self.sub.save()
        SubmissionViewSet()._route_submitted_paper(self.sub)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.MANAGER_CHECKLIST_REVIEW)

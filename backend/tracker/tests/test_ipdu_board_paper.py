"""Manager IPDU: creating Task Force / Allowance Payment submissions, the
IPDU Board Paper wizard, and the access-control wiring that has to exist
for a brand-new OPSC unit with no principal/senior tier — see the plan at
review time (glistening-sleeping-aurora.md) for why each of these matters:
queryset visibility, the transition "expected unit" gate, the staff-role
assignment fallback, and the CSU-style short-circuit bug that would block
Manager IPDU from ever acting at their own Manager Checklist Review stage."""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    BoardPaperStatus,
    IPDUBoardPaper,
    Ministry,
    Profile,
    Role,
    RoutedUnit,
    Submission,
    WorkflowStage,
)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class IpduSubmissionCreationTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-IPDU-C", name="Test Ministry IPDU-C")
        self.manager = User.objects.create_user(username="ipdu_mgr_create", password="x")
        Profile.objects.create(user=self.manager, role=Role.IPDU_MANAGER, ministry=self.ministry)
        self.hr = User.objects.create_user(username="ministry_hr_ipdu", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.client = APIClient()

    def test_manager_ipdu_can_create_taskforce_submission(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/submissions/",
            {"title": "Workforce Planning Taskforce", "form_type_code": "IPDU-TASKFORCE", "received_at": timezone.now().isoformat()},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        sub = Submission.objects.get(pk=resp.data["id"])
        self.assertTrue(sub.is_internal)
        self.assertTrue(sub.follows_normal_route)
        self.assertEqual(sub.routed_unit, "")
        self.assertEqual(sub.current_stage, WorkflowStage.DRAFT)

    def test_manager_ipdu_can_create_allowance_submission(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/submissions/",
            {"title": "WFT Allowance Payment", "form_type_code": "IPDU-ALLOWANCE", "received_at": timezone.now().isoformat()},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)

    def test_manager_ipdu_requires_form_type(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post("/api/submissions/", {"title": "No type given"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_ministry_hr_goes_through_a_different_branch_not_is_internal(self):
        # Ministry HR has its own perform_create branch entirely separate from
        # Manager IPDU's — confirms it doesn't accidentally pick up IPDU's
        # is_internal/follows_normal_route treatment just because the form
        # type happens to route to IPDU.
        self.client.force_authenticate(user=self.hr)
        resp = self.client.post(
            "/api/submissions/",
            {"title": "Ministry-drafted", "form_type_code": "IPDU-TASKFORCE", "ministry": self.ministry.id, "received_at": timezone.now().isoformat()},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        sub = Submission.objects.get(pk=resp.data["id"])
        self.assertFalse(sub.is_internal)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class IpduAutoRoutingAndSelfServiceTests(TestCase):
    """Covers the auto-advance-on-submit mechanism and the decision-4
    regression: Manager IPDU must be able to act at Manager Checklist
    Review themselves (no separate principal exists to hand it back)."""

    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-IPDU-R", name="Test Ministry IPDU-R")
        self.manager = User.objects.create_user(username="ipdu_mgr_route", password="x")
        Profile.objects.create(user=self.manager, role=Role.IPDU_MANAGER, ministry=self.ministry)
        self.client = APIClient()
        self.client.force_authenticate(user=self.manager)

    def _create_draft(self, form_code="IPDU-TASKFORCE"):
        resp = self.client.post(
            "/api/submissions/",
            {"title": "Test Taskforce", "form_type_code": form_code, "received_at": timezone.now().isoformat()},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        return Submission.objects.get(pk=resp.data["id"])

    def test_submit_auto_routes_to_ipdu_and_advances_to_checklist_review(self):
        sub = self._create_draft()
        resp = self.client.post(
            f"/api/submissions/{sub.id}/transition/",
            {"new_stage": WorkflowStage.SUBMITTED, "acknowledge_gaps": True},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        sub.refresh_from_db()
        self.assertEqual(sub.routed_unit, RoutedUnit.IPDU)
        self.assertEqual(sub.current_stage, WorkflowStage.MANAGER_CHECKLIST_REVIEW)

    def test_manager_ipdu_self_advances_past_checklist_review(self):
        # The decision-4 regression: if the IPDU_MANAGER check in
        # transitions.py unconditionally returned (like CSU's does), this
        # would 403 — there's no separate principal to do it instead.
        from ..models import SubmissionChecklistItem
        from ..submission_checklist import ensure_submission_checklist_items

        sub = self._create_draft()
        self.client.post(
            f"/api/submissions/{sub.id}/transition/",
            {"new_stage": WorkflowStage.SUBMITTED, "acknowledge_gaps": True},
            format="json",
        )
        sub.refresh_from_db()
        self.assertEqual(sub.current_stage, WorkflowStage.MANAGER_CHECKLIST_REVIEW)

        # Satisfy the (unrelated) required-documents checklist gate so this
        # test isolates the decision-4 permission question specifically.
        ensure_submission_checklist_items(sub)
        SubmissionChecklistItem.objects.filter(submission=sub).update(
            is_present=True, checked_by=self.manager,
        )

        resp = self.client.post(
            f"/api/submissions/{sub.id}/transition/",
            {"new_stage": WorkflowStage.UNDER_ASSESSMENT},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        sub.refresh_from_db()
        self.assertEqual(sub.current_stage, WorkflowStage.UNDER_ASSESSMENT)

    def test_manager_ipdu_sees_own_draft_in_submission_list(self):
        # Queryset-visibility regression: without the IPDU branch in
        # _submission_queryset_for, this would return zero results even for
        # Manager IPDU's own draft (routed_unit is blank pre-submission).
        sub = self._create_draft()
        resp = self.client.get("/api/submissions/")
        self.assertEqual(resp.status_code, 200)
        ids = [row["id"] for row in resp.data["results"]] if "results" in resp.data else [
            row["id"] for row in resp.data
        ]
        self.assertIn(sub.id, ids)

    def test_manager_ipdu_sees_own_submission_after_routing(self):
        sub = self._create_draft()
        self.client.post(
            f"/api/submissions/{sub.id}/transition/",
            {"new_stage": WorkflowStage.SUBMITTED, "acknowledge_gaps": True},
            format="json",
        )
        resp = self.client.get(f"/api/submissions/{sub.id}/")
        self.assertEqual(resp.status_code, 200)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class IpduStaffRoleFallbackTests(TestCase):
    """Manager IPDU has no principal/senior tier — MANAGER_ROLE_TO_ALLOWED_STAFF_ROLES
    must map it to an explicit empty set, not fall back to the broad default
    (every unit's principals/seniors), or Manager IPDU could hand an IPDU
    submission to another unit's staff via /assign/."""

    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-IPDU-A", name="Test Ministry IPDU-A")
        self.manager = User.objects.create_user(username="ipdu_mgr_assign", password="x")
        Profile.objects.create(user=self.manager, role=Role.IPDU_MANAGER, ministry=self.ministry)
        self.odu_principal = User.objects.create_user(username="odu_principal_for_ipdu_test", password="x")
        Profile.objects.create(user=self.odu_principal, role=Role.ODU_PRINCIPAL)

        self.client = APIClient()
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/submissions/",
            {"title": "Test Taskforce Assign", "form_type_code": "IPDU-TASKFORCE", "received_at": timezone.now().isoformat()},
            format="json",
        )
        self.submission = Submission.objects.get(pk=resp.data["id"])
        self.client.post(
            f"/api/submissions/{self.submission.id}/transition/",
            {"new_stage": WorkflowStage.SUBMITTED, "acknowledge_gaps": True},
            format="json",
        )

    def test_cannot_assign_to_another_units_principal(self):
        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/assign/",
            {"assigned_to": self.odu_principal.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class IpduBoardPaperViewSetTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-IPDU-BP", name="Test Ministry IPDU-BP")
        self.manager = User.objects.create_user(username="ipdu_mgr_bp", password="x")
        Profile.objects.create(user=self.manager, role=Role.IPDU_MANAGER, ministry=self.ministry)
        self.secretary = User.objects.create_user(username="secretary_for_ipdu_test", password="x")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)
        self.other_hr = User.objects.create_user(username="other_hr_ipdu_bp", password="x")
        Profile.objects.create(user=self.other_hr, role=Role.MINISTRY_HR, ministry=self.ministry)

        self.client = APIClient()
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/submissions/",
            {"title": "Test Taskforce Board Paper", "form_type_code": "IPDU-TASKFORCE", "received_at": timezone.now().isoformat()},
            format="json",
        )
        self.submission = Submission.objects.get(pk=resp.data["id"])
        self.client.post(
            f"/api/submissions/{self.submission.id}/transition/",
            {"new_stage": WorkflowStage.SUBMITTED, "acknowledge_gaps": True},
            format="json",
        )
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.current_stage, WorkflowStage.MANAGER_CHECKLIST_REVIEW)

    def test_ensure_creates_draft_board_paper(self):
        resp = self.client.get(f"/api/ipdu-board-papers/ensure/?submission={self.submission.id}")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["status"], BoardPaperStatus.DRAFT)
        self.assertTrue(IPDUBoardPaper.objects.filter(submission=self.submission).exists())

    def test_other_role_cannot_ensure(self):
        self.client.force_authenticate(user=self.other_hr)
        resp = self.client.get(f"/api/ipdu-board-papers/ensure/?submission={self.submission.id}")
        self.assertEqual(resp.status_code, 403)

    def _ensure_paper(self):
        resp = self.client.get(f"/api/ipdu-board-papers/ensure/?submission={self.submission.id}")
        return resp.data["id"]

    def test_submit_moves_draft_to_submitted(self):
        paper_id = self._ensure_paper()
        resp = self.client.post(f"/api/ipdu-board-papers/{paper_id}/submit/")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["status"], BoardPaperStatus.SUBMITTED)

    def test_secretary_approve_gates_on_submitted_not_manager_approved(self):
        # Regression for the easy copy-paste-from-ODU mistake: IPDU's 3-state
        # model has no MANAGER_APPROVED, so secretary-approve must accept a
        # paper straight from SUBMITTED.
        paper_id = self._ensure_paper()
        self.client.post(f"/api/ipdu-board-papers/{paper_id}/submit/")

        self.client.force_authenticate(user=self.secretary)
        resp = self.client.post(f"/api/ipdu-board-papers/{paper_id}/secretary-approve/")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["status"], BoardPaperStatus.SECRETARY_APPROVED)

    def test_secretary_approve_rejects_draft(self):
        paper_id = self._ensure_paper()
        self.client.force_authenticate(user=self.secretary)
        resp = self.client.post(f"/api/ipdu-board-papers/{paper_id}/secretary-approve/")
        self.assertEqual(resp.status_code, 400)

    def test_return_to_manager_requires_note(self):
        paper_id = self._ensure_paper()
        self.client.post(f"/api/ipdu-board-papers/{paper_id}/submit/")

        self.client.force_authenticate(user=self.secretary)
        resp = self.client.post(f"/api/ipdu-board-papers/{paper_id}/return-to-manager/", {})
        self.assertEqual(resp.status_code, 400)

    def test_return_to_manager_sends_it_back_to_draft(self):
        paper_id = self._ensure_paper()
        self.client.post(f"/api/ipdu-board-papers/{paper_id}/submit/")

        self.client.force_authenticate(user=self.secretary)
        resp = self.client.post(
            f"/api/ipdu-board-papers/{paper_id}/return-to-manager/",
            {"note": "Please add the workplan."},
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["status"], BoardPaperStatus.DRAFT)

    def test_manager_cannot_secretary_approve_their_own_paper(self):
        paper_id = self._ensure_paper()
        self.client.post(f"/api/ipdu-board-papers/{paper_id}/submit/")
        resp = self.client.post(f"/api/ipdu-board-papers/{paper_id}/secretary-approve/")
        self.assertEqual(resp.status_code, 403)

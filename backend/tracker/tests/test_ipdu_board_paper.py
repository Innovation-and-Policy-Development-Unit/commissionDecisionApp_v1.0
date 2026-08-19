"""Manager IPDU: creating Task Force / Allowance Payment submissions, the
IPDU Board Paper content, and the access-control wiring that has to exist
for a brand-new OPSC unit with no principal/senior tier — see the plan at
review time (glistening-sleeping-aurora.md) for why each of these matters:
queryset visibility, the transition "expected unit" gate, the staff-role
assignment fallback, and the CSU-style short-circuit bug that would block
Manager IPDU from ever acting at their own Manager Checklist Review stage
(now only reachable as an edge case — see below).

Revised after live testing surfaced two issues with the first version:
1. The board paper was invisible while the submission was still Draft
   (submission_in_board_paper_edit_phase required routed_unit, which isn't
   set until after Submit) — fixed, covered by IpduBoardPaperDraftVisibilityTests.
2. Submit used to land at Manager Checklist Review, needing a second,
   separate "submit the board paper" click before the Secretary ever saw
   it — confusing, and not how the real process works (Manager IPDU hands
   the whole thing to the Secretary directly). Fixed: submit now auto-
   routes straight to Pending Secretary Approval, and the board paper lost
   its own submit/secretary-approve/return-to-manager actions entirely —
   it's just content now, editable while Draft, read-only after. The
   Submission's own generic transition buttons ARE the hand-off."""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
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
class IpduAutoRoutingTests(TestCase):
    """Submit is the one hand-off action: Draft -> Submitted auto-advances
    straight to Pending Secretary Approval, skipping Manager Checklist
    Review/Under Assessment entirely — Manager IPDU is the sole author of
    the board paper, so there's no separate unit checklist review to do on
    it (see _auto_advance_submitted_to_checklist_review's IPDU carve-out)."""

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

    def test_submit_auto_routes_directly_to_pending_secretary_approval(self):
        sub = self._create_draft()
        resp = self.client.post(
            f"/api/submissions/{sub.id}/transition/",
            {"new_stage": WorkflowStage.SUBMITTED, "acknowledge_gaps": True},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        sub.refresh_from_db()
        self.assertEqual(sub.routed_unit, RoutedUnit.IPDU)
        self.assertEqual(sub.current_stage, WorkflowStage.PENDING_SECRETARY_APPROVAL)

    def test_manager_ipdu_can_still_self_advance_if_ever_at_checklist_review(self):
        # Edge-case regression (decision-4 from the original plan): Manager
        # Checklist Review is no longer the normal landing stage, but it's
        # still reachable manually (e.g. Commission DEFERRED -> Manager
        # Checklist Review reset), and Manager IPDU must still be able to
        # act there themselves — no separate principal exists to hand it
        # back to. If the IPDU_MANAGER check in transitions.py unconditionally
        # returned (like CSU's does), this would 403.
        from ..models import SubmissionChecklistItem
        from ..submission_checklist import ensure_submission_checklist_items

        sub = self._create_draft()
        sub.routed_unit = RoutedUnit.IPDU
        sub.current_stage = WorkflowStage.MANAGER_CHECKLIST_REVIEW
        sub.save(update_fields=["routed_unit", "current_stage"])

        # Satisfy the (unrelated) required-documents checklist gate so this
        # test isolates the decision-4 permission question specifically.
        ensure_submission_checklist_items(sub)
        SubmissionChecklistItem.objects.filter(submission=sub).update(
            is_present=True, checked_by=self.manager,
        )

        resp = self.client.post(
            f"/api/submissions/{sub.id}/transition/",
            {"new_stage": WorkflowStage.PENDING_SECRETARY_APPROVAL},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        sub.refresh_from_db()
        self.assertEqual(sub.current_stage, WorkflowStage.PENDING_SECRETARY_APPROVAL)

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
    submission to another unit's staff via /assign/. /assign/ only works at
    Manager Checklist Review/Under Assessment, which IPDU submissions no
    longer land at automatically (see IpduAutoRoutingTests) — set the stage
    directly to exercise this edge case."""

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
        self.submission.routed_unit = RoutedUnit.IPDU
        self.submission.current_stage = WorkflowStage.MANAGER_CHECKLIST_REVIEW
        self.submission.save(update_fields=["routed_unit", "current_stage"])

    def test_cannot_assign_to_another_units_principal(self):
        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/assign/",
            {"assigned_to": self.odu_principal.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class IpduBoardPaperDraftVisibilityTests(TestCase):
    """The board paper must be viewable and editable while the submission is
    still in Draft — before it's ever submitted, when routed_unit is still
    blank. Manager IPDU is the sole author from the very start (no separate
    ministry-drafting phase like ODU's PSC 2-1/ORG-3.1), so without the fix
    in ipdu_rules.py's submission_in_board_paper_edit_phase(), this stayed
    invisible for the entire time it was actually being written."""

    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-IPDU-DRAFT", name="Test Ministry IPDU-DRAFT")
        self.manager = User.objects.create_user(username="ipdu_mgr_draft", password="x")
        Profile.objects.create(user=self.manager, role=Role.IPDU_MANAGER, ministry=self.ministry)
        self.other_hr = User.objects.create_user(username="other_hr_ipdu_draft", password="x")
        Profile.objects.create(user=self.other_hr, role=Role.MINISTRY_HR, ministry=self.ministry)

        self.client = APIClient()
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/submissions/",
            {"title": "Draft Taskforce Board Paper", "form_type_code": "IPDU-TASKFORCE", "received_at": timezone.now().isoformat()},
            format="json",
        )
        self.submission = Submission.objects.get(pk=resp.data["id"])
        self.assertEqual(self.submission.current_stage, WorkflowStage.DRAFT)
        self.assertEqual(self.submission.routed_unit, "")

    def test_ensure_creates_draft_board_paper_while_submission_is_draft(self):
        resp = self.client.get(f"/api/ipdu-board-papers/ensure/?submission={self.submission.id}")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertTrue(IPDUBoardPaper.objects.filter(submission=self.submission).exists())

    def test_manager_can_save_content_while_submission_is_draft(self):
        ensure_resp = self.client.get(f"/api/ipdu-board-papers/ensure/?submission={self.submission.id}")
        paper_id = ensure_resp.data["id"]
        resp = self.client.patch(
            f"/api/ipdu-board-papers/{paper_id}/",
            {"submission": self.submission.id, "background": "Test background text written while still Draft."},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["background"], "Test background text written while still Draft.")

    def test_other_role_still_cannot_ensure_while_submission_is_draft(self):
        self.client.force_authenticate(user=self.other_hr)
        resp = self.client.get(f"/api/ipdu-board-papers/ensure/?submission={self.submission.id}")
        self.assertEqual(resp.status_code, 403)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class IpduBoardPaperReadOnlyAfterSubmitTests(TestCase):
    """Once the submission has been handed to the Secretary (Pending
    Secretary Approval), the board paper is content Manager IPDU wrote —
    it stays visible for everyone with view access, but is no longer
    editable by anyone. There's no separate board-paper submit/approve
    action anymore (removed — see module docstring): the Submission's own
    workflow transitions are the only way forward from here."""

    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-IPDU-RO", name="Test Ministry IPDU-RO")
        self.manager = User.objects.create_user(username="ipdu_mgr_ro", password="x")
        Profile.objects.create(user=self.manager, role=Role.IPDU_MANAGER, ministry=self.ministry)
        self.secretary = User.objects.create_user(username="secretary_for_ipdu_ro", password="x")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)
        self.other_hr = User.objects.create_user(username="other_hr_ipdu_ro", password="x")
        Profile.objects.create(user=self.other_hr, role=Role.MINISTRY_HR, ministry=self.ministry)

        self.client = APIClient()
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/submissions/",
            {"title": "Test Taskforce Read Only", "form_type_code": "IPDU-TASKFORCE", "received_at": timezone.now().isoformat()},
            format="json",
        )
        self.submission = Submission.objects.get(pk=resp.data["id"])
        ensure_resp = self.client.get(f"/api/ipdu-board-papers/ensure/?submission={self.submission.id}")
        self.paper_id = ensure_resp.data["id"]

        self.client.post(
            f"/api/submissions/{self.submission.id}/transition/",
            {"new_stage": WorkflowStage.SUBMITTED, "acknowledge_gaps": True},
            format="json",
        )
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.current_stage, WorkflowStage.PENDING_SECRETARY_APPROVAL)

    def test_manager_can_still_view_after_submit(self):
        resp = self.client.get(f"/api/ipdu-board-papers/ensure/?submission={self.submission.id}")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["id"], self.paper_id)

    def test_manager_cannot_edit_after_submit(self):
        resp = self.client.patch(
            f"/api/ipdu-board-papers/{self.paper_id}/",
            {"submission": self.submission.id, "background": "Trying to edit after handoff."},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_secretary_can_view_after_submit(self):
        self.client.force_authenticate(user=self.secretary)
        resp = self.client.get(f"/api/ipdu-board-papers/ensure/?submission={self.submission.id}")
        self.assertEqual(resp.status_code, 200, resp.data)

    def test_other_role_still_cannot_view(self):
        self.client.force_authenticate(user=self.other_hr)
        resp = self.client.get(f"/api/ipdu-board-papers/ensure/?submission={self.submission.id}")
        self.assertEqual(resp.status_code, 403)

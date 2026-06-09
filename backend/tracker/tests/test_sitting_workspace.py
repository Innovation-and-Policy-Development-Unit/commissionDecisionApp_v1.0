"""Sitting Workspace (meeting-as-project) endpoint tests.

Covers GET /api/meetings/{id}/workspace/ and the section-aware agenda reorder
used to move items between lanes by drag-and-drop.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import (
    AgendaItem, AgendaSection, Meeting, Ministry, Profile, Role,
    Submission, WorkflowStage,
)


class SittingWorkspaceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="ZZ_WS", name="Workspace Ministry")

        self.secretary = User.objects.create_user(username="ws_secretary", password="pass")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)

        # Firewalled ministry user — must not see other ministries' backlog.
        self.hr = User.objects.create_user(username="ws_hr", password="pass")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)

        self.section = AgendaSection.objects.create(
            code="ws_rec", label="Recruitment", display_order=1, is_active=True,
        )
        self.other_section = AgendaSection.objects.create(
            code="ws_dis", label="Discipline", display_order=2, is_active=True,
        )

        self.meeting = Meeting.objects.create(
            title="Workspace Sitting", date="2026-07-01", time="09:00",
            venue="Boardroom", min_items=2, max_items=10,
        )

        # One submission already placed on the agenda, one still in the backlog.
        self.placed_sub = self._submission("Placed matter")
        self.backlog_sub = self._submission("Backlog matter")
        self.item = AgendaItem.objects.create(
            meeting=self.meeting, submission=self.placed_sub,
            category=self.section.code, sequence=1,
        )

    def _submission(self, title):
        return Submission.objects.create(
            title=title,
            received_at=timezone.now(),
            created_by=self.secretary,
            ministry=self.ministry,
            is_internal=False,
            current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
        )

    # ── workspace payload ───────────────────────────────────────────────────
    def test_workspace_payload_splits_agenda_and_backlog(self):
        self.client.force_authenticate(user=self.secretary)
        res = self.client.get(f"/api/meetings/{self.meeting.id}/workspace/")
        self.assertEqual(res.status_code, 200)

        # Placed item appears on the agenda, not the backlog.
        agenda_ids = {row["submission"] for row in res.data["agenda"]}
        backlog_ids = {row["submission_id"] for row in res.data["backlog"]}
        self.assertIn(self.placed_sub.id, agenda_ids)
        self.assertNotIn(self.placed_sub.id, backlog_ids)
        self.assertIn(self.backlog_sub.id, backlog_ids)

        # Sections and readiness summary are present.
        section_codes = {s["code"] for s in res.data["sections"]}
        self.assertTrue({self.section.code, self.other_section.code} <= section_codes)
        self.assertEqual(res.data["readiness"]["placed"], 1)
        self.assertEqual(res.data["readiness"]["capacity"], 10)

    def test_backlog_respects_ministry_firewall(self):
        other_ministry = Ministry.objects.create(code="ZZ_WS2", name="Other Ministry")
        Submission.objects.create(
            title="Other ministry matter", received_at=timezone.now(),
            created_by=self.secretary, ministry=other_ministry, is_internal=False,
            current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
        )
        self.client.force_authenticate(user=self.hr)
        res = self.client.get(f"/api/meetings/{self.meeting.id}/workspace/")
        self.assertEqual(res.status_code, 200)
        ministries = {row["ministry"] for row in res.data["backlog"]}
        self.assertNotIn("Other Ministry", ministries)

    # ── section-aware reorder (drag between lanes) ──────────────────────────
    def test_reorder_moves_item_to_new_section(self):
        self.client.force_authenticate(user=self.secretary)
        res = self.client.post(
            "/api/agenda-items/reorder/",
            {"items": [{"id": self.item.id, "category": self.other_section.code, "sequence": 1}]},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.item.refresh_from_db()
        self.assertEqual(self.item.category, self.other_section.code)

    def test_reorder_rejects_unknown_section(self):
        self.client.force_authenticate(user=self.secretary)
        res = self.client.post(
            "/api/agenda-items/reorder/",
            {"items": [{"id": self.item.id, "category": "does_not_exist", "sequence": 1}]},
            format="json",
        )
        self.assertEqual(res.status_code, 400)


class AgendaApprovalChainTests(TestCase):
    """Stage-B chain: SAO builds & submits → Secretary forwards → Chairman endorses."""

    def setUp(self):
        self.client = APIClient()
        self.meeting = Meeting.objects.create(
            title="Chain Sitting", date="2026-08-01", time="09:00", venue="Boardroom",
        )
        self.sao = self._user("chain_sao", Role.SENIOR_ADMIN_OFFICER)
        self.secretary = self._user("chain_secretary", Role.PSC_SECRETARY)
        self.chair = self._user("chain_chair", Role.CHAIRPERSON)

    def _user(self, username, role):
        user = User.objects.create_user(username=username, password="pass")
        Profile.objects.create(user=user, role=role)
        return user

    def _status(self):
        self.meeting.refresh_from_db()
        return self.meeting.agenda_status

    def test_full_chain_advances_through_each_party(self):
        # 1. SAO submits the draft to the Secretary.
        self.client.force_authenticate(user=self.sao)
        res = self.client.post(f"/api/meetings/{self.meeting.id}/submit-agenda/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self._status(), "with_secretary")

        # 2. Secretary forwards to the Chairman.
        self.client.force_authenticate(user=self.secretary)
        res = self.client.post(f"/api/meetings/{self.meeting.id}/forward-agenda/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self._status(), "with_chairman")

        # 3. Chairman endorses.
        self.client.force_authenticate(user=self.chair)
        res = self.client.post(f"/api/meetings/{self.meeting.id}/approve-agenda/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self._status(), "chairman_approved")
        self.meeting.refresh_from_db()
        self.assertEqual(self.meeting.agenda_approved_by_id, self.chair.id)

    def test_secretary_cannot_submit_draft(self):
        self.client.force_authenticate(user=self.secretary)
        res = self.client.post(f"/api/meetings/{self.meeting.id}/submit-agenda/")
        self.assertEqual(res.status_code, 403)

    def test_chairman_cannot_endorse_before_secretary_forwards(self):
        self.client.force_authenticate(user=self.sao)
        self.client.post(f"/api/meetings/{self.meeting.id}/submit-agenda/")
        # Still only with_secretary — Chairman endorsement must be blocked.
        self.client.force_authenticate(user=self.chair)
        res = self.client.post(f"/api/meetings/{self.meeting.id}/approve-agenda/")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self._status(), "with_secretary")

    def test_sao_cannot_forward_to_chairman(self):
        self.client.force_authenticate(user=self.sao)
        self.client.post(f"/api/meetings/{self.meeting.id}/submit-agenda/")
        res = self.client.post(f"/api/meetings/{self.meeting.id}/forward-agenda/")
        self.assertEqual(res.status_code, 403)

"""Sitting Workspace (meeting-as-project) endpoint tests.

Covers GET /api/meetings/{id}/workspace/ and the section-aware agenda reorder
used to move items between lanes by drag-and-drop.
"""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import (
    AgendaItem, AgendaSection, Meeting, Ministry, Profile, Role,
    Submission, SubmissionPrivateNote, WorkflowStage,
)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
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

        # Must stay ahead of `timezone.now()` — the submissions below are
        # received_at=now, and Meeting.effective_cutoff (date minus
        # CUTOFF_DAYS_BEFORE) has to fall after that or is_carryover()
        # reclassifies them as late, landing them in "carryover" instead of
        # "backlog" and silently emptying the set this test asserts against.
        # A hardcoded date (e.g. "2026-07-01") eventually falls into the past
        # and breaks this the same way.
        self.meeting = Meeting.objects.create(
            title="Workspace Sitting", date=(timezone.now() + timedelta(days=30)).date(),
            time="09:00", venue="Boardroom", min_items=2, max_items=10,
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


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class AgendaApprovalChainTests(TestCase):
    """Stage-B chain: Secretary submits directly → Chairman endorses.

    There used to be a separate "with_secretary" holding stage the Senior
    Admin Officer had to submit into before the Secretary could forward it.
    Removed at the Secretary's request — see AgendaStatus's docstring. The
    Senior Admin Officer still has full agenda edit rights (canManageAgenda
    on the frontend covers both roles identically); only the *submit* action
    is Secretary-only now.
    """

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
        # 1. Secretary submits the draft directly to the Chairman.
        self.client.force_authenticate(user=self.secretary)
        res = self.client.post(f"/api/meetings/{self.meeting.id}/submit-to-chairman/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self._status(), "with_chairman")

        # 2. Chairman endorses — this now also circulates in the same action,
        # there's no separate "chairman_approved" resting stage any more.
        self.client.force_authenticate(user=self.chair)
        res = self.client.post(f"/api/meetings/{self.meeting.id}/approve-agenda/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self._status(), "circulated")
        self.meeting.refresh_from_db()
        self.assertEqual(self.meeting.agenda_approved_by_id, self.chair.id)

    def test_sao_cannot_submit_to_chairman(self):
        # SAO can still edit the agenda's content, but only the Secretary
        # may advance its status.
        self.client.force_authenticate(user=self.sao)
        res = self.client.post(f"/api/meetings/{self.meeting.id}/submit-to-chairman/")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(self._status(), "draft")

    def test_chairman_cannot_endorse_while_still_in_draft(self):
        self.client.force_authenticate(user=self.chair)
        res = self.client.post(f"/api/meetings/{self.meeting.id}/approve-agenda/")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self._status(), "draft")

    @patch("tracker.email_notify.notify_agenda_circulated")
    def test_endorsing_auto_circulates_and_notifies(self, mock_notify):
        # Get the agenda to with_chairman first.
        self.client.force_authenticate(user=self.secretary)
        self.client.post(f"/api/meetings/{self.meeting.id}/submit-to-chairman/")

        self.client.force_authenticate(user=self.chair)
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(f"/api/meetings/{self.meeting.id}/approve-agenda/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self._status(), "circulated")
        mock_notify.assert_called_once()
        self.assertEqual(mock_notify.call_args[0][0].id, self.meeting.id)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class SubmissionPrivateNoteTests(TestCase):
    """Commission members' private prep notes — GET/PUT /submissions/{id}/my-note/."""

    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="ZZ_PN", name="Private Notes Ministry")
        self.creator = self._user("pn_creator", Role.PSC_SECRETARY)
        self.submission = Submission.objects.create(
            title="Paper", received_at=timezone.now(), ministry=self.ministry,
            current_stage=WorkflowStage.FORWARDED_TO_COMMISSION, created_by=self.creator,
        )

        self.commissioner_a = self._user("pn_commissioner_a", Role.PSC_COMMISSIONER)
        self.commissioner_b = self._user("pn_commissioner_b", Role.PSC_COMMISSIONER)
        self.officer = self._user("pn_officer", Role.PSC_OFFICER)

    def _user(self, username, role):
        user = User.objects.create_user(username=username, password="pass")
        Profile.objects.create(user=user, role=role)
        return user

    def test_commissioner_can_read_and_write_own_note(self):
        self.client.force_authenticate(user=self.commissioner_a)
        res = self.client.get(f"/api/submissions/{self.submission.id}/my-note/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["body"], "")

        res = self.client.put(
            f"/api/submissions/{self.submission.id}/my-note/", {"body": "Ask about funding."}, format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["body"], "Ask about funding.")

        note = SubmissionPrivateNote.objects.get(submission=self.submission, author=self.commissioner_a)
        self.assertEqual(note.body, "Ask about funding.")

    def test_note_is_private_to_its_author(self):
        SubmissionPrivateNote.objects.create(
            submission=self.submission, author=self.commissioner_a, body="A's private note",
        )
        self.client.force_authenticate(user=self.commissioner_b)
        res = self.client.get(f"/api/submissions/{self.submission.id}/my-note/")
        self.assertEqual(res.status_code, 200)
        # B gets their own (empty) note, never A's.
        self.assertEqual(res.data["body"], "")
        self.assertNotEqual(
            SubmissionPrivateNote.objects.get(submission=self.submission, author=self.commissioner_b).id,
            SubmissionPrivateNote.objects.get(submission=self.submission, author=self.commissioner_a).id,
        )

    def test_non_commission_role_cannot_use_private_notes(self):
        self.client.force_authenticate(user=self.officer)
        res = self.client.get(f"/api/submissions/{self.submission.id}/my-note/")
        self.assertEqual(res.status_code, 403)

    def test_my_notes_lists_full_agenda_in_order_with_notes_and_blanks(self):
        meeting = Meeting.objects.create(
            title="Notes Sitting", date="2026-09-01", time="09:00", venue="Boardroom",
        )
        section = AgendaSection.objects.create(
            code="pn_appointments", label="Appointments", display_order=1, is_active=True,
        )
        other_sub = Submission.objects.create(
            title="Second paper", received_at=timezone.now(), ministry=self.ministry,
            current_stage=WorkflowStage.FORWARDED_TO_COMMISSION, created_by=self.creator,
        )
        AgendaItem.objects.create(meeting=meeting, submission=self.submission, category=section.code, sequence=1)
        AgendaItem.objects.create(meeting=meeting, submission=other_sub, category=section.code, sequence=2)
        SubmissionPrivateNote.objects.create(
            submission=self.submission, author=self.commissioner_a, body="Only on the first item.",
        )

        self.client.force_authenticate(user=self.commissioner_a)
        res = self.client.get(f"/api/meetings/{meeting.id}/my-notes/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["items"]), 2)
        self.assertEqual(res.data["items"][0]["submission_id"], self.submission.id)
        self.assertEqual(res.data["items"][0]["note_body"], "Only on the first item.")
        self.assertEqual(res.data["items"][1]["submission_id"], other_sub.id)
        self.assertEqual(res.data["items"][1]["note_body"], "")

    def test_my_notes_requires_commission_role(self):
        meeting = Meeting.objects.create(
            title="Notes Sitting 2", date="2026-09-02", time="09:00", venue="Boardroom",
        )
        self.client.force_authenticate(user=self.officer)
        res = self.client.get(f"/api/meetings/{meeting.id}/my-notes/")
        self.assertEqual(res.status_code, 403)

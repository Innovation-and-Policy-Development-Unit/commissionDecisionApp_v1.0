"""Deputy Secretary: sees what the Secretary sees, changes nothing, except sending the agenda on."""

from datetime import time, timedelta

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from tracker.models import (
    Meeting, MeetingType, Ministry, Notification, Profile, Role, Submission, WorkflowStage,
)
from tracker.read_only_roles import enforce_read_only


def _bearer(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")
    return client


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DeputySecretaryTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_DS", name="Deputy Test Ministry")
        self.deputy = self._user("ds_dep", Role.DEPUTY_SECRETARY)
        self.secretary = self._user("ds_sec", Role.PSC_SECRETARY)
        self.chair = self._user("ds_chair", Role.CHAIRPERSON)
        self.sub = Submission.objects.create(
            title="Paper", ministry=self.ministry, form_type_code="X", reference_number="PSC-2026-90001",
            current_stage=WorkflowStage.RECEIVED_BY_PSC, received_at=timezone.now(), created_by=self.secretary)
        self.meeting = Meeting.objects.create(
            title="Ordinary Sitting", date=timezone.localdate() + timedelta(days=10),
            time=time(9, 0), venue="Boardroom", type=MeetingType.ORDINARY)

    def _user(self, name, role):
        u = User.objects.create_user(name, password="x", email=f"{name}@example.org")
        Profile.objects.create(user=u, role=role)
        return u

    # ── view ────────────────────────────────────────────────────────────────
    def test_sees_the_papers_the_secretary_sees(self):
        res = _bearer(self.deputy).get("/api/submissions/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        rows = data["results"] if isinstance(data, dict) else data
        self.assertIn(self.sub.id, [r["id"] for r in rows])
        self.assertEqual(_bearer(self.deputy).get(f"/api/submissions/{self.sub.id}/").status_code, 200)

    def test_sees_the_draft_agenda(self):
        from tracker.opsc_access import agenda_content_visible_to
        self.assertTrue(agenda_content_visible_to(self.deputy, "draft"))
        self.assertFalse(agenda_content_visible_to(self._user("ds_other", Role.PSC_COMMISSIONER), "draft"))

    # ── the one action ──────────────────────────────────────────────────────
    def test_can_submit_the_agenda_to_the_chairman(self):
        with self.captureOnCommitCallbacks(execute=True):
            res = _bearer(self.deputy).post(f"/api/meetings/{self.meeting.id}/submit-to-chairman/")
        self.assertEqual(res.status_code, 200, res.content)
        self.meeting.refresh_from_db()
        self.assertEqual(self.meeting.agenda_status, "with_chairman")
        self.assertTrue(Notification.objects.filter(
            recipient=self.chair, title__startswith="Agenda awaiting your endorsement").exists())

    # ── everything else is refused ──────────────────────────────────────────
    def test_cannot_forward_an_incoming_paper_to_a_unit_manager(self):
        res = _bearer(self.deputy).post(
            f"/api/submissions/{self.sub.id}/transition/",
            {"target_stage": WorkflowStage.MANAGER_CHECKLIST_REVIEW, "routed_unit": "hr"}, format="json")
        self.assertEqual(res.status_code, 403)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.RECEIVED_BY_PSC)

    def test_cannot_change_a_paper_or_comment_or_delete(self):
        client = _bearer(self.deputy)
        self.assertEqual(client.patch(f"/api/submissions/{self.sub.id}/", {"title": "x"}, format="json").status_code, 403)
        self.assertEqual(client.delete(f"/api/submissions/{self.sub.id}/").status_code, 403)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.title, "Paper")

    def test_cannot_approve_the_agenda_or_touch_other_meetings_actions(self):
        client = _bearer(self.deputy)
        self.assertEqual(client.post(f"/api/meetings/{self.meeting.id}/approve-agenda/").status_code, 403)

    def test_the_refusal_says_why(self):
        res = _bearer(self.deputy).post(f"/api/submissions/{self.sub.id}/transition/", {}, format="json")
        self.assertIn("view-only", res.json()["detail"])

    def test_the_secretary_is_not_affected(self):
        res = _bearer(self.secretary).post(f"/api/meetings/{self.meeting.id}/submit-to-chairman/")
        self.assertEqual(res.status_code, 200)

    # ── own account still works ─────────────────────────────────────────────
    def test_can_read_own_notifications(self):
        n = Notification.objects.create(recipient=self.deputy, title="Hello")
        client = _bearer(self.deputy)
        self.assertEqual(client.post(f"/api/notifications/{n.id}/mark_read/").status_code, 200)
        self.assertEqual(client.post("/api/notifications/mark_all_read/").status_code, 200)

    def test_guard_allows_account_paths(self):
        class R:  # minimal request stand-in
            def __init__(self, method, path): self.method, self.path = method, path
        for path in ("/api/auth/logout/", "/api/me/change-password/", "/api/auth/session-pin/setup/"):
            enforce_read_only(R("POST", path), self.deputy)  # must not raise

    def test_other_roles_are_not_restricted_by_the_guard(self):
        class R:
            method, path = "POST", "/api/submissions/1/transition/"
        enforce_read_only(R(), self.secretary)  # must not raise

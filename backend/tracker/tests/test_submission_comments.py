"""A7 Collaboration (P1) — submission discussion comments + ministry firewall."""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import Comment, Mention, Ministry, Notification, Profile, Role, Submission


class SubmissionCommentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="ZZ_TEST_A", name="Test Ministry A")

        # PSC officer — sees everything, may post internal notes.
        self.officer = User.objects.create_user(username="psc_officer", password="pass")
        Profile.objects.create(user=self.officer, role=Role.PSC_OFFICER)

        # Ministry HR — firewalled: only own-ministry, non-internal submissions/comments.
        self.hr = User.objects.create_user(username="moe_hr", password="pass")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)

        self.submission = Submission.objects.create(
            title="Ministry matter",
            received_at=timezone.now(),
            created_by=self.hr,
            ministry=self.ministry,
            is_internal=False,
        )
        self.target = f"submission:{self.submission.id}"

    # ── basics ────────────────────────────────────────────────────────────────
    def test_post_and_list_comment(self):
        self.client.force_authenticate(user=self.officer)
        res = self.client.post("/api/comments/", {"target": self.target, "body": "Please review."})
        self.assertEqual(res.status_code, 201)

        res = self.client.get("/api/comments/", {"target": self.target})
        self.assertEqual(res.status_code, 200)
        rows = res.data.get("results", res.data)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["body"], "Please review.")
        self.assertTrue(rows[0]["is_author"])

    def test_empty_body_rejected(self):
        self.client.force_authenticate(user=self.officer)
        res = self.client.post("/api/comments/", {"target": self.target, "body": "   "})
        self.assertEqual(res.status_code, 400)

    def test_no_access_returns_404(self):
        other_ministry = Ministry.objects.create(code="ZZ_TEST_B", name="Test Ministry B")
        outsider = User.objects.create_user(username="moh_hr", password="pass")
        Profile.objects.create(user=outsider, role=Role.MINISTRY_HR, ministry=other_ministry)
        self.client.force_authenticate(user=outsider)
        res = self.client.get("/api/comments/", {"target": self.target})
        self.assertEqual(res.status_code, 404)

    # ── ministry firewall ───────────────────────────────────────────────────────
    def test_internal_comment_hidden_from_ministry_user(self):
        self.client.force_authenticate(user=self.officer)
        self.client.post("/api/comments/", {"target": self.target, "body": "public note"})
        self.client.post("/api/comments/", {"target": self.target, "body": "PSC eyes only", "is_internal": True})

        # Officer sees both.
        res = self.client.get("/api/comments/", {"target": self.target})
        self.assertEqual(len(res.data.get("results", res.data)), 2)

        # Ministry HR sees only the public one.
        self.client.force_authenticate(user=self.hr)
        res = self.client.get("/api/comments/", {"target": self.target})
        rows = res.data.get("results", res.data)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["body"], "public note")

    def test_ministry_user_cannot_create_internal(self):
        self.client.force_authenticate(user=self.hr)
        res = self.client.post(
            "/api/comments/", {"target": self.target, "body": "trying internal", "is_internal": True}
        )
        self.assertEqual(res.status_code, 201)
        self.assertFalse(res.data["is_internal"])  # coerced to public

    # ── edit / soft-delete ──────────────────────────────────────────────────────
    def test_edit_bumps_history(self):
        self.client.force_authenticate(user=self.officer)
        c = self.client.post("/api/comments/", {"target": self.target, "body": "v1"}).data
        res = self.client.patch(f"/api/comments/{c['id']}/", {"body": "v2"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["body"], "v2")
        self.assertEqual(res.data["edit_count"], 1)
        self.assertIsNotNone(res.data["edited_at"])

    def test_cannot_edit_others_comment(self):
        self.client.force_authenticate(user=self.officer)
        c = self.client.post("/api/comments/", {"target": self.target, "body": "mine"}).data
        self.client.force_authenticate(user=self.hr)
        res = self.client.patch(f"/api/comments/{c['id']}/", {"body": "hijack"})
        self.assertEqual(res.status_code, 403)

    def test_soft_delete_tombstones(self):
        self.client.force_authenticate(user=self.officer)
        c = self.client.post("/api/comments/", {"target": self.target, "body": "remove me"}).data
        res = self.client.delete(f"/api/comments/{c['id']}/")
        self.assertEqual(res.status_code, 200)

        # Row retained, flagged deleted, body blanked in representation.
        obj = Comment.objects.get(pk=c["id"])
        self.assertTrue(obj.is_deleted)
        self.assertEqual(obj.deleted_by_id, self.officer.id)

        res = self.client.get("/api/comments/", {"target": self.target})
        rows = res.data.get("results", res.data)
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]["is_deleted"])
        self.assertEqual(rows[0]["body"], "")

    def test_reply_threading(self):
        self.client.force_authenticate(user=self.officer)
        parent = self.client.post("/api/comments/", {"target": self.target, "body": "parent"}).data
        res = self.client.post(
            "/api/comments/", {"target": self.target, "body": "child", "parent": parent["id"]}
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["parent"], parent["id"])


class MentionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="ZZ_MEN_A", name="Mention Ministry A")
        self.officer = User.objects.create_user(username="psc_officer", password="pass", first_name="Pat")
        Profile.objects.create(user=self.officer, role=Role.PSC_OFFICER)
        self.hr = User.objects.create_user(username="moe_hr", password="pass", first_name="Hira")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.submission = Submission.objects.create(
            title="Mention matter",
            received_at=timezone.now(),
            created_by=self.hr,
            ministry=self.ministry,
            is_internal=False,
        )
        self.target = f"submission:{self.submission.id}"

    def _mention(self, user):
        return f"@[{user.get_full_name() or user.username}](user:{user.id})"

    def test_mention_notifies_accessible_user(self):
        self.client.force_authenticate(user=self.officer)
        res = self.client.post(
            "/api/comments/", {"target": self.target, "body": f"Hi {self._mention(self.hr)} please review"}
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Mention.objects.filter(mentioned_user=self.hr).count(), 1)
        notifs = Notification.objects.filter(recipient=self.hr)
        self.assertEqual(notifs.count(), 1)
        self.assertEqual(notifs.first().channel, Notification.Channel.BOTH)  # in-app + email

    def test_self_mention_not_notified(self):
        self.client.force_authenticate(user=self.officer)
        self.client.post(
            "/api/comments/", {"target": self.target, "body": f"note to self {self._mention(self.officer)}"}
        )
        self.assertEqual(Notification.objects.filter(recipient=self.officer).count(), 0)

    def test_internal_mention_to_ministry_user_dropped(self):
        # Internal (PSC-only) comment mentioning a ministry-side user → firewall drops it.
        self.client.force_authenticate(user=self.officer)
        self.client.post(
            "/api/comments/",
            {"target": self.target, "body": f"internal {self._mention(self.hr)}", "is_internal": True},
        )
        self.assertEqual(Mention.objects.filter(mentioned_user=self.hr).count(), 0)
        self.assertEqual(Notification.objects.filter(recipient=self.hr).count(), 0)

    def test_mention_to_user_without_access_dropped(self):
        other_ministry = Ministry.objects.create(code="ZZ_MEN_B", name="Mention Ministry B")
        outsider = User.objects.create_user(username="moh_hr", password="pass")
        Profile.objects.create(user=outsider, role=Role.MINISTRY_HR, ministry=other_ministry)
        self.client.force_authenticate(user=self.officer)
        self.client.post(
            "/api/comments/", {"target": self.target, "body": f"hello {self._mention(outsider)}"}
        )
        self.assertEqual(Notification.objects.filter(recipient=outsider).count(), 0)

    def test_edit_adds_mention_once(self):
        self.client.force_authenticate(user=self.officer)
        c = self.client.post("/api/comments/", {"target": self.target, "body": "v1"}).data
        self.client.patch(f"/api/comments/{c['id']}/", {"body": f"v2 {self._mention(self.hr)}"})
        self.assertEqual(Notification.objects.filter(recipient=self.hr).count(), 1)
        # Re-saving the same mention does not double-notify.
        self.client.patch(f"/api/comments/{c['id']}/", {"body": f"v3 {self._mention(self.hr)}"})
        self.assertEqual(Notification.objects.filter(recipient=self.hr).count(), 1)

    # ── suggest ─────────────────────────────────────────────────────────────────
    def test_suggest_returns_accessible_users(self):
        self.client.force_authenticate(user=self.officer)
        res = self.client.get("/api/mentions/suggest/", {"target": self.target, "q": "hir"})
        self.assertEqual(res.status_code, 200)
        ids = [r["id"] for r in res.data]
        self.assertIn(self.hr.id, ids)
        self.assertNotIn(self.officer.id, ids)  # never suggest yourself

    def test_suggest_denied_for_no_access(self):
        other_ministry = Ministry.objects.create(code="ZZ_MEN_C", name="Mention Ministry C")
        outsider = User.objects.create_user(username="far_hr", password="pass")
        Profile.objects.create(user=outsider, role=Role.MINISTRY_HR, ministry=other_ministry)
        self.client.force_authenticate(user=outsider)
        res = self.client.get("/api/mentions/suggest/", {"target": self.target, "q": "a"})
        self.assertEqual(res.status_code, 404)

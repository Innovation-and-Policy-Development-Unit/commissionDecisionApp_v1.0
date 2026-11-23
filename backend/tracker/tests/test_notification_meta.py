"""Notification kind, the unread filter, the reminder cooldown and the practice-material skip."""

from types import SimpleNamespace

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.email_notify import (
    notify_commissioners_minutes_reminder, notify_decision_unserved,
)
from tracker.models import Ministry, Notification, Profile, Role, Submission, WorkflowStage
from tracker.notification_meta import classify, is_practice_reference


class ClassifyTests(TestCase):
    def test_severity_comes_from_meaning_not_stray_words(self):
        # "approv" used to turn this green.
        self.assertEqual(classify("Secretary Approval Required: PSC-2026-1")[1], "warning")
        self.assertEqual(classify("Minutes approved by Secretary & Chairman — MTG-1")[1], "success")
        self.assertEqual(classify("Overdue: please review the draft minutes — MTG-1")[1], "warning")
        self.assertEqual(classify("Submission rejected: PSC-1")[1], "error")
        self.assertEqual(classify("New sitting scheduled — MTG-1")[1], "info")
        self.assertEqual(classify("Agenda awaiting your endorsement — MTG-1")[1], "warning")

    def test_category(self):
        self.assertEqual(classify("Overdue: please review the draft minutes — M")[0], "minutes")
        self.assertEqual(classify("New sitting scheduled — M")[0], "agenda")
        self.assertEqual(classify("Decision letter not served: P")[0], "decision")
        self.assertEqual(classify("Possible repeat submission: P")[0], "duplicate")
        self.assertEqual(classify("Endorsement required: P")[0], "approval")
        self.assertEqual(classify("AI review of the Business Plan is ready")[0], "ai")
        self.assertEqual(classify("Something unexpected")[0], "general")

    def test_stored_on_create(self):
        u = User.objects.create_user("nm_a", password="x")
        n = Notification.objects.create(recipient=u, title="Overdue: please review the draft minutes — M")
        self.assertEqual((n.category, n.severity), ("minutes", "warning"))

    def test_practice_references(self):
        self.assertTrue(is_practice_reference("TRAIN-MTG-000"))
        self.assertTrue(is_practice_reference("test-odu-bp-001"))
        self.assertFalse(is_practice_reference("PSC-2026-00037"))


class ChaserTests(TestCase):
    def setUp(self):
        self.commissioner = User.objects.create_user("nm_c", password="x", email="c@example.org")
        Profile.objects.create(user=self.commissioner, role=Role.PSC_COMMISSIONER)

    def _minutes(self, ref):
        return SimpleNamespace(meeting=SimpleNamespace(reference_number=ref))

    def test_overdue_reminder_is_not_repeated_within_the_cooldown(self):
        m = self._minutes("MTG-2026-014")
        for _ in range(3):
            notify_commissioners_minutes_reminder(m, [self.commissioner], overdue=True)
        self.assertEqual(Notification.objects.filter(recipient=self.commissioner).count(), 1)

    def test_a_different_sitting_is_a_different_chaser(self):
        notify_commissioners_minutes_reminder(self._minutes("MTG-1"), [self.commissioner], overdue=True)
        notify_commissioners_minutes_reminder(self._minutes("MTG-2"), [self.commissioner], overdue=True)
        self.assertEqual(Notification.objects.filter(recipient=self.commissioner).count(), 2)

    def test_practice_sitting_sends_no_chasers(self):
        notify_commissioners_minutes_reminder(self._minutes("TRAIN-MTG-000"), [self.commissioner], overdue=True)
        self.assertEqual(Notification.objects.count(), 0)

    def test_decision_unserved_skips_test_papers(self):
        manager = User.objects.create_user("nm_m", password="x", email="m@example.org")
        Profile.objects.create(user=manager, role=Role.ODU_MANAGER)
        ministry = Ministry.objects.create(code="ZZ_NM", name="NM ministry")
        real = Submission.objects.create(
            title="Real", ministry=ministry, reference_number="PSC-2026-77001", routed_unit="odu",
            received_at=timezone.now(), created_by=manager, current_stage=WorkflowStage.FORWARDED_TO_COMMISSION)
        test = Submission.objects.create(
            title="Practice", ministry=ministry, reference_number="TEST-ODU-X-001", routed_unit="odu",
            is_test=True, received_at=timezone.now(), created_by=manager, current_stage=WorkflowStage.FORWARDED_TO_COMMISSION)
        notify_decision_unserved(test, 5)
        self.assertEqual(Notification.objects.count(), 0)
        notify_decision_unserved(real, 5)
        notify_decision_unserved(real, 6)  # next day's run: cooldown
        self.assertEqual(Notification.objects.filter(recipient=manager).count(), 1)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class NotificationApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("nm_api", password="x")
        Profile.objects.create(user=self.user, role=Role.PSC_OFFICER)
        self.other = User.objects.create_user("nm_other", password="x")
        Profile.objects.create(user=self.other, role=Role.PSC_OFFICER)
        self.read = Notification.objects.create(recipient=self.user, title="Old news", is_read=True)
        self.unread = Notification.objects.create(recipient=self.user, title="Overdue: minutes — M1")
        Notification.objects.create(recipient=self.other, title="Not yours")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _titles(self, **params):
        data = self.client.get("/api/notifications/", params).json()
        rows = data["results"] if isinstance(data, dict) else data
        return [r["title"] for r in rows]

    def test_unread_filter(self):
        self.assertEqual(len(self._titles()), 2)
        self.assertEqual(self._titles(unread=1), ["Overdue: minutes — M1"])

    def test_category_and_severity_are_returned(self):
        data = self.client.get("/api/notifications/").json()
        rows = data["results"] if isinstance(data, dict) else data
        row = next(r for r in rows if r["id"] == self.unread.id)
        self.assertEqual((row["category"], row["severity"]), ("minutes", "warning"))

    def test_mark_read_and_unread(self):
        self.client.post(f"/api/notifications/{self.unread.id}/mark_read/")
        self.unread.refresh_from_db()
        self.assertTrue(self.unread.is_read)
        self.client.post(f"/api/notifications/{self.unread.id}/mark_unread/")
        self.unread.refresh_from_db()
        self.assertFalse(self.unread.is_read)

    def test_cannot_touch_someone_elses(self):
        theirs = Notification.objects.get(recipient=self.other)
        self.assertEqual(self.client.post(f"/api/notifications/{theirs.id}/mark_read/").status_code, 404)

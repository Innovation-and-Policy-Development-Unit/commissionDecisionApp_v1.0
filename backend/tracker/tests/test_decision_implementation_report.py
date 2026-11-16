"""The Secretary's decision implementation report: open decisions plus those
finished since the last sitting, as JSON and as a PDF."""

from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import (
    CommissionTask, CommissionTaskStatus, CommissionTaskUpdate, Meeting, Profile, Role,
)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DecisionImplementationReportTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username="ir_admin", password="pass")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.today = timezone.localdate()
        Meeting.objects.create(
            title="Last sitting", date=self.today - timedelta(days=14), time="09:00", venue="Hall",
        )
        mk = lambda title, **kw: CommissionTask.objects.create(
            title=title, assigned_manager=self.admin, created_by=self.admin, **kw)
        self.overdue = mk("Overdue one", status=CommissionTaskStatus.IN_PROGRESS,
                          due_date=self.today - timedelta(days=3), action_unit="HRMU")
        self.fresh = mk("Not started", action_unit="CSU")
        self.done_new = mk("Done after sitting", status=CommissionTaskStatus.COMPLETED,
                           completed_at=timezone.now() - timedelta(days=2), action_unit="CSU")
        self.done_old = mk("Done before sitting", status=CommissionTaskStatus.COMPLETED,
                           completed_at=timezone.now() - timedelta(days=30))
        self.cancelled = mk("Cancelled", status=CommissionTaskStatus.CANCELLED)
        CommissionTaskUpdate.objects.create(task=self.overdue, author=self.admin, body="Waiting on Finance.")
        self.client.force_authenticate(user=self.admin)
        self.url = "/api/commission-tasks/implementation-report/"

    def test_lists_open_and_recently_completed_only(self):
        data = self.client.get(self.url).data
        titles = [d["title"] for d in data["decisions"]]
        self.assertEqual(set(titles), {"Overdue one", "Not started", "Done after sitting"})
        self.assertEqual(titles[0], "Overdue one")  # overdue first
        self.assertEqual(titles[-1], "Done after sitting")  # completed last
        self.assertEqual(data["since"], (self.today - timedelta(days=14)).isoformat())
        s = data["summary"]
        self.assertEqual((s["total"], s["open"], s["in_progress"], s["completed_since"], s["overdue"]),
                         (3, 1, 1, 1, 1))
        self.assertEqual(data["decisions"][0]["days_overdue"], 3)
        self.assertEqual(data["decisions"][0]["latest_note"]["body"], "Waiting on Finance.")

    def test_since_override_widens_the_window(self):
        data = self.client.get(self.url, {"since": (self.today - timedelta(days=60)).isoformat()}).data
        self.assertIn("Done before sitting", [d["title"] for d in data["decisions"]])

    def test_bad_since_is_rejected(self):
        self.assertEqual(self.client.get(self.url, {"since": "nope"}).status_code, 400)

    def test_pdf_download(self):
        res = self.client.get(self.url, {"output": "pdf"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertTrue(res.content.startswith(b"%PDF"))

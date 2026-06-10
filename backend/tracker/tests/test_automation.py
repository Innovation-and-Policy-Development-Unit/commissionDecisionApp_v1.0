"""Tests for the Act (Automation) engine — triggers, conditions, safe actions."""

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.automation.engine import run_automation_now
from tracker.models import (
    Automation, AutomationRun, Ministry, Notification, Profile, Role, Submission,
)


class AutomationEngineTests(TestCase):
    def setUp(self):
        Submission.objects.all().delete()
        Automation.objects.all().delete()
        AutomationRun.objects.all().delete()
        self.admin = User.objects.create_user("au_admin", password="x", email="a@psc.gov.vu")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.ministry = Ministry.objects.create(code="AU", name="Auto Ministry")

    def _sub(self, **kw):
        return Submission.objects.create(
            title=kw.pop("title", "S"), ministry=self.ministry, received_at=timezone.now(),
            created_by=self.admin, **kw,
        )

    def test_tag_action_on_update_trigger(self):
        Automation.objects.create(
            name="tag returned", entity="submission", trigger="updated", match="all",
            conditions=[{"field": "current_stage", "op": "eq", "value": "returned_for_clarification"}],
            actions=[{"type": "tag", "params": {"tag": "needs-followup"}}], cooldown_minutes=0,
        )
        s = self._sub(current_stage="returned_for_clarification")  # create fires 'created', not 'updated'
        s.title = "edited"
        s.save()  # fires 'updated' → automation runs
        s.refresh_from_db()
        self.assertIn("needs-followup", s.tags)
        self.assertTrue(AutomationRun.objects.filter(submission=s, status="ran").exists())

    def test_notify_action_emails_assignee_on_create(self):
        Automation.objects.create(
            name="notify", entity="submission", trigger="created", match="all", conditions=[],
            actions=[{"type": "notify", "params": {"to_assignee": True, "message": "hi"}}], cooldown_minutes=0,
        )
        mail.outbox = []
        s = self._sub(assigned_to=self.admin)  # 'created' → notify assignee
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(Notification.objects.filter(recipient=self.admin, submission=s).exists())

    def test_test_mode_simulates_no_side_effects(self):
        Automation.objects.create(
            name="sim", entity="submission", trigger="created", conditions=[],
            actions=[{"type": "tag", "params": {"tag": "x"}}], test_mode=True, cooldown_minutes=0,
        )
        s = self._sub()
        s.refresh_from_db()
        self.assertNotIn("x", s.tags or [])
        self.assertEqual(AutomationRun.objects.get(submission=s).status, "simulated")

    def test_run_now_acts_on_matching(self):
        a = Automation.objects.create(
            name="rn", entity="submission", trigger="schedule", match="all",
            conditions=[{"field": "current_stage", "op": "eq", "value": "submitted"}],
            actions=[{"type": "tag", "params": {"tag": "sched"}}], cooldown_minutes=0,
        )
        s = self._sub(current_stage="submitted")  # 'schedule' trigger → not fired on create
        result = run_automation_now(a)
        self.assertEqual(result["acted"], 1)
        s.refresh_from_db()
        self.assertIn("sched", s.tags)

    def test_cooldown_blocks_repeat(self):
        Automation.objects.create(
            name="cd", entity="submission", trigger="updated", conditions=[],
            actions=[{"type": "tag", "params": {"tag": "y"}}], cooldown_minutes=60,
        )
        s = self._sub()
        s.save()  # first 'updated' → runs
        s.save()  # within cooldown → skipped
        self.assertEqual(AutomationRun.objects.filter(submission=s).count(), 1)


class AutomationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user("au2_admin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.hr = User.objects.create_user("au2_hr", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR)

    def test_non_admin_blocked(self):
        self.client.force_authenticate(self.hr)
        self.assertEqual(self.client.get("/api/automations/").status_code, 403)

    def test_create_and_action_catalog(self):
        self.client.force_authenticate(self.admin)
        fields = self.client.get("/api/automations/fields/", {"entity": "commission_task"}).data
        self.assertIn("shift_due_date", {a["type"] for a in fields["actions"]})
        r = self.client.post("/api/automations/", {
            "name": "A", "entity": "submission", "trigger": "updated",
            "conditions": [{"field": "is_overdue", "op": "is_true"}],
            "actions": [{"type": "escalate", "params": {}}, {"type": "bogus"}],  # bogus dropped
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(len(r.data["actions"]), 1)
        self.assertEqual(r.data["actions"][0]["type"], "escalate")

    def test_test_endpoint_shape(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/automations/test/",
                             {"entity": "submission", "conditions": [], "match": "all"}, format="json")
        self.assertIn("match_count", r.data)
        self.assertIn("sample", r.data)

    def test_runs_export_csv(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.get("/api/automations/runs/export/")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp["Content-Type"].startswith("text/csv"))

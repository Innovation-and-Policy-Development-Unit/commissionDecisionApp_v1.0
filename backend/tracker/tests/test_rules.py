"""Tests for the Submission Rule Engine & Flag Monitor (Phase 1 — Watch)."""

from datetime import timedelta

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import (
    CommissionTask, Meeting, Ministry, Notification, Profile, Role, Submission,
    SubmissionFlag, SubmissionRule, WorkflowStage,
)
from tracker.rules.engine import evaluate_all, evaluate_rule
from tracker.rules.entities import get_adapter


def _matched(entity, rule):
    return get_adapter(entity).matched_ids(rule, timezone.now())


def _overdue(pk, days_past=1):
    Submission.objects.filter(pk=pk).update(assessment_deadline_at=timezone.now() - timedelta(days=days_past))


class RuleEngineTests(TestCase):
    def setUp(self):
        Submission.objects.all().delete()
        SubmissionFlag.objects.all().delete()
        SubmissionRule.objects.all().delete()  # drop seeded built-ins for determinism
        self.admin = User.objects.create_user("rule_admin", password="x", email="a@psc.gov.vu")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.ministry = Ministry.objects.create(code="RU", name="Rule Ministry")
        self.s1 = Submission.objects.create(
            title="overdue", ministry=self.ministry, received_at=timezone.now() - timedelta(days=20),
            created_by=self.admin, current_stage=WorkflowStage.UNDER_ASSESSMENT,
        )
        _overdue(self.s1.pk)  # past deadline (bypasses save() which nulls it)
        self.s2 = Submission.objects.create(
            title="fine", ministry=self.ministry, received_at=timezone.now(),
            created_by=self.admin, current_stage=WorkflowStage.SUBMITTED,
        )

    def _rule(self, conditions, **kw):
        return SubmissionRule.objects.create(
            name=kw.pop("name", "R"), conditions=conditions, match=kw.pop("match", "all"),
            level=kw.pop("level", "critical"), **kw,
        )

    def test_is_overdue_matches_only_overdue(self):
        r = self._rule([{"field": "is_overdue", "op": "is_true"}])
        self.assertEqual(_matched("submission", r), {self.s1.id})

    def test_days_since_received(self):
        r = self._rule([{"field": "days_since_received", "op": "gt", "value": 10}], level="at_risk")
        ids = _matched("submission", r)
        self.assertIn(self.s1.id, ids)
        self.assertNotIn(self.s2.id, ids)

    def test_evaluate_opens_then_clears(self):
        r = self._rule([{"field": "is_overdue", "op": "is_true"}])
        opened, _ = evaluate_rule(r, timezone.now())
        self.assertEqual(opened, 1)
        self.assertTrue(SubmissionFlag.objects.filter(rule=r, submission=self.s1, status="open").exists())
        # Resolve the deadline → no longer matches → flag cleared.
        Submission.objects.filter(pk=self.s1.pk).update(assessment_deadline_at=timezone.now() + timedelta(days=5))
        _, cleared = evaluate_rule(r, timezone.now())
        self.assertEqual(cleared, 1)
        self.assertEqual(SubmissionFlag.objects.get(rule=r, submission=self.s1).status, "cleared")

    def test_alert_emails_and_notifies_when_live(self):
        self.s1.assigned_to = self.admin
        self.s1.save(update_fields=["assigned_to"])  # update_fields keeps the past deadline
        self._rule([{"field": "is_overdue", "op": "is_true"}], test_mode=False, notify_assignee=True)
        mail.outbox = []
        evaluate_all(timezone.now())
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(Notification.objects.filter(recipient=self.admin, submission=self.s1).exists())

    def test_test_mode_suppresses_email(self):
        self.s1.assigned_to = self.admin
        self.s1.save(update_fields=["assigned_to"])
        self._rule([{"field": "is_overdue", "op": "is_true"}], test_mode=True, notify_assignee=True)
        mail.outbox = []
        evaluate_all(timezone.now())
        self.assertEqual(len(mail.outbox), 0)  # in-app only

    def test_realert_re_notifies_after_cooldown(self):
        self.s1.assigned_to = self.admin
        self.s1.save(update_fields=["assigned_to"])
        self._rule([{"field": "is_overdue", "op": "is_true"}], notify_assignee=True, realert=True, cooldown_minutes=60)
        now = timezone.now()
        mail.outbox = []
        evaluate_all(now)
        self.assertEqual(len(mail.outbox), 1)          # first alert
        mail.outbox = []
        evaluate_all(now)
        self.assertEqual(len(mail.outbox), 0)          # within cooldown → no re-alert
        mail.outbox = []
        evaluate_all(now + timedelta(minutes=61))
        self.assertEqual(len(mail.outbox), 1)          # cooldown elapsed → re-alert


class FlagMonitorAPITests(TestCase):
    def setUp(self):
        Submission.objects.all().delete()
        SubmissionFlag.objects.all().delete()
        SubmissionRule.objects.all().delete()
        self.client = APIClient()
        self.admin = User.objects.create_user("fm_admin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.min_a = Ministry.objects.create(code="A", name="Min A")
        self.min_b = Ministry.objects.create(code="B", name="Min B")
        self.hr = User.objects.create_user("fm_hr", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.min_a)
        self.rule = SubmissionRule.objects.create(name="R", level="critical",
                                                  conditions=[{"field": "is_overdue", "op": "is_true"}])
        self.sa = Submission.objects.create(title="A", ministry=self.min_a, received_at=timezone.now(),
                                            created_by=self.admin, is_internal=False, current_stage=WorkflowStage.UNDER_ASSESSMENT)
        self.sb = Submission.objects.create(title="B", ministry=self.min_b, received_at=timezone.now(),
                                            created_by=self.admin, is_internal=False, current_stage=WorkflowStage.UNDER_ASSESSMENT)
        Submission.objects.filter(pk__in=[self.sa.pk, self.sb.pk]).update(assessment_deadline_at=timezone.now() - timedelta(days=1))
        SubmissionFlag.objects.create(rule=self.rule, submission=self.sa)
        SubmissionFlag.objects.create(rule=self.rule, submission=self.sb)

    def test_admin_sees_all_flags(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get("/api/flags/")
        self.assertEqual(r.data["summary"]["total"], 2)
        self.assertEqual(r.data["summary"]["critical"], 2)

    def test_hr_scoped_to_own_ministry(self):
        self.client.force_authenticate(self.hr)
        titles = {f["title"] for f in self.client.get("/api/flags/").data["flags"]}
        self.assertEqual(titles, {"A"})

    def test_acknowledge_flag(self):
        self.client.force_authenticate(self.admin)
        fid = SubmissionFlag.objects.get(submission=self.sa).id
        self.assertEqual(self.client.post(f"/api/flags/{fid}/acknowledge/").data["status"], "acknowledged")

    def test_non_admin_cannot_manage_rules(self):
        self.client.force_authenticate(self.hr)
        self.assertEqual(self.client.get("/api/rules/").status_code, 403)

    def test_rule_dry_run_match_count_and_sample(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/rules/test/",
                             {"conditions": [{"field": "is_overdue", "op": "is_true"}], "match": "all"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["match_count"], 2)
        self.assertTrue(len(r.data["sample"]) >= 1)
        self.assertIn("ref", r.data["sample"][0])

    def test_flags_export_csv(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.get("/api/flags/export/")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp["Content-Type"].startswith("text/csv"))
        self.assertIn("Reference", resp.content.decode())


class BuiltinRulesTests(TestCase):
    def test_builtin_rules_seeded_and_protected(self):
        self.assertTrue(SubmissionRule.objects.filter(is_builtin=True, name="Assessment overdue").exists())
        self.assertTrue(SubmissionRule.objects.filter(is_builtin=True, entity="commission_task").exists())
        self.assertTrue(SubmissionRule.objects.filter(is_builtin=True, entity="meeting").exists())
        admin = User.objects.create_user("b_admin", password="x")
        Profile.objects.create(user=admin, role=Role.PSC_ADMIN)
        client = APIClient()
        client.force_authenticate(admin)
        builtin = SubmissionRule.objects.filter(is_builtin=True).first()
        self.assertEqual(client.delete(f"/api/rules/{builtin.id}/").status_code, 400)


class CommissionTaskRuleTests(TestCase):
    def setUp(self):
        SubmissionRule.objects.all().delete()
        SubmissionFlag.objects.all().delete()
        CommissionTask.objects.all().delete()
        self.mgr = User.objects.create_user("t_mgr", password="x", email="m@psc.gov.vu")
        Profile.objects.create(user=self.mgr, role=Role.PSC_MANAGER)
        self.undelegated = CommissionTask.objects.create(title="undelegated", assigned_manager=self.mgr, created_by=self.mgr, status="open")
        self.delegated = CommissionTask.objects.create(title="delegated", assigned_manager=self.mgr, assigned_staff=self.mgr, created_by=self.mgr, status="open")
        CommissionTask.objects.filter(pk__in=[self.undelegated.pk, self.delegated.pk]).update(created_at=timezone.now() - timedelta(days=5))

    def test_undelegated_chain_matches(self):
        r = SubmissionRule.objects.create(
            name="U", entity="commission_task", level="at_risk", match="all",
            conditions=[
                {"field": "is_undelegated", "op": "is_true"},
                {"field": "status", "op": "eq", "value": "open"},
                {"field": "days_since_created", "op": "gt", "value": 3},
            ],
        )
        ids = _matched("commission_task", r)
        self.assertIn(self.undelegated.id, ids)
        self.assertNotIn(self.delegated.id, ids)

    def test_evaluate_opens_task_flag(self):
        r = SubmissionRule.objects.create(name="U", entity="commission_task", level="at_risk",
                                          conditions=[{"field": "is_undelegated", "op": "is_true"}])
        evaluate_rule(r, timezone.now())
        self.assertTrue(SubmissionFlag.objects.filter(rule=r, commission_task=self.undelegated, status="open").exists())
        self.assertFalse(SubmissionFlag.objects.filter(rule=r, commission_task=self.delegated).exists())


class MeetingRuleTests(TestCase):
    def setUp(self):
        SubmissionRule.objects.all().delete()
        SubmissionFlag.objects.all().delete()
        Meeting.objects.all().delete()
        self.old_done = Meeting.objects.create(
            title="old", date=(timezone.now() - timedelta(days=10)).date(), time="09:00", venue="Hall", status="completed")
        self.recent_done = Meeting.objects.create(
            title="recent", date=timezone.now().date(), time="09:00", venue="Hall", status="completed")

    def test_unsigned_minutes_matches_old_completed(self):
        r = SubmissionRule.objects.create(
            name="M", entity="meeting", level="at_risk", match="all",
            conditions=[
                {"field": "status", "op": "eq", "value": "completed"},
                {"field": "days_since_meeting", "op": "gt", "value": 7},
                {"field": "minutes_signed", "op": "is_false"},
            ],
        )
        ids = _matched("meeting", r)
        self.assertIn(self.old_done.id, ids)
        self.assertNotIn(self.recent_done.id, ids)


class MultiEntityFlagAPITests(TestCase):
    def setUp(self):
        SubmissionRule.objects.all().delete()
        SubmissionFlag.objects.all().delete()
        CommissionTask.objects.all().delete()
        Meeting.objects.all().delete()
        self.client = APIClient()
        self.admin = User.objects.create_user("me_admin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        mgr = User.objects.create_user("me_mgr", password="x")
        task = CommissionTask.objects.create(title="t", assigned_manager=mgr, created_by=mgr, status="open")
        meeting = Meeting.objects.create(title="m", date=timezone.now().date(), time="09:00", venue="H", status="completed")
        tr = SubmissionRule.objects.create(name="TR", entity="commission_task", level="critical", conditions=[])
        mr = SubmissionRule.objects.create(name="MR", entity="meeting", level="at_risk", conditions=[])
        SubmissionFlag.objects.create(rule=tr, commission_task=task)
        SubmissionFlag.objects.create(rule=mr, meeting=meeting)

    def test_flags_span_entities(self):
        self.client.force_authenticate(self.admin)
        data = self.client.get("/api/flags/").data
        self.assertEqual(data["summary"]["total"], 2)
        entities = {f["entity"] for f in data["flags"]}
        self.assertEqual(entities, {"commission_task", "meeting"})

    def test_filter_by_entity(self):
        self.client.force_authenticate(self.admin)
        data = self.client.get("/api/flags/", {"entity": "meeting"}).data
        self.assertEqual({f["entity"] for f in data["flags"]}, {"meeting"})

    def test_rule_fields_per_entity(self):
        self.client.force_authenticate(self.admin)
        keys = {f["key"] for f in self.client.get("/api/rules/fields/", {"entity": "commission_task"}).data["fields"]}
        self.assertIn("is_undelegated", keys)

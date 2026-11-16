"""Allocation review: rule + AI suggestions and one-click bulk allocation."""

from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.decision_allocation import unit_manager_for
from tracker.models import (
    AgendaItem, CommissionTask, Meeting, Ministry, Minutes, MinutesStatus,
    Profile, Role, RoleDefinition, Submission, SystemPermission, WorkflowStage,
)


def _grant(role, code):
    perm, _ = SystemPermission.objects.get_or_create(code=code, defaults={"label": code})
    RoleDefinition.objects.get_or_create(role=role)[0].permissions.add(perm)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class AllocationReviewTests(TestCase):
    def setUp(self):
        _grant(Role.PSC_SECRETARY, "allocate_decision")
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="ZZ_AR", name="Alloc Ministry")
        self.secretary = User.objects.create_user(username="ar_sec", password="pass")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)
        self.odu = User.objects.create_user(username="ar_odu", password="pass")
        Profile.objects.create(user=self.odu, role=Role.ODU_MANAGER)
        self.csu = User.objects.create_user(username="ar_csu", password="pass")
        Profile.objects.create(user=self.csu, role=Role.CSU_MANAGER)

        self.meeting = Meeting.objects.create(
            title="AR Sitting", date="2026-06-01", time="09:00", venue="Boardroom",
        )
        self.routed = self._item("Routed matter", "odu", 1)
        self.unrouted = self._item("Unrouted matter", "", 2)
        blocks = [
            {"agenda_item_id": it.id, "sequence": it.sequence, "title": it.submission.title,
             "decision": f"Decision on {it.submission.title}", "decision_type": "approved"}
            for it in (self.routed, self.unrouted)
        ]
        Minutes.objects.create(
            meeting=self.meeting, status=MinutesStatus.SIGNED,
            content={"agenda_items": blocks}, created_by=self.secretary,
        )
        self.client.force_authenticate(user=self.secretary)

    def _item(self, title, unit, seq):
        sub = Submission.objects.create(
            title=title, received_at=timezone.now(), created_by=self.secretary,
            ministry=self.ministry, routed_unit=unit,
            current_stage=WorkflowStage.APPROVED,
        )
        return AgendaItem.objects.create(meeting=self.meeting, submission=sub, category="other", sequence=seq)

    def _by_item(self, data):
        return {r["agenda_item"]: r for r in data["items"]}

    def test_get_gives_rule_suggestion_and_no_ai(self):
        with mock.patch("tracker.ai.task_allocation.suggest_allocations") as ai:
            res = self.client.get("/api/commission-tasks/allocation-suggestions/")
        self.assertEqual(res.status_code, 200)
        ai.assert_not_called()
        rows = self._by_item(res.data)
        self.assertEqual(rows[self.routed.id]["suggestion"]["manager_id"], self.odu.id)
        self.assertEqual(rows[self.routed.id]["suggestion"]["source"], "rule")
        self.assertIsNone(rows[self.unrouted.id]["suggestion"])

    def test_post_fills_unresolved_with_ai_and_drops_invented_managers(self):
        fake = {0: {"manager_id": self.csu.id, "action_unit": "CSU", "due_days": 14,
                    "confidence": 70, "reason": "Admin matter."}}
        with mock.patch("tracker.ai.task_allocation.suggest_allocations", return_value=(fake, None)) as ai:
            res = self.client.post("/api/commission-tasks/allocation-suggestions/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(ai.call_args.args[0]), 1)  # only the unresolved item is sent
        sug = self._by_item(res.data)[self.unrouted.id]["suggestion"]
        self.assertEqual((sug["source"], sug["manager_id"]), ("ai", self.csu.id))

    def test_ai_failure_is_reported_not_raised(self):
        with mock.patch("tracker.ai.task_allocation.suggest_allocations", return_value=(None, "boom")):
            res = self.client.post("/api/commission-tasks/allocation-suggestions/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["ai_error"], "boom")
        self.assertIsNone(self._by_item(res.data)[self.unrouted.id]["suggestion"])

    def test_sanitize_rejects_unknown_manager_and_bad_unit(self):
        from tracker.ai.task_allocation import _sanitize
        out = _sanitize(
            {"suggestions": [
                {"index": 0, "manager_id": 999, "confidence": 90},
                {"index": 1, "manager_id": 5, "action_unit": "NOPE", "confidence": 500, "due_days": 9999},
            ]},
            {5: {}}, 2,
        )
        self.assertNotIn(0, out)
        self.assertEqual((out[1]["action_unit"], out[1]["confidence"], out[1]["due_days"]), ("", 100, 180))

    def test_bulk_allocate_creates_tasks_once(self):
        body = {"allocations": [
            {"agenda_item": self.routed.id, "assigned_manager": self.odu.id},
            {"agenda_item": self.unrouted.id, "assigned_manager": self.csu.id, "action_unit": "CSU", "due_days": 10},
        ]}
        res = self.client.post("/api/commission-tasks/allocate-bulk/", body, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["created"]), 2)
        t = CommissionTask.objects.get(agenda_item=self.unrouted)
        self.assertEqual((t.assigned_manager_id, t.action_unit, t.created_by_id), (self.csu.id, "CSU", self.secretary.id))
        self.assertEqual(t.submission_id, self.unrouted.submission_id)
        self.assertIn("Decision on", t.decision_detail)
        self.assertIsNotNone(t.due_date)
        again = self.client.post("/api/commission-tasks/allocate-bulk/", body, format="json")
        self.assertEqual(again.data["created"], [])
        self.assertEqual(len(again.data["skipped"]), 2)

    def test_bulk_allocate_rejects_non_manager_and_non_allocators(self):
        res = self.client.post("/api/commission-tasks/allocate-bulk/", {"allocations": [
            {"agenda_item": self.routed.id, "assigned_manager": self.secretary.id}]}, format="json")
        self.assertEqual(res.data["created"], [])
        self.client.force_authenticate(user=self.odu)
        self.assertEqual(self.client.get("/api/commission-tasks/allocation-suggestions/").status_code, 403)
        self.assertEqual(self.client.post("/api/commission-tasks/allocate-bulk/", {"allocations": [{}]}, format="json").status_code, 403)

    def test_unit_manager_prefers_least_loaded(self):
        other = User.objects.create_user(username="ar_odu2", password="pass")
        Profile.objects.create(user=other, role=Role.ODU_MANAGER)
        CommissionTask.objects.create(title="busy", assigned_manager=self.odu, created_by=self.secretary)
        self.assertEqual(unit_manager_for("odu").id, other.id)

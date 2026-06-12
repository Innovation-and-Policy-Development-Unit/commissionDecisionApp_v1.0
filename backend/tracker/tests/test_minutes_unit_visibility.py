"""Unit-scoped minutes visibility and post-signing auto-allocation.

Signed minutes are visible to all OPSC staff, but unit staff only see the
agenda items routed to their unit (or assigned to them as a task); other
items render as redacted placeholders. Signing also auto-creates a
CommissionTask per decided item, assigned to the responsible unit manager.
"""

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.decision_allocation import allocate_decision_tasks
from tracker.models import (
    AgendaItem,
    CommissionTask,
    Meeting,
    Ministry,
    Minutes,
    MinutesStatus,
    Notification,
    Profile,
    Role,
    Submission,
    WorkflowStage,
)

ODU_TEXT = "ODU restructure discussion"
HR_TEXT = "HR discipline discussion"


class MinutesUnitVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="ZZ_UV", name="Unit Vis Ministry")

        self.secretary = User.objects.create_user(username="uv_secretary", password="pass")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)
        self.odu_manager = User.objects.create_user(username="uv_odu_mgr", password="pass")
        Profile.objects.create(user=self.odu_manager, role=Role.ODU_MANAGER)
        self.hr_manager = User.objects.create_user(username="uv_hr_mgr", password="pass")
        Profile.objects.create(user=self.hr_manager, role=Role.HR_UNIT_MANAGER)
        self.senior = User.objects.create_user(username="uv_senior", password="pass")
        Profile.objects.create(user=self.senior, role=Role.SENIOR_OFFICER)

        self.meeting = Meeting.objects.create(
            title="Unit Vis Sitting", date="2026-06-01", time="09:00", venue="Boardroom",
        )
        self.odu_sub = self._submission("ODU matter", "odu")
        self.hr_sub = self._submission("HR matter", "hr")
        self.odu_item = AgendaItem.objects.create(
            meeting=self.meeting, submission=self.odu_sub, category="other", sequence=1,
        )
        self.hr_item = AgendaItem.objects.create(
            meeting=self.meeting, submission=self.hr_sub, category="other", sequence=2,
        )
        self.minutes = Minutes.objects.create(
            meeting=self.meeting,
            status=MinutesStatus.SIGNED,
            content={
                "opening": "Opened.",
                "agenda_items": [
                    {
                        "agenda_item_id": self.odu_item.id,
                        "sequence": 1,
                        "submission_ref": "PSC/10/2026",
                        "title": "ODU matter",
                        "discussion": ODU_TEXT,
                        "decision": "Restructure approved",
                        "decision_type": "approved",
                        "action_items": [],
                    },
                    {
                        "agenda_item_id": self.hr_item.id,
                        "sequence": 2,
                        "submission_ref": "PSC/11/2026",
                        "title": "HR matter",
                        "discussion": HR_TEXT,
                        "decision": "Officer dismissed",
                        "decision_type": "approved",
                        "action_items": [],
                    },
                ],
            },
            created_by=self.secretary,
        )

    def _submission(self, title, routed_unit):
        return Submission.objects.create(
            title=title,
            received_at=timezone.now(),
            created_by=self.secretary,
            ministry=self.ministry,
            routed_unit=routed_unit,
            current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
        )

    def _get_minutes(self, user):
        self.client.force_authenticate(user=user)
        res = self.client.get(f"/api/minutes/{self.minutes.id}/")
        self.assertEqual(res.status_code, 200)
        return res.data

    # ── unit-scoped redaction ────────────────────────────────────────────────

    def test_unit_manager_sees_only_own_unit_items(self):
        data = self._get_minutes(self.odu_manager)
        items = data["content"]["agenda_items"]
        self.assertEqual(len(items), 2)  # whole document structure visible
        self.assertEqual(items[0]["discussion"], ODU_TEXT)
        self.assertTrue(items[1]["restricted"])
        self.assertNotIn("discussion", items[1])
        self.assertNotIn(HR_TEXT, str(data))
        # Partial view → no stored full PDF.
        self.minutes.pdf_version.save("m.pdf", ContentFile(b"%PDF"), save=True)
        self.assertIsNone(self._get_minutes(self.odu_manager)["pdf_version"])

    def test_secretariat_sees_everything(self):
        data = self._get_minutes(self.secretary)
        items = data["content"]["agenda_items"]
        self.assertEqual(items[0]["discussion"], ODU_TEXT)
        self.assertEqual(items[1]["discussion"], HR_TEXT)

    def test_unitless_staff_see_structure_only(self):
        data = self._get_minutes(self.senior)
        for block in data["content"]["agenda_items"]:
            self.assertTrue(block.get("restricted"))

    def test_task_assignee_sees_the_item(self):
        CommissionTask.objects.create(
            title="Action ODU decision",
            meeting=self.meeting,
            submission=self.odu_sub,
            agenda_item=self.odu_item,
            assigned_manager=self.odu_manager,
            assigned_staff=self.senior,
            created_by=self.secretary,
        )
        items = self._get_minutes(self.senior)["content"]["agenda_items"]
        self.assertEqual(items[0]["discussion"], ODU_TEXT)
        self.assertTrue(items[1].get("restricted"))

    def test_ministry_side_users_see_no_minutes(self):
        ministry_user = User.objects.create_user(username="uv_ministry", password="pass")
        Profile.objects.create(user=ministry_user, role=Role.MINISTRY_HR)
        self.client.force_authenticate(user=ministry_user)
        self.assertEqual(
            self.client.get(f"/api/minutes/{self.minutes.id}/").status_code, 404,
        )

    def test_drafts_hidden_from_unit_staff(self):
        self.minutes.status = MinutesStatus.DRAFT
        self.minutes.save(update_fields=["status"])
        self.client.force_authenticate(user=self.odu_manager)
        self.assertEqual(
            self.client.get(f"/api/minutes/{self.minutes.id}/").status_code, 404,
        )

    # ── auto-allocation on signing ──────────────────────────────────────────

    def test_allocation_creates_unit_manager_tasks(self):
        stats = allocate_decision_tasks(self.minutes, self.secretary)
        self.assertEqual(stats, {"created": 2, "unallocated": 0})

        odu_task = CommissionTask.objects.get(agenda_item=self.odu_item)
        self.assertEqual(odu_task.assigned_manager, self.odu_manager)
        self.assertEqual(odu_task.action_unit, "ODU")
        self.assertEqual(odu_task.decision_outcome, "approved")
        self.assertEqual(odu_task.decision_detail, "Restructure approved")
        self.assertEqual(odu_task.minute_reference, "Item 1")

        hr_task = CommissionTask.objects.get(agenda_item=self.hr_item)
        self.assertEqual(hr_task.assigned_manager, self.hr_manager)

        notif = Notification.objects.get(recipient=self.odu_manager)
        self.assertIn("allocated to your unit", notif.title)
        self.assertEqual(notif.link, "/secretariat/tasks")

    def test_allocation_is_idempotent(self):
        allocate_decision_tasks(self.minutes, self.secretary)
        stats = allocate_decision_tasks(self.minutes, self.secretary)
        self.assertEqual(stats["created"], 0)
        self.assertEqual(CommissionTask.objects.count(), 2)

    def test_unrouted_decision_notifies_secretariat(self):
        unrouted_sub = self._submission("Unrouted matter", "")
        item = AgendaItem.objects.create(
            meeting=self.meeting, submission=unrouted_sub, category="other", sequence=3,
        )
        self.minutes.content["agenda_items"].append({
            "agenda_item_id": item.id,
            "sequence": 3,
            "title": "Unrouted matter",
            "discussion": "x",
            "decision": "Noted",
            "decision_type": "",
            "action_items": [],
        })
        self.minutes.save(update_fields=["content"])

        stats = allocate_decision_tasks(self.minutes, self.secretary)
        self.assertEqual(stats["unallocated"], 1)
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.secretary,
                title__startswith="Decisions need manual allocation",
            ).exists()
        )

    def test_items_without_decisions_create_no_tasks(self):
        for block in self.minutes.content["agenda_items"]:
            block["decision"] = ""
        self.minutes.save(update_fields=["content"])
        stats = allocate_decision_tasks(self.minutes, self.secretary)
        self.assertEqual(stats, {"created": 0, "unallocated": 0})
        self.assertEqual(CommissionTask.objects.count(), 0)

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
class AllocationBase(TestCase):
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


class AllocationReviewTests(AllocationBase):
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


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DecisionNumberTests(AllocationBase):
    """The Commission's own decision number wins; a fallback is generated only
    when the sitting has the Commission's meeting number."""

    def _set_numbers(self, routed="", unrouted=""):
        m = Minutes.objects.get(meeting=self.meeting)
        for block in m.content["agenda_items"]:
            block["decision_number"] = routed if block["agenda_item_id"] == self.routed.id else unrouted
        m.save()

    def _meeting_no(self, n="23"):
        self.meeting.psc_meeting_number = n
        self.meeting.save()

    def test_real_number_from_minutes_is_used_verbatim_everywhere(self):
        self._set_numbers(routed="03(n)-23-2026", unrouted="62-23-2026")
        res = self.client.get("/api/commission-tasks/allocation-suggestions/")
        shown = {r["agenda_item"]: r["decision_number"] for r in res.data["items"]}
        self.assertEqual(shown, {self.routed.id: "03(n)-23-2026", self.unrouted.id: "62-23-2026"})
        self.client.post("/api/commission-tasks/allocate-bulk/", {"allocations": [
            {"agenda_item": self.routed.id, "assigned_manager": self.odu.id},
            {"agenda_item": self.unrouted.id, "assigned_manager": self.csu.id}]}, format="json")
        self.assertEqual(CommissionTask.objects.get(agenda_item=self.routed).decision_number, "03(n)-23-2026")
        self.assertEqual(CommissionTask.objects.get(agenda_item=self.unrouted).decision_number, "62-23-2026")

    def test_manual_create_uses_real_number_and_keeps_typed_one(self):
        self._set_numbers(routed="10-23-2026")
        payload = {"assigned_manager": self.odu.id, "title": "Manual", "agenda_item": self.routed.id}
        res = self.client.post("/api/commission-tasks/", payload, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["decision_number"], "10-23-2026")
        res = self.client.post("/api/commission-tasks/", {**payload, "agenda_item": self.unrouted.id,
                                                          "decision_number": "99-1-2020"}, format="json")
        self.assertEqual(res.data["decision_number"], "99-1-2020")

    def test_auto_allocation_after_signing_uses_real_number(self):
        from tracker.decision_allocation import allocate_decision_tasks
        self._set_numbers(routed="04-23-2026")
        allocate_decision_tasks(Minutes.objects.get(meeting=self.meeting), self.secretary)
        self.assertEqual(CommissionTask.objects.get(agenda_item=self.routed).decision_number, "04-23-2026")

    def test_no_number_and_no_meeting_number_stays_blank(self):
        self.client.post("/api/commission-tasks/allocate-bulk/", {"allocations": [
            {"agenda_item": self.routed.id, "assigned_manager": self.odu.id}]}, format="json")
        self.assertEqual(CommissionTask.objects.get(agenda_item=self.routed).decision_number, "")

    def test_fallback_uses_psc_meeting_number_not_system_reference_and_avoids_real_numbers(self):
        self._meeting_no("23")
        self._set_numbers(routed="05-23-2026", unrouted="")  # 05 is reserved by the minutes
        self.client.post("/api/commission-tasks/allocate-bulk/", {"allocations": [
            {"agenda_item": self.unrouted.id, "assigned_manager": self.csu.id}]}, format="json")
        self.assertEqual(CommissionTask.objects.get(agenda_item=self.unrouted).decision_number, "06-23-2026")

    def test_intake_decision_number_reaches_the_minutes(self):
        from tracker.minute_intake import apply_intake_to_minutes
        from tracker.models import MinuteAgendaIntake
        MinuteAgendaIntake.objects.create(
            meeting=self.meeting, agenda_item=self.routed, agenda_title="Routed matter",
            decision_text="Approved", decision_number="03(i)-23-2026",
        )
        minutes = apply_intake_to_minutes(self.meeting, self.secretary)
        block = minutes.content["agenda_items"][0]
        self.assertEqual(block["decision_number"], "03(i)-23-2026")


class ActionOfficerParsingTests(TestCase):
    def test_units_in_written_order_and_secretary_skipped(self):
        from tracker.action_officer import parse_action_officer
        self.assertEqual(parse_action_officer("Manager HRM"), ["hr"])
        self.assertEqual(parse_action_officer("Secretary, HRM, CIU"), ["hr", "compliance"])
        self.assertEqual(parse_action_officer("Manager CSU and Manager CSU"), ["csu"])
        self.assertEqual(parse_action_officer("Manager VIPAM / HRDU"), ["vipam"])
        self.assertEqual(parse_action_officer("Secretary"), [])
        self.assertEqual(parse_action_officer(""), [])

    def test_text_source_priority(self):
        from tracker.action_officer import officer_text_for_block
        self.assertEqual(officer_text_for_block({"action_officer": "Manager ODU", "decision": "x (Action Officer: Manager CSU)"}), "Manager ODU")
        self.assertEqual(officer_text_for_block({"decision": "Approved. Action Officer: Manager CIU"}), "Manager CIU")
        self.assertEqual(officer_text_for_block({"decision": "Approved", "action_items": [{"responsible": "Manager HRM"}]}), "Manager HRM")
        self.assertEqual(officer_text_for_block(None), "")


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class NamedActionOfficerAllocationTests(AllocationBase):
    """The Commission's named Action Officer outranks the submission routing."""

    def setUp(self):
        super().setUp()
        self.hr = User.objects.create_user(username="ar_hr", password="pass")
        Profile.objects.create(user=self.hr, role=Role.HR_UNIT_MANAGER)
        m = Minutes.objects.get(meeting=self.meeting)
        for block in m.content["agenda_items"]:
            if block["agenda_item_id"] == self.routed.id:  # routed to ODU
                block["decision"] += " Action Officer: Secretary, Manager HRM, ODU"
        m.save()

    def test_suggestion_follows_named_officer_not_routing(self):
        res = self.client.get("/api/commission-tasks/allocation-suggestions/")
        sug = self._by_item(res.data)[self.routed.id]["suggestion"]
        self.assertEqual((sug["manager_id"], sug["source"], sug["action_unit"]), (self.hr.id, "minutes", "HRMU"))
        self.assertIn("ODU", sug["reason"])  # named as an additional unit

    def test_bulk_allocation_notes_the_other_named_units(self):
        self.client.post("/api/commission-tasks/allocate-bulk/", {"allocations": [
            {"agenda_item": self.routed.id, "assigned_manager": self.hr.id}]}, format="json")
        t = CommissionTask.objects.get(agenda_item=self.routed)
        self.assertEqual(t.assigned_manager_id, self.hr.id)
        self.assertIn("Also named in the minutes", t.description)
        self.assertIn("ODU", t.description)
        self.assertNotIn("HR,", t.description)

    def test_auto_allocation_after_signing_follows_named_officer(self):
        from tracker.decision_allocation import allocate_decision_tasks
        allocate_decision_tasks(Minutes.objects.get(meeting=self.meeting), self.secretary)
        t = CommissionTask.objects.get(agenda_item=self.routed)
        self.assertEqual((t.assigned_manager_id, t.action_unit), (self.hr.id, "HRMU"))

    def test_unknown_officer_falls_back_to_routing(self):
        m = Minutes.objects.get(meeting=self.meeting)
        for block in m.content["agenda_items"]:
            block["decision"] = "Approved. Action Officer: Somebody Else"
        m.save()
        res = self.client.get("/api/commission-tasks/allocation-suggestions/")
        sug = self._by_item(res.data)[self.routed.id]["suggestion"]
        self.assertEqual((sug["manager_id"], sug["source"]), (self.odu.id, "rule"))


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class MinuteAttendanceTests(AllocationBase):
    def setUp(self):
        super().setUp()
        self.meeting.agenda_status = "circulated"
        self.meeting.status = "in_progress"
        self.meeting.save()
        self.chair = User.objects.create_user(username="ar_chair", password="pass", first_name="Meto", last_name="Nganga")
        Profile.objects.create(user=self.chair, role=Role.CHAIRPERSON)
        self.members = []
        for i in range(4):
            u = User.objects.create_user(username=f"ar_c{i}", password="pass", first_name=f"C{i}", last_name="Member")
            Profile.objects.create(user=u, role=Role.PSC_COMMISSIONER if i % 2 else Role.COMMISSION_MEMBER)
            self.members.append(u)
        self.url = f"/api/meetings/{self.meeting.id}/minute-intake/"

    def test_get_prefills_roster_chairman_first(self):
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200, res.data)
        att = res.data["attendance"]
        self.assertFalse(res.data["attendance_saved"])
        self.assertEqual(len(att["members"]), 5)
        self.assertEqual(att["members"][0]["role"], "Chairman")
        self.assertTrue(all(m["status"] == "present" for m in att["members"]))
        self.assertEqual(att["start_time"], "09:00")
        self.assertEqual(res.data["attendance_quorum"]["needed"], 3)
        self.assertEqual([s["role"] for s in res.data["attendance_suggestions"]], ["Secretary - PSC"])

    def test_save_roundtrip_and_quorum(self):
        att = self.client.get(self.url).data["attendance"]
        att["members"][1]["status"] = "absent"
        att["members"][2]["status"] = "apology"
        att["members"][3]["arrived"] = "09:50"
        att["start_time"] = "09:36"
        att["opening_prayer_by"] = "Commissioner Edward"
        att["in_attendance"] = [{"name": "Stephane Bong", "role": "Acting Secretary - PSC"}, {"name": " ", "role": "x"}]
        res = self.client.patch(self.url, {"attendance": att}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data["attendance_saved"])
        saved = res.data["attendance"]
        self.assertEqual(saved["start_time"], "09:36")
        self.assertEqual(len(saved["in_attendance"]), 1)  # blank name dropped
        self.assertEqual(res.data["attendance_quorum"], {"present": 3, "total": 5, "needed": 3, "met": True})
        att["members"][3]["status"] = "absent"
        res = self.client.patch(self.url, {"attendance": att}, format="json")
        self.assertFalse(res.data["attendance_quorum"]["met"])

    def test_invalid_attendance_rejected_and_notes_only_patch_keeps_attendance(self):
        att = self.client.get(self.url).data["attendance"]
        bad = {**att, "members": [{**att["members"][0], "status": "maybe"}]}
        self.assertEqual(self.client.patch(self.url, {"attendance": bad}, format="json").status_code, 400)
        bad = {**att, "start_time": "9.36am"}
        self.assertEqual(self.client.patch(self.url, {"attendance": bad}, format="json").status_code, 400)
        self.client.patch(self.url, {"attendance": att}, format="json")
        res = self.client.patch(self.url, {"items": []}, format="json")  # no attendance key
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["attendance_saved"])

    def test_attendance_reaches_the_minutes_only_once_saved(self):
        from tracker.minute_intake import apply_intake_to_minutes
        self.client.get(self.url)
        content = apply_intake_to_minutes(self.meeting, self.secretary).content
        self.assertNotIn("attendance", content)  # untouched roster default is never copied
        att = self.client.get(self.url).data["attendance"]
        att["members"][1]["status"] = "apology"
        self.client.patch(self.url, {"attendance": att}, format="json")
        self.meeting.refresh_from_db()
        content = apply_intake_to_minutes(self.meeting, self.secretary).content
        self.assertEqual(content["attendance"]["members"][1]["status"], "apology")

    def test_print_grouping(self):
        from tracker.minute_attendance import attendance_for_print
        self.assertIsNone(attendance_for_print({}))
        out = attendance_for_print({
            "start_time": "09:36", "opening_prayer_by": "X",
            "members": [
                {"name": "A", "role": "Chairman", "status": "present", "arrived": "", "left": "11:00"},
                {"name": "B", "role": "Commissioner", "status": "absent"},
                {"name": "C", "role": "Commissioner", "status": "apology"},
            ],
            "in_attendance": [{"name": "D", "role": "Acting Secretary - PSC"}],
        })
        self.assertEqual([p["name"] for p in out["present"]], ["A"])
        self.assertEqual(out["present"][0]["note"], "left 11:00")
        self.assertEqual([p["name"] for p in out["absent"]], ["B"])
        self.assertEqual([p["name"] for p in out["apologies"]], ["C"])

    def test_minutes_header_renders_attendance_and_still_renders_without(self):
        from django.template.loader import render_to_string
        from tracker.minute_attendance import attendance_for_print
        minutes = Minutes.objects.get(meeting=self.meeting)
        ctx = {"meeting": self.meeting, "minutes": minutes, "content": {}, "agenda_items": [],
               "status_label": "Draft", "signature_data_uri": None}
        plain = render_to_string("tracker/minutes_pdf.html", {**ctx, "attendance": None})
        self.assertNotIn("Apologies:", plain)
        att = attendance_for_print({
            "start_time": "09:36", "opening_prayer_by": "Commissioner Edward",
            "members": [{"name": "Meto Nganga", "role": "Chairman", "status": "present", "arrived": "", "left": ""},
                        {"name": "Fred V", "role": "Commissioner", "status": "apology"}],
            "in_attendance": [{"name": "Stephane Bong", "role": "Acting Secretary - PSC"}],
        })
        html = render_to_string("tracker/minutes_pdf.html", {**ctx, "attendance": att})
        for needle in ("09:36", "Meto Nganga, Chairman", "Stephane Bong, Acting Secretary - PSC", "Apologies:", "Fred V", "Commissioner Edward"):
            self.assertIn(needle, html)

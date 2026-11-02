"""Flying agenda — the extra matters commissioners raise during a sitting.

The Secretary opens the window per meeting, Manager CSU adds the matter at the
end of the endorsed agenda, and the responsible unit's Manager files a short
brief before the Commission works down to it.
"""

import datetime

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .. import flying_agenda as fa
from ..models import (
    AgendaItem,
    AgendaStatus,
    Department,
    FlyingAgendaBrief,
    FormCategory,
    Meeting,
    MeetingStatus,
    MinuteAgendaIntake,
    Ministry,
    Notification,
    Profile,
    Role,
    RoutedUnit,
    Submission,
    WorkflowStage,
)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class _Base(TestCase):
    def setUp(self):
        # resolve_opsc_submission_org needs the OPM ministry and OPSC department.
        self.opm = Ministry.objects.create(code="OPM", name="Ministry of the Prime Minister")
        self.opsc = Department.objects.create(
            ministry=self.opm, code="OPSC", name="Office of the Public Service Commission",
        )
        self.form_cat = FormCategory.objects.create(code="psc_fa", name="PSC FA")

        self.secretary = self._user("fa_secretary", Role.PSC_SECRETARY)
        self.csu = self._user("fa_csu_manager", Role.CSU_MANAGER)
        self.odu_manager = self._user("fa_odu_manager", Role.ODU_MANAGER)
        self.hr_manager = self._user("fa_hr_manager", Role.HR_UNIT_MANAGER)

        self.meeting = Meeting.objects.create(
            title="PSC Meeting No. 11",
            date=timezone.now().date(),
            time=datetime.time(9, 0),
            venue="Boardroom",
            status=MeetingStatus.IN_PROGRESS,
            agenda_status=AgendaStatus.CIRCULATED,
        )

    def _user(self, username, role, **kwargs):
        user = User.objects.create_user(username, password="x")
        Profile.objects.create(user=user, role=role, ministry=self.opm, **kwargs)
        return user

    def api(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def _endorsed_item(self, title, category="appointment", sequence=1):
        """A submission that was on the agenda before the Commission convened."""
        sub = Submission.objects.create(
            title=title, ministry=self.opm, form_category=self.form_cat,
            current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
            received_at=timezone.now(), created_by=self.secretary,
            scheduled_meeting=self.meeting, routed_unit=RoutedUnit.HR,
        )
        return AgendaItem.objects.create(
            meeting=self.meeting, submission=sub, category=category, sequence=sequence,
        )

    def _open_window(self):
        fa.set_enabled(
            self.meeting, user=self.secretary,
            profile=self.secretary.psc_profile, enabled=True,
        )

    def _add_item(self, title="Urgent staffing matter", unit=RoutedUnit.ODU, raised_by="Commissioner Tari"):
        # The notification goes out on commit, which TestCase never reaches on
        # its own — capture the callbacks so the test sees what a request does.
        with self.captureOnCommitCallbacks(execute=True):
            return self.api(self.csu).post(
                f"/api/meetings/{self.meeting.id}/flying-agenda/items/",
                {"title": title, "responsible_unit": unit, "raised_by": raised_by},
                format="json",
            )

    def _take_item(self, item, note="Discussed."):
        """Record a minute against an item — how the system learns it was taken."""
        row, _ = MinuteAgendaIntake.objects.get_or_create(
            meeting=self.meeting, agenda_item=item,
            defaults={"agenda_title": item.submission.title},
        )
        row.discussion_notes = note
        row.save(update_fields=["discussion_notes", "updated_at"])
        return row


class WindowTests(_Base):
    def test_secretary_opens_and_closes_the_window(self):
        res = self.api(self.secretary).post(
            f"/api/meetings/{self.meeting.id}/flying-agenda/", {"enabled": True}, format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.meeting.refresh_from_db()
        self.assertTrue(self.meeting.flying_agenda_enabled)
        self.assertEqual(self.meeting.flying_agenda_enabled_by, self.secretary)
        self.assertIsNotNone(self.meeting.flying_agenda_enabled_at)

        self.api(self.secretary).post(
            f"/api/meetings/{self.meeting.id}/flying-agenda/", {"enabled": False}, format="json",
        )
        self.meeting.refresh_from_db()
        self.assertFalse(self.meeting.flying_agenda_enabled)

    def test_manager_csu_cannot_open_the_window_themselves(self):
        res = self.api(self.csu).post(
            f"/api/meetings/{self.meeting.id}/flying-agenda/", {"enabled": True}, format="json",
        )
        self.assertEqual(res.status_code, 403, res.data)

    def test_closed_window_blocks_adding(self):
        res = self._add_item()
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("not opened", str(res.data))

    def test_agenda_must_be_endorsed_first(self):
        self.meeting.agenda_status = AgendaStatus.DRAFT
        self.meeting.save(update_fields=["agenda_status"])
        self._open_window()
        res = self._add_item()
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("endorsed", str(res.data))

    def test_a_finished_sitting_takes_nothing_further(self):
        self._open_window()
        self.meeting.status = MeetingStatus.COMPLETED
        self.meeting.save(update_fields=["status"])
        self.assertEqual(self._add_item().status_code, 400)


class AddItemTests(_Base):
    def setUp(self):
        super().setUp()
        self._open_window()

    def test_only_manager_csu_may_add(self):
        res = self.api(self.odu_manager).post(
            f"/api/meetings/{self.meeting.id}/flying-agenda/items/",
            {"title": "Mine", "responsible_unit": RoutedUnit.ODU}, format="json",
        )
        self.assertEqual(res.status_code, 403, res.data)

    def test_adding_creates_the_shell_submission_on_the_agenda(self):
        res = self._add_item()
        self.assertEqual(res.status_code, 201, res.data)

        item = AgendaItem.objects.get(pk=res.data["id"])
        self.assertTrue(item.is_flying)
        self.assertEqual(item.raised_by_label, "Commissioner Tari")
        self.assertEqual(item.category, fa.FLYING_AGENDA_SECTION)

        sub = item.submission
        self.assertEqual(sub.title, "Urgent staffing matter")
        self.assertEqual(sub.routed_unit, RoutedUnit.ODU)
        self.assertTrue(sub.is_internal)
        self.assertFalse(sub.follows_normal_route)
        # Straight to the Commission — it cannot walk the pipeline mid-sitting.
        self.assertEqual(sub.current_stage, WorkflowStage.FORWARDED_TO_COMMISSION)
        self.assertEqual(sub.scheduled_meeting, self.meeting)
        # The brief row is created empty so there is something to fill in.
        self.assertTrue(FlyingAgendaBrief.objects.filter(agenda_item=item).exists())

    def test_the_responsible_unit_manager_is_notified(self):
        self._add_item(unit=RoutedUnit.ODU)
        notes = Notification.objects.filter(recipient=self.odu_manager)
        self.assertEqual(notes.count(), 1, "the ODU Manager should have been told")
        self.assertIn("Urgent staffing matter", notes.first().title)
        # And not another unit's manager.
        self.assertEqual(Notification.objects.filter(recipient=self.hr_manager).count(), 0)

    def test_a_title_is_required(self):
        self.assertEqual(self._add_item(title="   ").status_code, 400)

    def test_the_responsible_unit_must_be_a_real_unit(self):
        res = self._add_item(unit="not_a_unit")
        self.assertEqual(res.status_code, 400, res.data)

    def test_the_workflow_event_records_who_raised_it(self):
        res = self._add_item()
        sub = AgendaItem.objects.get(pk=res.data["id"]).submission
        event = sub.events.first()
        self.assertIn("Commissioner Tari", event.remarks)
        self.assertIn(self.meeting.reference_number, event.remarks)

    def test_flying_items_come_after_the_endorsed_ones(self):
        self._endorsed_item("Endorsed appointment", sequence=1)
        self._endorsed_item("Endorsed contract", category="contract", sequence=1)
        self._add_item(title="First extra")
        self._add_item(title="Second extra")

        titles = [
            i.submission.title
            for i in self.meeting.agenda_items.select_related("submission").all()
        ]
        self.assertEqual(titles[-2:], ["First extra", "Second extra"])
        self.assertEqual(len(titles), 4)

    def test_flying_items_ignore_the_agenda_capacity(self):
        self.meeting.max_items = 1
        self.meeting.save(update_fields=["max_items"])
        self._endorsed_item("Endorsed appointment")
        self.assertEqual(self._add_item().status_code, 201)


class BriefTests(_Base):
    def setUp(self):
        super().setUp()
        self._open_window()
        self.item = AgendaItem.objects.get(pk=self._add_item().data["id"])

    def _patch_brief(self, user, **fields):
        return self.api(user).patch(
            f"/api/agenda-items/{self.item.id}/flying-brief/", fields, format="json",
        )

    def test_responsible_unit_manager_files_the_brief(self):
        res = self._patch_brief(
            self.odu_manager,
            subject="Acting appointment, Finance",
            background="The post fell vacant on Friday.",
            recommendation="Approve the acting appointment for three months.",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data["is_complete"])
        self.assertIsNotNone(res.data["completed_at"])

        brief = FlyingAgendaBrief.objects.get(agenda_item=self.item)
        self.assertEqual(brief.completed_by, self.odu_manager)
        # The agenda, sitting pack and minutes all read the submission title.
        self.item.submission.refresh_from_db()
        self.assertEqual(self.item.submission.title, "Acting appointment, Finance")

    def test_a_partial_brief_is_not_complete(self):
        res = self._patch_brief(self.odu_manager, subject="Only a subject")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertFalse(res.data["is_complete"])
        self.assertIsNone(res.data["completed_at"])

    def test_another_units_manager_cannot_file_it(self):
        self.assertEqual(self._patch_brief(self.hr_manager, subject="Not mine").status_code, 403)

    def test_the_brief_is_rejected_on_an_ordinary_agenda_item(self):
        ordinary = self._endorsed_item("Endorsed appointment")
        res = self.api(self.secretary).patch(
            f"/api/agenda-items/{ordinary.id}/flying-brief/", {"subject": "x"}, format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)


class ProgressTests(_Base):
    def setUp(self):
        super().setUp()
        self._open_window()
        self.first = self._endorsed_item("Endorsed one", sequence=1)
        self.second = self._endorsed_item("Endorsed two", sequence=2)
        self.third = self._endorsed_item("Endorsed three", sequence=3)
        self.flying = AgendaItem.objects.get(pk=self._add_item().data["id"])
        Notification.objects.all().delete()

    def test_outstanding_count_counts_only_items_not_yet_taken(self):
        rows = {r["agenda_item_id"]: r for r in fa.sitting_progress(self.meeting)["items"]}
        self.assertEqual(rows[self.flying.id]["items_ahead_outstanding"], 3)

        self._take_item(self.first)
        rows = {r["agenda_item_id"]: r for r in fa.sitting_progress(self.meeting)["items"]}
        self.assertTrue(rows[self.first.id]["taken"])
        self.assertEqual(rows[self.flying.id]["items_ahead_outstanding"], 2)

    def test_the_unit_manager_is_warned_once_when_the_commission_closes_in(self):
        self._take_item(self.first)
        fa.on_minutes_saved(self.meeting)
        warnings = Notification.objects.filter(recipient=self.odu_manager)
        self.assertEqual(warnings.count(), 1, "expected a single approaching warning")
        self.assertIn("2 items to go", warnings.first().title)

        # Saving the minutes again must not warn them a second time.
        self._take_item(self.second)
        fa.on_minutes_saved(self.meeting)
        self.assertEqual(Notification.objects.filter(recipient=self.odu_manager).count(), 1)

    def test_no_warning_while_the_commission_is_still_far_away(self):
        fa.on_minutes_saved(self.meeting)
        self.assertEqual(Notification.objects.filter(recipient=self.odu_manager).count(), 0)

    def test_secretary_and_csu_told_when_the_item_comes_up_empty(self):
        for item in (self.first, self.second, self.third):
            self._take_item(item)
        self._take_item(self.flying)
        fa.on_minutes_saved(self.meeting)

        for user in (self.secretary, self.csu):
            alerts = Notification.objects.filter(recipient=user, title__startswith="No brief filed")
            self.assertEqual(alerts.count(), 1, f"{user.username} should have been alerted")

    def test_a_completed_brief_is_never_chased(self):
        fa.save_brief(
            self.flying, user=self.odu_manager,
            subject="Ready", background="Filed in time.", recommendation="Approve.",
        )
        for item in (self.first, self.second, self.third):
            self._take_item(item)
        self._take_item(self.flying)
        fa.on_minutes_saved(self.meeting)
        self.assertEqual(Notification.objects.filter(recipient=self.odu_manager).count(), 0)
        self.assertEqual(Notification.objects.filter(recipient=self.secretary).count(), 0)

    def test_minute_intake_save_chases_the_briefs(self):
        # Manager CSU takes the minutes, which is what drives the chase. The
        # rows exist once they have loaded the intake page, as the UI does.
        self.api(self.csu).get(f"/api/meetings/{self.meeting.id}/minute-intake/")
        self._take_item(self.first)
        res = self.api(self.csu).patch(
            f"/api/meetings/{self.meeting.id}/minute-intake/",
            {"items": [{"agenda_item_id": self.second.id, "discussion_notes": "Noted."}]},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(Notification.objects.filter(recipient=self.odu_manager).count(), 1)

    def test_progress_endpoint_reports_the_flying_items(self):
        res = self.api(self.secretary).get(
            f"/api/meetings/{self.meeting.id}/flying-agenda/progress/",
        )
        self.assertEqual(res.status_code, 200, res.data)
        flying = [row for row in res.data["items"] if row["is_flying"]]
        self.assertEqual(len(flying), 1)
        self.assertEqual(flying[0]["responsible_unit"], RoutedUnit.ODU)
        self.assertFalse(flying[0]["brief_complete"])


class AgendaPlacementTests(_Base):
    def test_the_submission_detail_names_its_agenda_number(self):
        self._open_window()
        item = AgendaItem.objects.get(pk=self._add_item().data["id"])
        res = self.api(self.secretary).get(f"/api/submissions/{item.submission_id}/")
        self.assertEqual(res.status_code, 200, res.data)
        placement = res.data["agenda_placement"]
        self.assertEqual(placement["meeting_reference"], self.meeting.reference_number)
        self.assertEqual(placement["sequence"], item.sequence)
        self.assertTrue(placement["is_flying"])
        self.assertEqual(placement["raised_by"], "Commissioner Tari")
        self.assertIn("Item", placement["label"])

    def test_no_placement_when_the_submission_is_not_on_an_agenda(self):
        sub = Submission.objects.create(
            title="Not scheduled", ministry=self.opm, form_category=self.form_cat,
            current_stage=WorkflowStage.UNDER_ASSESSMENT,
            received_at=timezone.now(), created_by=self.secretary,
        )
        res = self.api(self.secretary).get(f"/api/submissions/{sub.id}/")
        self.assertIsNone(res.data["agenda_placement"])

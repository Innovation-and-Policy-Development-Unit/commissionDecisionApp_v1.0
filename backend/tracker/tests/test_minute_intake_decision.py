"""Minute intake: pick the outcome from a list, draft from the submission.

The minute taker should not have to type "Approved" or "Deferred" for every
item. Picking the outcome is enough to format an item, the formatter is given
the paper's summary to write from, and the picked outcome is the record
whatever the model returns.
"""

import datetime
from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..ai.minute_intake_format import build_format_user_prompt
from ..minute_intake import apply_intake_to_minutes, ensure_intake_rows, format_kwargs
from ..models import (
    AgendaItem,
    AgendaStatus,
    FormCategory,
    Meeting,
    MeetingStatus,
    Ministry,
    MinuteAgendaIntake,
    Profile,
    Role,
    RoutedUnit,
    Submission,
    WorkflowStage,
)

FORMATTER = "tracker.ai.minute_intake_format.format_minute_intake_item"
SUMMARY = "The ministry seeks approval to appoint a Director of Policy after open advertisement."


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class MinuteIntakeDecisionTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_MI", name="Minute Intake Ministry")
        self.form_cat = FormCategory.objects.create(code="psc_mi", name="PSC MI")
        self.meeting = Meeting.objects.create(
            title="PSC Meeting No. 13", date=timezone.now().date(),
            time=datetime.time(9, 0), venue="Boardroom",
            status=MeetingStatus.IN_PROGRESS, agenda_status=AgendaStatus.CIRCULATED,
        )
        self.taker = User.objects.create_user("mi_csu_manager", password="x")
        Profile.objects.create(user=self.taker, role=Role.CSU_MANAGER, ministry=self.ministry)
        sub = Submission.objects.create(
            title="Appointment of Director of Policy", ministry=self.ministry,
            form_category=self.form_cat, current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
            received_at=timezone.now(), created_by=self.taker, routed_unit=RoutedUnit.HR,
            scheduled_meeting=self.meeting, ai_brief_summary=SUMMARY,
        )
        self.item = AgendaItem.objects.create(
            meeting=self.meeting, submission=sub, category="appointment", sequence=1,
        )
        ensure_intake_rows(self.meeting)
        self.client = APIClient()
        self.client.force_authenticate(user=self.taker)
        self.base = f"/api/meetings/{self.meeting.id}/minute-intake/"

    def _row(self):
        return MinuteAgendaIntake.objects.get(meeting=self.meeting, agenda_item=self.item)

    def _save(self, **fields):
        return self.client.patch(
            self.base, {"items": [{"agenda_item_id": self.item.id, **fields}]}, format="json",
        )

    def test_the_picked_decision_is_saved_and_returned(self):
        resp = self._save(decision_type="deferred")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["items"][0]["decision_type"], "deferred")
        self.assertEqual(self._row().decision_type, "deferred")

    def test_an_unknown_decision_is_refused(self):
        self.assertEqual(self._save(decision_type="maybe").status_code, 400)

    def test_formatting_still_needs_something_to_work_from(self):
        with mock.patch(FORMATTER) as formatter:
            resp = self.client.post(f"{self.base}{self.item.id}/format/")
        self.assertEqual(resp.status_code, 400)
        formatter.assert_not_called()

    def test_a_picked_decision_alone_is_enough_to_format(self):
        self._save(decision_type="approved")
        result = {"discussion": "The Commission considered the submission.",
                  "decision": "APPROVED.", "decision_type": "noted", "action_items": []}
        with mock.patch(FORMATTER, return_value=(result, None)) as formatter:
            resp = self.client.post(f"{self.base}{self.item.id}/format/")
        self.assertEqual(resp.status_code, 200, resp.content)
        kwargs = formatter.call_args.kwargs
        self.assertEqual(kwargs["selected_decision"], "approved")
        self.assertEqual(kwargs["selected_decision_label"], "Approved")
        self.assertEqual(kwargs["submission_summary"], SUMMARY)
        # The minute taker's pick is the record, not the model's reading of it.
        self.assertEqual(resp.json()["formatted_decision_type"], "approved")

    def test_format_all_includes_items_with_only_a_decision(self):
        self._save(decision_type="noted")
        result = {"discussion": "d", "decision": "NOTED.", "decision_type": "noted", "action_items": []}
        with mock.patch(FORMATTER, return_value=(result, None)):
            resp = self.client.post(f"{self.base}format-all/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.json()["formatted_count"], 1)

    def test_without_a_summary_the_papers_own_notes_are_used(self):
        Submission.objects.filter(pk=self.item.submission_id).update(
            ai_brief_summary="", notes="Paper notes.")
        row = MinuteAgendaIntake.objects.select_related("agenda_item__submission").get(pk=self._row().pk)
        self.assertEqual(format_kwargs(row, "info")["submission_summary"], "Paper notes.")

    def test_the_prompt_carries_the_summary_and_pins_the_decision(self):
        prompt = build_format_user_prompt(
            meeting_info="info", agenda_title="t", agenda_description="", submission_ref="R",
            category_display="Appointment", discussion_notes="", decision_text="", action_officer="",
            selected_decision="deferred", selected_decision_label="Deferred", submission_summary=SUMMARY,
        )
        self.assertIn(SUMMARY, prompt)
        self.assertIn('"decision_type" must be "deferred"', prompt)

    def test_an_unformatted_item_still_carries_its_decision_into_the_minutes(self):
        self._save(decision_type="deferred")
        minutes = apply_intake_to_minutes(self.meeting, self.taker)
        block = minutes.content["agenda_items"][0]
        self.assertEqual(block["decision_type"], "deferred")
        self.assertEqual(block["decision"], "Deferred.")

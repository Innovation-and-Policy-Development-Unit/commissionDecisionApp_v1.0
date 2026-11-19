"""Minute-review deadlines, and the Compliance Manager as a reviewer.

The minute taker reads their own draft back within a window, the Secretary and
Chairman approve — joined by the Compliance Manager when the sitting took
compliance business — and Commissioners then get the reviewed minutes for a
window the Commission wanted to trial rather than fix.
"""

import datetime

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .. import minutes_review as mr
from ..models import (
    AgendaItem,
    FormCategory,
    Meeting,
    Ministry,
    Minutes,
    MinutesStatus,
    Notification,
    Profile,
    Role,
    RoutedUnit,
    Submission,
    SystemSetting,
    WorkflowStage,
)
from ..tasks import remind_overdue_minute_reviews


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class _Base(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_MR", name="Minutes Review Ministry")
        self.form_cat = FormCategory.objects.create(code="psc_mr", name="PSC MR")
        self.meeting = Meeting.objects.create(
            title="PSC Meeting No. 12", date=timezone.now().date(),
            time=datetime.time(9, 0), venue="Boardroom",
        )
        self.taker = self._user("mr_csu_manager", Role.CSU_MANAGER)
        self.sao = self._user("mr_sao", Role.SENIOR_ADMIN_OFFICER)
        self.secretary = self._user("mr_secretary", Role.PSC_SECRETARY)
        self.chairman = self._user("mr_chairman", Role.CHAIRPERSON)
        self.compliance = self._user("mr_compliance_manager", Role.COMPLIANCE_MANAGER)
        self.minutes = Minutes.objects.create(meeting=self.meeting, created_by=self.taker)

    def _user(self, username, role):
        user = User.objects.create_user(username, password="x")
        Profile.objects.create(user=user, role=role, ministry=self.ministry)
        return user

    def _post(self, user, path, data=None):
        client = APIClient()
        client.force_authenticate(user=user)
        return client.post(f"/api/minutes/{self.minutes.id}/{path}/", data or {}, format="json")

    def _agenda_item(self, title, category="appointment", routed_unit=RoutedUnit.HR):
        sub = Submission.objects.create(
            title=title, ministry=self.ministry, form_category=self.form_cat,
            current_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
            received_at=timezone.now(), created_by=self.secretary,
            routed_unit=routed_unit, scheduled_meeting=self.meeting,
        )
        return AgendaItem.objects.create(
            meeting=self.meeting, submission=sub, category=category, sequence=1,
        )


class ConfigurableWindowTests(_Base):
    def _set_days(self, key, value):
        # Migration 0291 seeds these, so a test changes them rather than adding.
        SystemSetting.objects.update_or_create(key=key, defaults={"value": value})

    def test_the_windows_are_seeded_with_the_starting_durations(self):
        for key in (
            mr.SETTING_DRAFT_REVIEW_DAYS,
            mr.SETTING_SECRETARIAT_REVIEW_DAYS,
            mr.SETTING_COMMISSIONER_REVIEW_DAYS,
        ):
            self.assertTrue(SystemSetting.objects.filter(key=key).exists(), key)

    def test_the_windows_come_from_settings(self):
        self.assertEqual(mr.draft_review_days(), 1)
        self.assertEqual(mr.secretariat_review_days(), 1)
        self.assertEqual(mr.commissioner_review_days(), 3)

        self._set_days(mr.SETTING_COMMISSIONER_REVIEW_DAYS, "5")
        self.assertEqual(mr.commissioner_review_days(), 5)

    def test_a_nonsense_value_falls_back_to_the_default(self):
        self._set_days(mr.SETTING_COMMISSIONER_REVIEW_DAYS, "not a number")
        self.assertEqual(mr.commissioner_review_days(), 3)
        SystemSetting.objects.filter(key=mr.SETTING_COMMISSIONER_REVIEW_DAYS).update(value="-3")
        self.assertEqual(mr.commissioner_review_days(), 3)

    def test_the_commissioner_window_follows_the_setting(self):
        self._set_days(mr.SETTING_COMMISSIONER_REVIEW_DAYS, "4")
        self._post(self.taker, "submit-for-review")
        self._post(self.secretary, "secretariat-approve")
        self._post(self.chairman, "secretariat-approve")
        res = self._post(self.secretary, "circulate-to-commissioners")
        self.assertEqual(res.status_code, 200, res.data)

        self.minutes.refresh_from_db()
        expected = mr.due_in_working_days(4, start=self.minutes.commissioner_circulated_at)
        self.assertEqual(self.minutes.commissioner_review_due_at, expected)


class DraftReadBackTests(_Base):
    def test_the_window_starts_when_the_draft_is_built(self):
        from ..minute_intake import apply_intake_to_minutes

        self.minutes.delete()  # apply_intake_to_minutes creates it
        minutes = apply_intake_to_minutes(self.meeting, self.taker)
        self.assertIsNotNone(minutes.draft_review_due_at)

    def test_rebuilding_the_draft_does_not_reset_the_clock(self):
        from ..minute_intake import apply_intake_to_minutes

        self.minutes.delete()
        first = apply_intake_to_minutes(self.meeting, self.taker)
        due = first.draft_review_due_at
        again = apply_intake_to_minutes(self.meeting, self.taker)
        self.assertEqual(again.draft_review_due_at, due)

    def test_manager_csu_may_submit_the_minutes_on(self):
        res = self._post(self.taker, "submit-for-review")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], MinutesStatus.PENDING_SECRETARIAT_REVIEW)

    def test_the_senior_admin_officer_may_still_submit(self):
        self.assertEqual(self._post(self.sao, "submit-for-review").status_code, 200)

    def test_submitting_closes_the_takers_own_window(self):
        self.minutes.draft_review_due_at = timezone.now()
        self.minutes.draft_review_reminded_at = timezone.now()
        self.minutes.save()
        self._post(self.taker, "submit-for-review")
        self.minutes.refresh_from_db()
        self.assertIsNone(self.minutes.draft_review_due_at)
        self.assertIsNone(self.minutes.draft_review_reminded_at)


class ComplianceMinuteTakerTests(_Base):
    """On compliance business the Compliance Manager is a minute taker: they
    confirm the draft before it leaves, and are not one of its approvers."""

    def test_no_compliance_business_means_no_confirmation_is_needed(self):
        self._agenda_item("An appointment")
        self.assertFalse(mr.requires_compliance_review(self.minutes))
        self.assertEqual(self._post(self.taker, "submit-for-review").status_code, 200)

    def test_a_compliance_submission_in_another_section_still_counts(self):
        # A compliance matter placed under Other Matters is still compliance
        # business and still the Compliance Manager's to minute.
        self._agenda_item("Compliance matter filed elsewhere", category="other",
                          routed_unit=RoutedUnit.COMPLIANCE)
        self.assertTrue(mr.requires_compliance_review(self.minutes))

    def test_the_draft_cannot_be_submitted_until_compliance_confirms(self):
        self._agenda_item("A discipline matter", category="discipline_compliance")
        res = self._post(self.taker, "submit-for-review")
        self.assertEqual(res.status_code, 400, res.data)

        res = self._post(self.compliance, "confirm-draft")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data["review_state"]["compliance_confirmed"])
        self.assertTrue(
            Notification.objects.filter(recipient=self.taker, title__startswith="Compliance items confirmed").exists()
        )

        res = self._post(self.taker, "submit-for-review")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], MinutesStatus.PENDING_SECRETARIAT_REVIEW)

    def test_only_the_compliance_manager_confirms(self):
        self._agenda_item("A discipline matter", category="discipline_compliance")
        self.assertEqual(self._post(self.taker, "confirm-draft").status_code, 403)

    def test_there_is_nothing_to_confirm_without_compliance_business(self):
        # Not 400: a sitting with no compliance business is not theirs to see
        # at all until it is signed, so the minutes are simply not there.
        self._agenda_item("An appointment")
        self.assertEqual(self._post(self.compliance, "confirm-draft").status_code, 404)

    def test_the_compliance_manager_is_not_an_approver(self):
        self._agenda_item("A discipline matter", category="discipline_compliance")
        self._post(self.compliance, "confirm-draft")
        self._post(self.taker, "submit-for-review")
        self.assertEqual(self._post(self.compliance, "secretariat-approve").status_code, 403)
        self._post(self.secretary, "secretariat-approve")
        res = self._post(self.chairman, "secretariat-approve")
        self.assertEqual(res.data["status"], MinutesStatus.REVIEWED)

    def _content(self, hr_item, compliance_item):
        return {
            "opening": "Opened at 9.",
            "agenda_items": [
                {"agenda_item_id": hr_item.id, "title": "Appointment", "discussion": "HR text", "decision": "Approved."},
                {"agenda_item_id": compliance_item.id, "title": "Discipline", "discussion": "Old", "decision": "Noted."},
            ],
        }

    def _patch(self, user, content):
        client = APIClient()
        client.force_authenticate(user=user)
        return client.patch(f"/api/minutes/{self.minutes.id}/", {"content": content}, format="json")

    def test_the_compliance_manager_reads_the_whole_draft_but_edits_only_their_items(self):
        hr_item = self._agenda_item("An appointment")
        compliance_item = self._agenda_item("A discipline matter", category="discipline_compliance",
                                            routed_unit=RoutedUnit.COMPLIANCE)
        self.minutes.content = self._content(hr_item, compliance_item)
        self.minutes.save(update_fields=["content"])

        client = APIClient()
        client.force_authenticate(user=self.compliance)
        data = client.get(f"/api/minutes/{self.minutes.id}/").data
        blocks = {b["agenda_item_id"]: b for b in data["content"]["agenda_items"]}
        self.assertEqual(blocks[hr_item.id]["discussion"], "HR text", "they read the whole draft")
        self.assertTrue(blocks[hr_item.id].get("locked"))
        self.assertFalse(blocks[compliance_item.id].get("locked"))
        self.assertTrue(data["review_state"]["can_edit_compliance_items"])

        edited = self._content(hr_item, compliance_item)
        edited["opening"] = "Tampered"
        edited["agenda_items"][0]["discussion"] = "Tampered"
        edited["agenda_items"][1]["discussion"] = "Members agreed a warning is enough."
        res = self._patch(self.compliance, edited)
        self.assertEqual(res.status_code, 200, res.data)

        self.minutes.refresh_from_db()
        stored = {b["agenda_item_id"]: b for b in self.minutes.content["agenda_items"]}
        self.assertEqual(stored[compliance_item.id]["discussion"], "Members agreed a warning is enough.")
        self.assertEqual(stored[hr_item.id]["discussion"], "HR text")
        self.assertNotIn("locked", stored[hr_item.id])
        self.assertEqual(self.minutes.content["opening"], "Opened at 9.")
        self.assertEqual(self.minutes.status, MinutesStatus.DRAFT)

    def test_editing_their_items_after_confirming_needs_a_fresh_confirmation(self):
        hr_item = self._agenda_item("An appointment")
        compliance_item = self._agenda_item("A discipline matter", category="discipline_compliance")
        self.minutes.content = self._content(hr_item, compliance_item)
        self.minutes.save(update_fields=["content"])
        self._post(self.compliance, "confirm-draft")

        edited = self._content(hr_item, compliance_item)
        edited["agenda_items"][1]["decision"] = "Written warning."
        self._patch(self.compliance, edited)
        self.minutes.refresh_from_db()
        self.assertIsNone(self.minutes.compliance_reviewed_by)

    def test_the_compliance_manager_cannot_edit_once_the_draft_has_left(self):
        hr_item = self._agenda_item("An appointment")
        compliance_item = self._agenda_item("A discipline matter", category="discipline_compliance")
        self.minutes.content = self._content(hr_item, compliance_item)
        self.minutes.save(update_fields=["content"])
        self._post(self.compliance, "confirm-draft")
        self._post(self.taker, "submit-for-review")
        res = self._patch(self.compliance, self._content(hr_item, compliance_item))
        self.assertEqual(res.status_code, 403, res.data)


class SequentialReviewTests(_Base):
    """Secretary first, then the Chairman; either can send the draft back."""

    def setUp(self):
        super().setUp()
        self._agenda_item("An appointment")
        self._post(self.taker, "submit-for-review")
        Notification.objects.all().delete()

    def test_only_the_secretary_is_asked_first(self):
        Notification.objects.all().delete()
        self.minutes.refresh_from_db()
        self.minutes.status = MinutesStatus.DRAFT
        self.minutes.save(update_fields=["status"])
        res = self._post(self.taker, "submit-for-review")
        self.assertEqual(res.data["review_state"]["current_reviewers"], [Role.PSC_SECRETARY])
        self.assertTrue(Notification.objects.filter(recipient=self.secretary).exists())
        self.assertFalse(Notification.objects.filter(recipient=self.chairman).exists())

    def test_the_chairman_cannot_approve_before_the_secretary(self):
        res = self._post(self.chairman, "secretariat-approve")
        self.assertEqual(res.status_code, 400, res.data)
        self.minutes.refresh_from_db()
        self.assertIsNone(self.minutes.chairman_reviewed_by)

    def test_the_secretarys_approval_hands_it_to_the_chairman_with_a_fresh_window(self):
        self.minutes.refresh_from_db()
        self.minutes.review_due_at = timezone.now() - datetime.timedelta(days=3)
        self.minutes.review_reminded_at = timezone.now()
        self.minutes.save(update_fields=["review_due_at", "review_reminded_at"])

        res = self._post(self.secretary, "secretariat-approve")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], MinutesStatus.PENDING_SECRETARIAT_REVIEW)
        self.assertEqual(res.data["review_state"]["current_reviewers"], [Role.CHAIRPERSON])
        self.assertTrue(Notification.objects.filter(recipient=self.chairman).exists())
        self.minutes.refresh_from_db()
        self.assertGreater(self.minutes.review_due_at, timezone.now())
        self.assertIsNone(self.minutes.review_reminded_at)

        res = self._post(self.chairman, "secretariat-approve")
        self.assertEqual(res.data["status"], MinutesStatus.REVIEWED)

    def test_in_parallel_mode_the_chairman_may_go_first(self):
        SystemSetting.objects.update_or_create(key=mr.SETTING_REVIEW_MODE, defaults={"value": "parallel"})
        res = self._post(self.chairman, "secretariat-approve")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], MinutesStatus.PENDING_SECRETARIAT_REVIEW)
        res = self._post(self.secretary, "secretariat-approve")
        self.assertEqual(res.data["status"], MinutesStatus.REVIEWED)

    def test_the_review_order_is_seeded_as_sequential(self):
        self.assertEqual(SystemSetting.get_val(mr.SETTING_REVIEW_MODE), "sequential")

    def test_returning_needs_a_note(self):
        res = self._post(self.secretary, "return-to-drafters", {"note": "  "})
        self.assertEqual(res.status_code, 400, res.data)

    def test_the_secretary_can_return_the_draft_with_a_note(self):
        res = self._post(self.secretary, "return-to-drafters", {"note": "Item 3: wrong officer named."})
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], MinutesStatus.DRAFT)
        self.assertEqual(res.data["review_return_note"], "Item 3: wrong officer named.")
        self.assertEqual(res.data["review_returned_by_name"], self.secretary.username)
        self.assertIsNotNone(res.data["draft_review_due_at"])
        note = Notification.objects.filter(recipient=self.taker, title__startswith="Draft minutes returned").first()
        self.assertIsNotNone(note)
        self.assertIn("wrong officer", note.body)

    def test_the_chairman_returning_clears_the_secretarys_approval(self):
        self._post(self.secretary, "secretariat-approve")
        res = self._post(self.chairman, "return-to-drafters", {"note": "Decision wording on item 2."})
        self.assertEqual(res.status_code, 200, res.data)
        self.minutes.refresh_from_db()
        self.assertEqual(self.minutes.status, MinutesStatus.DRAFT)
        self.assertIsNone(self.minutes.secretary_reviewed_by)

    def test_the_chairman_cannot_return_while_it_is_with_the_secretary(self):
        res = self._post(self.chairman, "return-to-drafters", {"note": "Too early."})
        self.assertEqual(res.status_code, 400, res.data)

    def test_a_minute_taker_cannot_return_their_own_draft(self):
        self.assertEqual(self._post(self.taker, "return-to-drafters", {"note": "x"}).status_code, 403)

    def test_returning_a_compliance_sitting_asks_compliance_to_confirm_again(self):
        self.minutes.refresh_from_db()
        self._agenda_item("A discipline matter", category="discipline_compliance")
        self.minutes.compliance_reviewed_by = self.compliance
        self.minutes.compliance_reviewed_at = timezone.now()
        self.minutes.save(update_fields=["compliance_reviewed_by", "compliance_reviewed_at"])
        self._post(self.secretary, "return-to-drafters", {"note": "Fix item 1."})
        self.minutes.refresh_from_db()
        self.assertIsNone(self.minutes.compliance_reviewed_by)
        self.assertTrue(Notification.objects.filter(
            recipient=self.compliance, title__startswith="Draft minutes returned").exists())


class OverdueChaseTests(_Base):
    def test_the_minute_taker_is_chased_once_over_an_overdue_draft(self):
        self.minutes.draft_review_due_at = timezone.now() - datetime.timedelta(days=1)
        self.minutes.save(update_fields=["draft_review_due_at"])

        self.assertEqual(remind_overdue_minute_reviews(), 1)
        notes = Notification.objects.filter(recipient=self.taker)
        self.assertEqual(notes.count(), 1)
        self.assertIn("overdue", notes.first().title.lower())

        # Running the sweep again must not chase them a second time.
        self.assertEqual(remind_overdue_minute_reviews(), 0)
        self.assertEqual(Notification.objects.filter(recipient=self.taker).count(), 1)

    def test_a_draft_still_inside_its_window_is_left_alone(self):
        self.minutes.draft_review_due_at = timezone.now() + datetime.timedelta(days=1)
        self.minutes.save(update_fields=["draft_review_due_at"])
        self.assertEqual(remind_overdue_minute_reviews(), 0)
        self.assertEqual(Notification.objects.count(), 0)

    def test_outstanding_reviewers_are_chased_once(self):
        self._post(self.taker, "submit-for-review")
        Notification.objects.all().delete()
        self.minutes.refresh_from_db()
        self.minutes.review_due_at = timezone.now() - datetime.timedelta(days=1)
        self.minutes.save(update_fields=["review_due_at"])

        self.assertEqual(remind_overdue_minute_reviews(), 1)
        # It is with the Secretary; the Chairman's turn has not come yet.
        self.assertEqual(
            Notification.objects.filter(recipient=self.secretary, title__startswith="Minutes review overdue").count(), 1,
        )
        self.assertFalse(Notification.objects.filter(recipient=self.chairman).exists())
        self.assertEqual(remind_overdue_minute_reviews(), 0)

    def test_a_reviewer_who_has_approved_is_not_chased(self):
        self._post(self.taker, "submit-for-review")
        self._post(self.secretary, "secretariat-approve")
        Notification.objects.all().delete()
        self.minutes.refresh_from_db()
        self.minutes.review_due_at = timezone.now() - datetime.timedelta(days=1)
        self.minutes.save(update_fields=["review_due_at"])

        remind_overdue_minute_reviews()
        self.assertEqual(
            Notification.objects.filter(
                recipient=self.chairman, title__startswith="Minutes review overdue",
            ).count(), 1,
        )
        # The Secretary is still told, as the owner of the stage, but the
        # Chairman is the one actually outstanding.
        self.minutes.refresh_from_db()
        self.assertIsNotNone(self.minutes.secretary_reviewed_at)

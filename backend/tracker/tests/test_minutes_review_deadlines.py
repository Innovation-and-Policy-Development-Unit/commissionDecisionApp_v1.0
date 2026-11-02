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
        self.assertEqual(mr.commissioner_review_days(), 2)

        self._set_days(mr.SETTING_COMMISSIONER_REVIEW_DAYS, "5")
        self.assertEqual(mr.commissioner_review_days(), 5)

    def test_a_nonsense_value_falls_back_to_the_default(self):
        self._set_days(mr.SETTING_COMMISSIONER_REVIEW_DAYS, "not a number")
        self.assertEqual(mr.commissioner_review_days(), 2)
        SystemSetting.objects.filter(key=mr.SETTING_COMMISSIONER_REVIEW_DAYS).update(value="-3")
        self.assertEqual(mr.commissioner_review_days(), 2)

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


class ComplianceReviewTests(_Base):
    def test_no_compliance_business_means_two_reviewers(self):
        self._agenda_item("An appointment")
        self.assertFalse(mr.requires_compliance_review(self.minutes))

        self._post(self.taker, "submit-for-review")
        self._post(self.secretary, "secretariat-approve")
        res = self._post(self.chairman, "secretariat-approve")
        self.assertEqual(res.data["status"], MinutesStatus.REVIEWED)

    def test_a_compliance_section_item_brings_the_compliance_manager_in(self):
        self._agenda_item("A discipline matter", category="discipline_compliance")
        self.assertTrue(mr.requires_compliance_review(self.minutes))

        self._post(self.taker, "submit-for-review")
        self._post(self.secretary, "secretariat-approve")
        res = self._post(self.chairman, "secretariat-approve")
        self.assertEqual(
            res.data["status"], MinutesStatus.PENDING_SECRETARIAT_REVIEW,
            "the Compliance Manager has not approved yet",
        )
        self.assertEqual(res.data["review_state"]["pending_reviewers"], [Role.COMPLIANCE_MANAGER])

        res = self._post(self.compliance, "secretariat-approve")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], MinutesStatus.REVIEWED)
        self.assertIsNotNone(res.data["compliance_reviewed_at"])

    def test_a_compliance_submission_in_another_section_still_counts(self):
        # A compliance matter placed under Other Matters is still compliance
        # business and still needs the Compliance Manager's eye.
        self._agenda_item("Compliance matter filed elsewhere", category="other",
                          routed_unit=RoutedUnit.COMPLIANCE)
        self.assertTrue(mr.requires_compliance_review(self.minutes))

    def test_the_compliance_manager_is_not_a_reviewer_without_compliance_business(self):
        # Not 403: a sitting with no compliance business is not theirs to see at
        # all until it is signed, so the minutes are simply not there for them.
        self._agenda_item("An appointment")
        self._post(self.taker, "submit-for-review")
        res = self._post(self.compliance, "secretariat-approve")
        self.assertEqual(res.status_code, 404, res.data)

    def test_resubmitting_clears_a_previous_compliance_approval(self):
        self._agenda_item("A discipline matter", category="discipline_compliance")
        self._post(self.taker, "submit-for-review")
        self._post(self.compliance, "secretariat-approve")
        self.minutes.refresh_from_db()
        self.minutes.status = MinutesStatus.DRAFT
        self.minutes.save(update_fields=["status"])

        self._post(self.taker, "submit-for-review")
        self.minutes.refresh_from_db()
        self.assertIsNone(self.minutes.compliance_reviewed_by)
        self.assertIsNone(self.minutes.compliance_reviewed_at)


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
        for user in (self.secretary, self.chairman):
            self.assertEqual(
                Notification.objects.filter(recipient=user, title__startswith="Minutes review overdue").count(),
                1, user.username,
            )
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

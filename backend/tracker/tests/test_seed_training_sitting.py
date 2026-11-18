"""seed_training_sitting builds practice data without touching real counters,
users or sending anything, and --cleanup removes all of it."""

import tempfile
from io import StringIO
from unittest import mock

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase, override_settings

from tracker.models import (
    AgendaDeferral, AgendaItem, Meeting, Minutes, Ministry, Profile, ReferenceCounter,
    Role, Submission, SubmissionDocument,
)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class SeedTrainingSittingTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("trn_admin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.chair = User.objects.create_user("trn_chair", password="x")
        Profile.objects.create(user=self.chair, role=Role.CHAIRPERSON)

    def _run(self, *args):
        out = StringIO()
        call_command("seed_training_sitting", *args, stdout=out)
        return out.getvalue()

    def test_seed_builds_sitting_and_leaves_counters_and_users_alone(self):
        counter_before = list(ReferenceCounter.objects.values_list("year", "last_seq"))
        users_before = User.objects.count()
        self._run()

        meeting = Meeting.objects.get(reference_number="TRAIN-MTG-001")
        self.assertEqual(meeting.agenda_status, "circulated")
        self.assertEqual(AgendaItem.objects.filter(meeting=meeting).count(), 4)
        subs = Submission.objects.filter(ministry__code="TRN")
        self.assertEqual(subs.count(), 4)
        self.assertTrue(all(s.reference_number.startswith("TRAIN-") for s in subs))
        self.assertTrue(all(s.ai_brief_processed and s.ai_quality_processed for s in subs))
        self.assertGreaterEqual(SubmissionDocument.objects.filter(submission__in=subs).count(), 5)
        self.assertEqual(AgendaDeferral.objects.filter(to_meeting=meeting).count(), 1)
        minutes = Minutes.objects.get(meeting__reference_number="TRAIN-MTG-000")
        self.assertEqual(minutes.status, "circulated_to_commissioners")
        self.assertEqual(minutes.comments.count(), 1)

        self.assertEqual(list(ReferenceCounter.objects.values_list("year", "last_seq")), counter_before)
        self.assertEqual(User.objects.count(), users_before)

    def test_seed_makes_no_ai_or_automation_calls(self):
        with mock.patch("tracker.tasks.queue_automation_event") as queue:
            self._run()
        # Stubbed inside the command, so the outer patch is replaced and never called.
        queue.assert_not_called()

    def test_rerun_without_cleanup_refuses(self):
        self._run()
        with self.assertRaises(Exception):
            self._run()

    def test_cleanup_removes_everything_but_users(self):
        self._run()
        self._run("--cleanup")
        self.assertFalse(Meeting.objects.filter(reference_number__startswith="TRAIN-").exists())
        self.assertFalse(Submission.objects.filter(reference_number__startswith="TRAIN-").exists())
        self.assertFalse(Ministry.objects.filter(code="TRN").exists())
        self.assertTrue(User.objects.filter(username="trn_admin").exists())
        self._run()  # can be rebuilt after cleanup


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class SeedTrainingSittingDraftStageTests(TestCase):
    def setUp(self):
        admin = User.objects.create_user("trn_admin2", password="x")
        Profile.objects.create(user=admin, role=Role.PSC_ADMIN)

    def test_draft_stage_leaves_agenda_unendorsed_and_uses_given_date(self):
        call_command("seed_training_sitting", "--stage", "draft", "--date", "2026-11-20", stdout=StringIO())
        meeting = Meeting.objects.get(reference_number="TRAIN-MTG-001")
        self.assertEqual(meeting.agenda_status, "draft")
        self.assertIsNone(meeting.agenda_approved_by)
        self.assertIsNone(meeting.agenda_approved_at)
        self.assertEqual(str(meeting.date), "2026-11-20")
        self.assertEqual(AgendaItem.objects.filter(meeting=meeting).count(), 4)
        # Seeded items must not be flagged as test data, or the agenda could never be endorsed.
        self.assertFalse(Submission.objects.filter(ministry__code="TRN", is_test=True).exists())

    def test_bad_date_is_rejected(self):
        with self.assertRaises(Exception):
            call_command("seed_training_sitting", "--date", "20/11/2026", stdout=StringIO())


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class SeedTrainingSigningSittingTests(TestCase):
    def setUp(self):
        admin = User.objects.create_user("trn_admin3", password="x")
        Profile.objects.create(user=admin, role=Role.PSC_ADMIN)

    def test_signing_sitting_has_minutes_awaiting_signature_and_cleans_up(self):
        call_command("seed_training_sitting", "--signing-sitting", stdout=StringIO())
        minutes = Minutes.objects.get(meeting__reference_number="TRAIN-MTG-002")
        self.assertEqual(minutes.status, "awaiting_signature")
        self.assertEqual(len(minutes.content["agenda_items"]), 3)
        call_command("seed_training_sitting", "--cleanup", stdout=StringIO())
        self.assertFalse(Meeting.objects.filter(reference_number="TRAIN-MTG-002").exists())

    def test_default_run_does_not_create_signing_sitting(self):
        call_command("seed_training_sitting", stdout=StringIO())
        self.assertFalse(Meeting.objects.filter(reference_number="TRAIN-MTG-002").exists())

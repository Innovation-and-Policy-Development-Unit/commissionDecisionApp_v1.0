"""Agenda blurb generation and the migration that cleans up the old
duplicated '[AI draft — verify]' prefix bug (see ai/agenda_blurb.py and
migrations/0272_strip_duplicate_agenda_blurb_prefix.py)."""

import importlib

from django.apps import apps as django_apps
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from tracker.ai.agenda_blurb import generate_agenda_blurb
from tracker.models import AgendaItem, Meeting, Ministry, Submission

_migration = importlib.import_module(
    "tracker.migrations.0272_strip_duplicate_agenda_blurb_prefix"
)


class GenerateAgendaBlurbFallbackTests(TestCase):
    """With no GEMINI_API_KEY configured, ai_enabled() is False, so this
    exercises the plain-text fallback path directly."""

    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_BLURB", name="Blurb Ministry")
        user = User.objects.create_user(username="blurb_officer", password="pass")
        self.meeting = Meeting.objects.create(
            title="Blurb Sitting", date="2026-07-01", time="09:00", venue="Boardroom",
        )
        self.submission = Submission.objects.create(
            title="Blurb matter",
            reference_number="PSC-TEST-BLURB",
            received_at=timezone.now(),
            created_by=user,
            ministry=self.ministry,
        )

    def test_fallback_blurb_has_no_ai_draft_prefix(self):
        blurb, err = generate_agenda_blurb(submission=self.submission, meeting=self.meeting)
        self.assertIsNone(err)
        self.assertNotIn("[AI draft", blurb)
        self.assertNotIn("[ai draft", blurb.lower())
        self.assertTrue(blurb.startswith(self.submission.reference_number))


class StripDuplicateAgendaBlurbPrefixMigrationTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_STRIP", name="Strip Ministry")
        user = User.objects.create_user(username="strip_officer", password="pass")
        self.meeting = Meeting.objects.create(
            title="Strip Sitting", date="2026-07-01", time="09:00", venue="Boardroom",
        )
        self.user = user

    def _make_item(self, *, blurb, ref):
        submission = Submission.objects.create(
            title=f"Matter {ref}",
            reference_number=ref,
            received_at=timezone.now(),
            created_by=self.user,
            ministry=self.ministry,
        )
        return AgendaItem.objects.create(
            meeting=self.meeting, submission=submission,
            category="other", sequence=1, agenda_blurb=blurb, agenda_blurb_processed=True,
        )

    def test_strips_duplicated_prefix(self):
        item = self._make_item(
            blurb="[AI draft — verify] [AI draft — verify] Some generated sentence.",
            ref="PSC-TEST-DUP",
        )
        _migration.strip_prefix(django_apps, None)
        item.refresh_from_db()
        self.assertEqual(item.agenda_blurb, "Some generated sentence.")

    def test_strips_single_prefix(self):
        item = self._make_item(
            blurb="[AI draft — verify] Some other sentence.",
            ref="PSC-TEST-SINGLE",
        )
        _migration.strip_prefix(django_apps, None)
        item.refresh_from_db()
        self.assertEqual(item.agenda_blurb, "Some other sentence.")

    def test_leaves_unaffected_rows_alone(self):
        item = self._make_item(blurb="A clean sentence with no prefix.", ref="PSC-TEST-CLEAN")
        _migration.strip_prefix(django_apps, None)
        item.refresh_from_db()
        self.assertEqual(item.agenda_blurb, "A clean sentence with no prefix.")

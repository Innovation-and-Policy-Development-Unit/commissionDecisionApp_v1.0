"""Live outcomes: the minute taker records what the Commission decided on an
item and Commissioners see it in the Sitting Pack, only for sittings that have
the switch on and have begun."""

import tempfile
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tracker.models import AgendaItem, Meeting, MinuteAgendaIntake, Profile, Role


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(), SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class LiveOutcomeTests(TestCase):
    def setUp(self):
        self.admin = self._user("lo_admin", Role.PSC_ADMIN)
        self.csu = self._user("lo_csu", Role.CSU_MANAGER)
        self.commissioner = self._user("lo_comm", Role.PSC_COMMISSIONER)
        self.officer = self._user("lo_off", Role.PSC_OFFICER)
        call_command("seed_training_sitting", "--stage", "circulated", stdout=StringIO())
        self.meeting = Meeting.objects.get(reference_number="TRAIN-MTG-099")
        self.item = self.meeting.agenda_items.order_by("sequence").first()

    def _user(self, name, role):
        u = User.objects.create_user(name, password="x")
        Profile.objects.create(user=u, role=role)
        return u

    def _client(self, user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    def _begin(self):
        self.meeting.status = "in_progress"
        self.meeting.save(update_fields=["status"])

    def _post(self, user, outcome, item=None):
        return self._client(user).post(
            f"/api/meetings/{self.meeting.id}/live-outcome/",
            {"agenda_item_id": (item or self.item).id, "outcome": outcome}, format="json")

    def test_training_sitting_has_the_switch_on_by_default(self):
        self.assertTrue(self.meeting.show_live_outcomes)

    def test_refused_before_the_sitting_has_begun(self):
        self.assertEqual(self._post(self.csu, "approved").status_code, 400)

    def test_manager_csu_records_and_commissioner_sees_it(self):
        self._begin()
        res = self._post(self.csu, "approved")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["live_outcome"], "approved")
        seen = self._client(self.commissioner).get(f"/api/agenda-items/?meeting={self.meeting.id}")
        rows = seen.data["results"] if isinstance(seen.data, dict) else seen.data
        row = next(r for r in rows if r["id"] == self.item.id)
        self.assertEqual(row["live_outcome"], "approved")
        self.assertEqual(row["live_outcome_label"], "Approved")
        others = [r for r in rows if r["id"] != self.item.id]
        self.assertTrue(all(r["live_outcome"] == "" for r in others))

    def test_clearing_and_changing(self):
        self._begin()
        self._post(self.csu, "deferred")
        self._post(self.csu, "not_approved")
        self.item.refresh_from_db()
        self.assertEqual(self.item.live_outcome, "not_approved")
        self.assertEqual(self.item.live_outcome_by_id, self.csu.id)
        self._post(self.csu, "")
        self.item.refresh_from_db()
        self.assertEqual(self.item.live_outcome, "")
        self.assertIsNone(self.item.live_outcome_at)

    def test_commissioner_and_officer_cannot_record(self):
        self._begin()
        self.assertEqual(self._post(self.commissioner, "approved").status_code, 403)
        self.assertEqual(self._post(self.officer, "approved").status_code, 403)

    def test_switch_off_hides_outcomes_and_refuses_recording(self):
        self._begin()
        self._post(self.csu, "approved")
        Meeting.objects.filter(pk=self.meeting.pk).update(show_live_outcomes=False)
        self.assertEqual(self._post(self.csu, "noted").status_code, 400)
        seen = self._client(self.commissioner).get(f"/api/agenda-items/?meeting={self.meeting.id}")
        rows = seen.data["results"] if isinstance(seen.data, dict) else seen.data
        self.assertTrue(all(r["live_outcome"] == "" for r in rows))

    def test_unknown_outcome_and_foreign_item_are_rejected(self):
        self._begin()
        self.assertEqual(self._post(self.csu, "maybe").status_code, 400)
        other = AgendaItem.objects.exclude(meeting=self.meeting).first()
        if other:
            self.assertEqual(self._post(self.csu, "approved", item=other).status_code, 400)

    def test_decision_line_is_prefilled_only_when_empty(self):
        self._begin()
        res = self._post(self.csu, "approved")
        self.assertEqual(res.data["decision_text"], "Approved.")
        row = MinuteAgendaIntake.objects.get(meeting=self.meeting, agenda_item=self.item)
        row.decision_text = "Approved subject to costings."
        row.save()
        self._post(self.csu, "noted")
        row.refresh_from_db()
        self.assertEqual(row.decision_text, "Approved subject to costings.")

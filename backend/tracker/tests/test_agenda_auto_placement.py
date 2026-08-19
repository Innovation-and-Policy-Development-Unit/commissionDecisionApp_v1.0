"""
Secretary approval (PENDING_SECRETARY_APPROVAL -> FORWARDED_TO_COMMISSION)
should auto-place the submission directly onto the correct meeting's agenda,
grouped by submission type — no manual "add item" / drag-and-drop needed.
"""
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import (
    AgendaItem, AgendaSection, Meeting, MeetingStatus, Ministry, Profile,
    Role, Submission, WorkflowStage,
)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class AgendaAutoPlacementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="ZZ_AAP", name="Auto Placement Ministry")

        self.secretary = User.objects.create_user(username="aap_secretary", password="pass")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)

        self.section = AgendaSection.objects.create(
            code="voluntary_resignation", label="Voluntary Resignation",
            display_order=5, is_active=True,
        )

        self.meeting = Meeting.objects.create(
            title="Auto Placement Sitting",
            date=(timezone.now().date() + timedelta(days=30)),
            time="09:00",
            venue="Boardroom",
            status=MeetingStatus.SCHEDULED,
            min_items=2, max_items=30,
        )

    def _submission(self, title, category="voluntary_resignation"):
        return Submission.objects.create(
            title=title,
            received_at=timezone.now(),
            created_by=self.secretary,
            ministry=self.ministry,
            is_internal=False,
            agenda_category=category,
            current_stage=WorkflowStage.PENDING_SECRETARY_APPROVAL,
        )

    def _approve(self, submission):
        self.client.force_authenticate(user=self.secretary)
        return self.client.post(
            f"/api/submissions/{submission.id}/transition/",
            {"new_stage": WorkflowStage.FORWARDED_TO_COMMISSION},
            format="json",
        )

    def test_secretary_approval_auto_creates_agenda_item(self):
        sub = self._submission("Resignation of J. Doe")
        res = self._approve(sub)
        self.assertEqual(res.status_code, 200)

        item = AgendaItem.objects.get(submission=sub)
        self.assertEqual(item.meeting_id, self.meeting.id)
        self.assertEqual(item.category, "voluntary_resignation")
        self.assertEqual(item.sequence, 1)

    def test_same_type_submissions_are_grouped_together(self):
        subs = [self._submission(f"Resignation {i}") for i in range(3)]
        # Interleave with a different-category submission to confirm grouping,
        # not just arrival order, drives sequence.
        other = self._submission("Appointment of X", category="appointment")

        for sub in subs:
            res = self._approve(sub)
            self.assertEqual(res.status_code, 200)
        res = self._approve(other)
        self.assertEqual(res.status_code, 200)

        items = list(
            AgendaItem.objects.filter(meeting=self.meeting, category="voluntary_resignation")
            .order_by("sequence")
        )
        self.assertEqual([i.submission_id for i in items], [s.id for s in subs])
        self.assertEqual([i.sequence for i in items], [1, 2, 3])

        other_item = AgendaItem.objects.get(submission=other)
        self.assertEqual(other_item.category, "appointment")
        self.assertEqual(other_item.sequence, 1)

    def test_no_duplicate_agenda_item_if_already_manually_placed(self):
        sub = self._submission("Already placed")
        AgendaItem.objects.create(
            meeting=self.meeting, submission=sub, category="voluntary_resignation", sequence=1,
        )
        res = self._approve(sub)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(AgendaItem.objects.filter(submission=sub).count(), 1)

    def test_no_eligible_meeting_leaves_submission_unplaced_not_crashing(self):
        # No scheduled meeting in the future for this case.
        self.meeting.status = MeetingStatus.COMPLETED
        self.meeting.save(update_fields=["status"])

        sub = self._submission("No meeting available")
        res = self._approve(sub)
        self.assertEqual(res.status_code, 200)
        self.assertFalse(AgendaItem.objects.filter(submission=sub).exists())

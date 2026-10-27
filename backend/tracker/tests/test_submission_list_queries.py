"""The submissions list must cost a fixed number of queries per page, not a
number that grows with the rows on it (the old list issued extra queries for
every row's meeting date and assignee role, and prefetched every workflow
event even though the list never shows them)."""

import datetime
from datetime import timedelta

from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    FormCategory,
    Meeting,
    MeetingStatus,
    Ministry,
    Profile,
    Role,
    Submission,
    WorkflowEvent,
    WorkflowStage,
)

# Stages that exercise the per-row paths: the meeting-date lookup
# (estimated_meeting_date) and the assignee-role label (allocated_to_label).
_STAGES = [
    WorkflowStage.SUBMITTED,
    WorkflowStage.UNDER_ASSESSMENT,
    WorkflowStage.FORWARDED_TO_COMMISSION,
    WorkflowStage.APPROVED,
    WorkflowStage.MANAGER_CHECKLIST_REVIEW,
]


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class SubmissionListQueryCountTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user("qc_admin", password="x")
        Profile.objects.create(user=self.user, role=Role.PSC_ADMIN)
        self.client.force_authenticate(user=self.user)
        self.ministry = Ministry.objects.create(code="QC", name="Query Count Ministry")
        self.form_cat = FormCategory.objects.create(code="psc_qc", name="PSC QC")
        self.assignee = User.objects.create_user("qc_principal", password="x", first_name="Pat")
        Profile.objects.create(user=self.assignee, role=Role.ODU_PRINCIPAL)
        Meeting.objects.create(
            date=(timezone.now() + timedelta(days=20)).date(),
            time=datetime.time(9, 0),
            status=MeetingStatus.SCHEDULED,
            submission_cutoff=timezone.now() + timedelta(days=30),
        )

    def _make(self, n):
        for i in range(n):
            sub = Submission.objects.create(
                title=f"QC {i}", form_category=self.form_cat, form_type_code="PSC 3.6",
                ministry=self.ministry, received_at=timezone.now(), created_by=self.user,
                current_stage=_STAGES[i % len(_STAGES)], assigned_to=self.assignee,
            )
            WorkflowEvent.objects.create(
                submission=sub, actor=self.user, previous_stage=WorkflowStage.DRAFT,
                new_stage=sub.current_stage, remarks="x",
            )

    def _list_queries(self):
        with CaptureQueriesContext(connection) as ctx:
            resp = self.client.get("/api/submissions/?ministry=Query Count Ministry&page_size=50")
        self.assertEqual(resp.status_code, 200)
        return len(ctx), resp.json()

    def test_list_query_count_does_not_grow_with_rows(self):
        self._make(5)
        few, body = self._list_queries()
        self.assertEqual(body["count"], 5)

        self._make(25)
        many, body = self._list_queries()
        self.assertEqual(body["count"], 30)

        print(f"\n[submission list] queries with 5 rows: {few}, with 30 rows: {many}")
        self.assertEqual(
            many, few,
            f"list cost grew with page size: {few} queries for 5 rows, {many} for 30",
        )

    def test_list_response_unchanged_for_meeting_date_and_label(self):
        """The optimisation must not change what the list returns."""
        self._make(len(_STAGES))
        _, body = self._list_queries()
        by_stage = {r["current_stage"]: r for r in body["results"]}
        # Migrations seed meetings of their own, so ask the model what the
        # one-at-a-time lookup says rather than assuming a single meeting.
        fwd = Submission.objects.get(
            ministry=self.ministry, current_stage=WorkflowStage.FORWARDED_TO_COMMISSION
        )
        expected = fwd.estimated_meeting_date
        self.assertIsNotNone(expected)
        self.assertEqual(
            by_stage[WorkflowStage.FORWARDED_TO_COMMISSION]["estimated_meeting_date"], str(expected)
        )
        self.assertIsNone(by_stage[WorkflowStage.SUBMITTED]["estimated_meeting_date"])
        self.assertEqual(by_stage[WorkflowStage.UNDER_ASSESSMENT]["allocated_to_label"], "Principal Pat")

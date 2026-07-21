from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    Department, FormCategory, Ministry, Profile, Role, Submission,
    SubmissionStageEvent, Unit, WorkflowStage,
)
from ..public_tracking_views import MILESTONES, STAGE_INFO

SENSITIVE_KEYS = {
    "title", "notes", "assigned_to", "ai_brief_summary", "classification",
    "tags", "created_by", "documents", "comments",
}


@override_settings(
    SECURE_SSL_REDIRECT=False,
    ALLOWED_HOSTS=['*'],
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "test-submission-track-api",
        }
    },
)
class TrackSubmissionAPITests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user("pscofficer", password="test1234")
        self.ministry = Ministry.objects.create(code="TESTMOH", name="Ministry of Health")
        self.form_cat = FormCategory.objects.create(code="psc_3_6", name="PSC 3.6")

    def _make(self, stage, **extra):
        return Submission.objects.create(
            title="Confidential HR Matter",
            form_category=self.form_cat, form_type_code="PSC 3.6",
            ministry=self.ministry, received_at=timezone.now(),
            created_by=self.user, current_stage=stage,
            **extra,
        )

    def test_draft_returns_generic_404(self):
        sub = self._make(WorkflowStage.DRAFT)
        resp = self.client.get(f"/api/track/{sub.reference_number}/")
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.json(), {"detail": "Submission not found."})

    def test_nonexistent_reference_returns_same_generic_404(self):
        resp = self.client.get("/api/track/PSC-2026-99999/")
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.json(), {"detail": "Submission not found."})

    def test_submitted_stage_returns_expected_milestone(self):
        sub = self._make(WorkflowStage.SUBMITTED)
        resp = self.client.get(f"/api/track/{sub.reference_number}/")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["reference_number"], sub.reference_number)
        self.assertEqual(body["ministry"], "Ministry of Health")
        self.assertEqual(body["current_stage_label"], "Submitted")
        self.assertEqual(body["milestone_index"], 0)
        self.assertEqual(body["milestones"], MILESTONES)
        self.assertFalse(body["is_paused"])
        self.assertIn("last_updated", body)

    def test_paused_stage_flagged_and_recalled_has_no_milestone(self):
        deferred = self._make(WorkflowStage.DEFERRED)
        body = self.client.get(f"/api/track/{deferred.reference_number}/").json()
        self.assertTrue(body["is_paused"])
        self.assertEqual(body["milestone_index"], 4)

        recalled = self._make(WorkflowStage.RECALLED)
        body = self.client.get(f"/api/track/{recalled.reference_number}/").json()
        self.assertIsNone(body["milestone_index"])
        self.assertTrue(body["is_paused"])

    def test_case_insensitive_and_whitespace_trimmed_lookup(self):
        sub = self._make(WorkflowStage.UNDER_ASSESSMENT)
        resp = self.client.get(f"/api/track/  {sub.reference_number.lower()}  /")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["reference_number"], sub.reference_number)

    def test_unit_and_role_shown_without_leaking_name(self):
        dept = Department.objects.create(ministry=self.ministry, code="ODU", name="Org Dev Department")
        unit = Unit.objects.create(department=dept, code="ODU-1", name="Organizational Development Unit")
        principal = User.objects.create_user("janedoe", first_name="Jane", last_name="Doe")
        Profile.objects.create(user=principal, role=Role.ODU_PRINCIPAL)

        sub = self._make(WorkflowStage.UNDER_ASSESSMENT, unit=unit, assigned_to=principal)
        body = self.client.get(f"/api/track/{sub.reference_number}/").json()

        self.assertEqual(body["unit"], "Organizational Development Unit")
        self.assertEqual(body["assigned_role"], Role.ODU_PRINCIPAL.label)
        payload_text = str(body)
        self.assertNotIn("Jane", payload_text)
        self.assertNotIn("Doe", payload_text)
        self.assertNotIn("janedoe", payload_text)

    def test_unassigned_submission_has_null_unit_and_role(self):
        sub = self._make(WorkflowStage.SUBMITTED)
        body = self.client.get(f"/api/track/{sub.reference_number}/").json()
        self.assertIsNone(body["unit"])
        self.assertIsNone(body["assigned_role"])

    def test_response_excludes_sensitive_fields(self):
        sub = self._make(WorkflowStage.COMMISSION_SITTING)
        resp = self.client.get(f"/api/track/{sub.reference_number}/")
        body = resp.json()
        self.assertEqual(
            set(body.keys()),
            {
                "reference_number", "ministry", "unit", "assigned_role",
                "current_stage_label", "is_paused", "milestone_index",
                "milestones", "history", "last_updated",
            },
        )
        self.assertFalse(SENSITIVE_KEYS & set(body.keys()))

    def test_no_authentication_required(self):
        sub = self._make(WorkflowStage.APPROVED)
        anon_client = APIClient()  # no force_authenticate, no credentials
        resp = anon_client.get(f"/api/track/{sub.reference_number}/")
        self.assertEqual(resp.status_code, 200)

    def test_all_non_draft_stages_have_stage_info(self):
        unmapped = [
            value for value in WorkflowStage.values
            if value != WorkflowStage.DRAFT and value not in STAGE_INFO
        ]
        self.assertEqual(
            unmapped, [],
            f"WorkflowStage values missing from STAGE_INFO: {unmapped}",
        )

    def test_stage_change_appends_history_and_noop_save_does_not(self):
        sub = self._make(WorkflowStage.SUBMITTED)
        sub.current_stage = WorkflowStage.RECEIVED_BY_PSC
        sub.save()
        sub.current_stage = WorkflowStage.REGISTERED_ROUTED
        sub.save()
        # No-op save (stage unchanged) must not append a duplicate event.
        sub.save()

        events = list(sub.stage_events.order_by("occurred_at").values_list("stage", flat=True))
        self.assertEqual(
            events,
            [WorkflowStage.SUBMITTED, WorkflowStage.RECEIVED_BY_PSC, WorkflowStage.REGISTERED_ROUTED],
        )

        body = self.client.get(f"/api/track/{sub.reference_number}/").json()
        self.assertEqual(
            [h["stage_label"] for h in body["history"]],
            ["Submitted", "Registered", "Registered"],
        )

    def test_history_excludes_draft_events(self):
        sub = self._make(WorkflowStage.DRAFT)
        sub.current_stage = WorkflowStage.SUBMITTED
        sub.save()

        self.assertEqual(
            list(sub.stage_events.values_list("stage", flat=True)),
            [WorkflowStage.DRAFT, WorkflowStage.SUBMITTED],
        )
        body = self.client.get(f"/api/track/{sub.reference_number}/").json()
        self.assertEqual([h["stage_label"] for h in body["history"]], ["Submitted"])


@override_settings(
    SECURE_SSL_REDIRECT=False,
    ALLOWED_HOSTS=['*'],
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "test-submission-track-throttle",
        }
    },
)
class TrackSubmissionThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_throttle_trips_after_configured_rate(self):
        statuses = [
            self.client.get("/api/track/PSC-2026-99999/").status_code
            for _ in range(11)
        ]
        self.assertNotIn(429, statuses[:10])
        self.assertEqual(statuses[10], 429)

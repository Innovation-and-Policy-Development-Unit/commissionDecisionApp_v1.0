"""Tests for the age-weighted staff workload rollup."""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    CommissionTask,
    FormCategory,
    Ministry,
    Profile,
    Role,
    Submission,
    SubmissionCoAssignment,
    WorkflowEvent,
    WorkflowStage,
)
from ..reports.workload import build_workload_summary, officer_load_index


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class WorkloadRollupTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-W", name="Test Ministry W")
        self.form_cat = FormCategory.objects.get_or_create(
            code="psc_3_6", defaults={"name": "PSC 3.6"}
        )[0]
        self.manager = User.objects.create_user("manager", password="x")
        Profile.objects.create(user=self.manager, role=Role.ODU_MANAGER)
        self.officer = User.objects.create_user("officer", first_name="Olive", password="x")
        Profile.objects.create(user=self.officer, role=Role.ODU_PRINCIPAL)
        self.peer = User.objects.create_user("peer", first_name="Pete", password="x")
        Profile.objects.create(user=self.peer, role=Role.ODU_PRINCIPAL)
        self.now = timezone.now()

    def _submission(self, *, assigned_to=None, assigned_days_ago=0, stage=WorkflowStage.UNDER_ASSESSMENT, **kw):
        sub = Submission.objects.create(
            title=kw.pop("title", "Paper"),
            form_category=self.form_cat,
            form_type_code="PSC 3.6",
            ministry=self.ministry,
            received_at=self.now - timedelta(days=assigned_days_ago),
            created_by=self.manager,
            current_stage=stage,
            assigned_to=assigned_to,
            routed_unit=kw.pop("routed_unit", "odu"),
            **kw,
        )
        if assigned_to:
            Submission.objects.filter(pk=sub.pk).update(
                assigned_at=self.now - timedelta(days=assigned_days_ago)
            )
            sub.refresh_from_db()
        return sub

    # ── Weighting math ───────────────────────────────────────────────────────

    def test_age_weighting(self):
        # Fresh paper → weight 1.0; 28-day-old paper → weight capped at 4.0.
        self._submission(assigned_to=self.officer, assigned_days_ago=0)
        self._submission(assigned_to=self.officer, assigned_days_ago=28)

        loads = officer_load_index()
        entry = loads[self.officer.id]
        self.assertEqual(entry["active_count"], 2)
        self.assertEqual(entry["weighted_load"], 5.0)
        self.assertEqual(entry["buckets"], {"fresh": 1, "aging": 0, "stale": 1})

    def test_age_weight_caps_at_three_weeks(self):
        self._submission(assigned_to=self.officer, assigned_days_ago=100)
        loads = officer_load_index()
        self.assertEqual(loads[self.officer.id]["weighted_load"], 4.0)

    def test_co_assignment_counts_half(self):
        sub = self._submission(assigned_to=self.officer, assigned_days_ago=0)
        SubmissionCoAssignment.objects.create(submission=sub, principal=self.peer)
        loads = officer_load_index()
        self.assertEqual(loads[self.peer.id]["co_assigned_count"], 1)
        self.assertEqual(loads[self.peer.id]["weighted_load"], 0.5)

    def test_terminal_and_attachment_submissions_excluded(self):
        self._submission(assigned_to=self.officer, stage=WorkflowStage.APPROVED)
        self._submission(assigned_to=self.officer, is_attachment=True)
        self.assertNotIn(self.officer.id, officer_load_index())

    # ── Task load ────────────────────────────────────────────────────────────

    def test_task_load_counts_staff_and_manager(self):
        task = CommissionTask.objects.create(
            title="Action the decision",
            assigned_manager=self.manager,
            created_by=self.manager,
            due_date=(self.now - timedelta(days=3)).date(),
        )
        task.assigned_staff_m2m.add(self.officer)

        loads = officer_load_index()
        self.assertEqual(loads[self.officer.id]["open_tasks"], 1)
        self.assertEqual(loads[self.officer.id]["overdue_tasks"], 1)
        self.assertEqual(loads[self.manager.id]["open_tasks"], 1)

    def test_completed_tasks_do_not_load(self):
        CommissionTask.objects.create(
            title="Done", assigned_manager=self.manager, created_by=self.manager,
            status="completed",
        )
        self.assertNotIn(self.manager.id, officer_load_index())

    # ── Durations ────────────────────────────────────────────────────────────

    def test_avg_assessment_days_from_workflow_events(self):
        sub = self._submission(assigned_to=self.officer, stage=WorkflowStage.FORWARDED_TO_COMMISSION)
        Submission.objects.filter(pk=sub.pk).update(
            assessment_started_at=self.now - timedelta(days=10)
        )
        event = WorkflowEvent.objects.create(
            submission=sub, actor=self.manager,
            previous_stage=WorkflowStage.UNDER_ASSESSMENT,
            new_stage=WorkflowStage.FORWARDED_TO_COMMISSION,
        )
        WorkflowEvent.objects.filter(pk=event.pk).update(
            created_at=self.now - timedelta(days=3)
        )

        summary = build_workload_summary()
        officer_row = next(o for o in summary["officers"] if o["id"] == self.officer.id)
        self.assertEqual(officer_row["avg_assessment_days"], 7)
        self.assertEqual(officer_row["assessments_completed"], 1)
        odu = next(u for u in summary["units"] if u["unit"] == "odu")
        self.assertEqual(odu["avg_assessment_days"], 7)

    # ── Summary shape ────────────────────────────────────────────────────────

    def test_summary_units_and_totals(self):
        self._submission(assigned_to=self.officer, assigned_days_ago=0)
        self._submission(assigned_to=None, assigned_days_ago=0)  # unassigned
        summary = build_workload_summary()

        odu = next(u for u in summary["units"] if u["unit"] == "odu")
        self.assertEqual(odu["active_count"], 2)
        self.assertEqual(odu["unassigned"], 1)
        # Absolute totals include demo submissions seeded by migration 0052,
        # so assert lower bounds only.
        self.assertGreaterEqual(summary["totals"]["active_submissions"], 2)
        self.assertGreaterEqual(summary["totals"]["unassigned"], 1)
        # Heaviest officer first.
        self.assertEqual(summary["officers"][0]["id"], self.officer.id)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class WorkloadAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="TST-W", name="Test Ministry W")
        self.form_cat = FormCategory.objects.get_or_create(
            code="psc_3_6", defaults={"name": "PSC 3.6"}
        )[0]
        self.secretary = User.objects.create_user("secretary", password="x")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)
        self.odu_manager = User.objects.create_user("odumgr", password="x")
        Profile.objects.create(user=self.odu_manager, role=Role.ODU_MANAGER)
        self.busy = User.objects.create_user("busy", first_name="Busy", password="x")
        Profile.objects.create(user=self.busy, role=Role.ODU_PRINCIPAL)
        self.free = User.objects.create_user("free", first_name="Free", password="x")
        Profile.objects.create(user=self.free, role=Role.ODU_PRINCIPAL)

        self.submission = Submission.objects.create(
            title="Restructure", form_category=self.form_cat, form_type_code="PSC 3.6",
            ministry=self.ministry, received_at=timezone.now(),
            created_by=self.secretary, current_stage=WorkflowStage.MANAGER_CHECKLIST_REVIEW,
            routed_unit="odu",
        )
        # Load up "busy" with an old active paper.
        old = Submission.objects.create(
            title="Old paper", form_category=self.form_cat, form_type_code="PSC 3.6",
            ministry=self.ministry, received_at=timezone.now() - timedelta(days=30),
            created_by=self.secretary, current_stage=WorkflowStage.UNDER_ASSESSMENT,
            assigned_to=self.busy, routed_unit="odu",
        )
        Submission.objects.filter(pk=old.pk).update(
            assigned_at=timezone.now() - timedelta(days=30)
        )

    def test_summary_rbac(self):
        self.client.force_authenticate(user=self.busy)  # principal — not a viewer
        self.assertEqual(self.client.get("/api/workload/summary/").status_code, 403)
        self.client.force_authenticate(user=self.odu_manager)
        self.assertEqual(self.client.get("/api/workload/summary/").status_code, 200)
        self.client.force_authenticate(user=self.secretary)
        resp = self.client.get("/api/workload/summary/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("officers", resp.json())
        self.assertIn("units", resp.json())

    def test_assignable_officers_enriched_and_sorted_lightest_first(self):
        self.client.force_authenticate(user=self.odu_manager)
        resp = self.client.get(
            f"/api/submissions/{self.submission.id}/assignable-officers/"
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        data = resp.json()
        by_name = {o["username"]: o for o in data}
        self.assertIn("weighted_load", by_name["busy"])
        self.assertEqual(by_name["busy"]["active_count"], 1)
        self.assertEqual(by_name["free"]["active_count"], 0)
        # Lightest first: "free" before "busy".
        names = [o["username"] for o in data if o["username"] in ("busy", "free")]
        self.assertEqual(names, ["free", "busy"])

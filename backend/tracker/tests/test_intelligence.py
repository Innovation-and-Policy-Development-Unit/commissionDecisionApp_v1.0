"""Tests for SCDMS Intelligence — semantic layer, query executor, and API."""

from datetime import timedelta

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from ..intelligence.datasets import get_dataset
from ..intelligence.query import execute_query
from ..models import (
    AgendaItem, FormCategory, Meeting, Ministry, Profile, Role, Submission, WorkflowStage,
)


def _total(result):
    return sum(r.get("count", 0) for r in result["rows"])


class IntelligenceExecutorTests(TestCase):
    def setUp(self):
        # Isolate from migration-seeded demo data so counts are deterministic.
        Submission.objects.all().delete()
        self.min_a = Ministry.objects.create(code="IA", name="Intel A")
        self.min_b = Ministry.objects.create(code="IB", name="Intel B")
        self.cat = FormCategory.objects.create(code="psc_3_6", name="PSC 3.6")
        self.admin = User.objects.create_user("intel_admin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.mhr = User.objects.create_user("intel_mhr", password="x")
        Profile.objects.create(user=self.mhr, role=Role.MINISTRY_HR, ministry=self.min_a)

        for i in range(3):
            Submission.objects.create(title=f"A{i}", form_category=self.cat, ministry=self.min_a,
                                      received_at=timezone.now(), created_by=self.admin,
                                      current_stage=WorkflowStage.SUBMITTED)
        for i in range(2):
            Submission.objects.create(title=f"B{i}", form_category=self.cat, ministry=self.min_b,
                                      received_at=timezone.now(), created_by=self.admin,
                                      current_stage=WorkflowStage.UNDER_ASSESSMENT)

    def test_group_by_category_dimension(self):
        res = execute_query(user=self.admin, dataset_key="submissions",
                            spec={"x": {"dimension": "current_stage"}, "metrics": [{"key": "count"}]})
        self.assertEqual(_total(res), 5)
        # current_stage values are humanised via choices labels
        names = {r["current_stage"] for r in res["rows"]}
        self.assertIn("Submitted to PSC", names)

    def test_time_grain_bucketing(self):
        res = execute_query(user=self.admin, dataset_key="submissions",
                            spec={"x": {"dimension": "created_at", "time_grain": "month"}})
        self.assertTrue(res["rows"])
        self.assertIn("x_bucket", res["rows"][0])

    def test_filter_applied(self):
        res = execute_query(user=self.admin, dataset_key="submissions",
                            spec={"x": {"dimension": "ministry__name"},
                                  "filters": [{"col": "current_stage", "op": "=", "val": "under_assessment"}]})
        self.assertEqual(_total(res), 2)

    def test_breakdown_dimension(self):
        res = execute_query(user=self.admin, dataset_key="submissions",
                            spec={"x": {"dimension": "current_stage"}, "dimensions": ["ministry__name"]})
        self.assertEqual(_total(res), 5)
        self.assertIn("ministry__name", res["rows"][0])

    def test_unknown_dimension_falls_back_to_total(self):
        res = execute_query(user=self.admin, dataset_key="submissions",
                            spec={"x": {"dimension": "evil_field"}})
        self.assertEqual(len(res["rows"]), 1)  # single big-number aggregate
        self.assertEqual(res["rows"][0]["count"], 5)

    def test_rbac_scoping(self):
        res = execute_query(user=self.mhr, dataset_key="submissions",
                            spec={"x": {"dimension": "current_stage"}})
        self.assertEqual(_total(res), 3)  # only Ministry A


class IntelligenceAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user("intel_api_admin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.mhr = User.objects.create_user("intel_api_mhr", password="x")
        Profile.objects.create(user=self.mhr, role=Role.MINISTRY_HR)

    def test_datasets_endpoint(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.get("/api/intelligence/datasets/")
        self.assertEqual(resp.status_code, 200)
        keys = {d["key"] for d in resp.data["datasets"]}
        self.assertIn("submissions", keys)

    def test_query_endpoint(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post("/api/intelligence/query/", {
            "dataset": "submissions",
            "query_spec": {"x": {"dimension": "current_stage"}, "metrics": [{"key": "count"}]},
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("columns", resp.data)
        self.assertIn("rows", resp.data)

    def test_unknown_dataset_rejected(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post("/api/intelligence/query/", {"dataset": "bogus", "query_spec": {}}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_permission_gate(self):
        self.client.force_authenticate(self.mhr)  # no view_reports in tests
        self.assertEqual(self.client.get("/api/intelligence/datasets/").status_code, 403)


class IntelligenceMetricsTests(TestCase):
    """Expanded Submissions metrics: count-distinct, conditional count, computed duration."""

    def setUp(self):
        # Isolate from migration-seeded demo data so counts are deterministic.
        Submission.objects.all().delete()
        self.admin = User.objects.create_user("intel_metrics_admin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.min_a = Ministry.objects.create(code="MA", name="Metrics A")
        self.min_b = Ministry.objects.create(code="MB", name="Metrics B")
        now = timezone.now()
        # Two ministries, two distinct form types, each with a 4-day turnaround.
        Submission.objects.create(
            title="m1", ministry=self.min_a, form_type_code="psc_5_1",
            received_at=now - timedelta(days=10), registered_at=now - timedelta(days=6),
            created_by=self.admin, current_stage=WorkflowStage.SUBMITTED,
        )
        Submission.objects.create(
            title="m2", ministry=self.min_b, form_type_code="psc_3_6",
            received_at=now - timedelta(days=8), registered_at=now - timedelta(days=4),
            created_by=self.admin, current_stage=WorkflowStage.SUBMITTED,
        )
        # One overdue assessment. Submission.save() forces assessment_deadline_at
        # to None unless assessment_started_at is set, so push the deadline into
        # the past via update() (bypassing save) to make it genuinely overdue.
        m3 = Submission.objects.create(
            title="m3", ministry=self.min_a, form_type_code="psc_5_1",
            received_at=now - timedelta(days=20),
            created_by=self.admin, current_stage=WorkflowStage.UNDER_ASSESSMENT,
        )
        Submission.objects.filter(pk=m3.pk).update(assessment_deadline_at=now - timedelta(days=1))

    def _big_number(self, metric_key):
        res = execute_query(user=self.admin, dataset_key="submissions",
                            spec={"metrics": [{"key": metric_key}]})
        self.assertEqual(len(res["rows"]), 1)  # big-number aggregate
        return res["rows"][0][metric_key]

    def test_distinct_ministries(self):
        self.assertEqual(self._big_number("distinct_ministries"), 2)

    def test_distinct_form_types(self):
        self.assertEqual(self._big_number("distinct_form_types"), 2)

    def test_overdue_count(self):
        self.assertEqual(self._big_number("overdue_count"), 1)

    def test_avg_turnaround_days_converted_to_number(self):
        # m1 and m2 are each 4 days; m3 has no registered_at so it's excluded.
        val = self._big_number("avg_turnaround_days")
        self.assertAlmostEqual(val, 4.0, places=1)

    def test_turnaround_grouped_by_ministry(self):
        res = execute_query(user=self.admin, dataset_key="submissions",
                            spec={"x": {"dimension": "ministry__name"},
                                  "metrics": [{"key": "avg_turnaround_days"}]})
        # Grouped rows also get the timedelta→days conversion (never a raw timedelta).
        for row in res["rows"]:
            self.assertNotIsInstance(row.get("avg_turnaround_days"), timedelta)

    def test_new_metrics_exposed_in_semantic_layer(self):
        keys = {m["key"] for m in get_dataset("submissions").to_dict()["metrics"]}
        self.assertTrue(
            {"count", "distinct_ministries", "distinct_form_types",
             "overdue_count", "avg_turnaround_days"} <= keys
        )


class IntelligenceMeetingsDatasetTests(TestCase):
    """Second dataset — Commission sittings, with subquery-annotated agenda load."""

    def setUp(self):
        # Isolate from migration-seeded meetings/submissions.
        Meeting.objects.all().delete()
        Submission.objects.all().delete()
        self.admin = User.objects.create_user("intel_meet_admin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.ministry = Ministry.objects.create(code="MTG", name="Mtg Ministry")
        self.m1 = Meeting.objects.create(
            title="S1", date="2026-07-01", time="09:00", venue="Boardroom",
        )
        self.m2 = Meeting.objects.create(
            title="S2", date="2026-08-01", time="09:00", venue="Hall",
        )
        sub = Submission.objects.create(
            title="agenda sub", received_at=timezone.now(),
            created_by=self.admin, ministry=self.ministry,  # ministry is NOT NULL
        )
        # m1 has one agenda item; m2 has none.
        AgendaItem.objects.create(meeting=self.m1, submission=sub, sequence=1)

    def test_dataset_registered(self):
        self.assertIsNotNone(get_dataset("meetings"))

    def test_count_and_agenda_items_total(self):
        res = execute_query(user=self.admin, dataset_key="meetings",
                            spec={"metrics": [{"key": "count"}, {"key": "agenda_items_total"}]})
        row = res["rows"][0]
        self.assertEqual(row["count"], 2)            # two sittings, not inflated by the join
        self.assertEqual(row["agenda_items_total"], 1)

    def test_distinct_venues(self):
        res = execute_query(user=self.admin, dataset_key="meetings",
                            spec={"metrics": [{"key": "distinct_venues"}]})
        self.assertEqual(res["rows"][0]["distinct_venues"], 2)

    def test_group_by_status(self):
        res = execute_query(user=self.admin, dataset_key="meetings",
                            spec={"x": {"dimension": "status"}, "metrics": [{"key": "count"}]})
        self.assertEqual(sum(r["count"] for r in res["rows"]), 2)

    def test_avg_agenda_items_is_numeric(self):
        res = execute_query(user=self.admin, dataset_key="meetings",
                            spec={"metrics": [{"key": "avg_agenda_items"}]})
        self.assertAlmostEqual(res["rows"][0]["avg_agenda_items"], 0.5, places=2)


class SavedExplorationAPITests(TestCase):
    """Saved explorations — ownership, sharing visibility, and the permission gate."""

    SPEC = {"x": {"dimension": "current_stage"}, "metrics": [{"key": "count"}]}

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user("expl_owner", password="x")
        Profile.objects.create(user=self.owner, role=Role.PSC_ADMIN)
        self.other = User.objects.create_user("expl_other", password="x")
        Profile.objects.create(user=self.other, role=Role.PSC_ADMIN)
        self.outsider = User.objects.create_user("expl_outsider", password="x")
        Profile.objects.create(user=self.outsider, role=Role.MINISTRY_HR)  # no view_reports

    def _create(self, name, *, shared=False):
        return self.client.post(
            "/api/intelligence/explorations/",
            {"name": name, "dataset": "submissions", "spec": self.SPEC, "is_shared": shared},
            format="json",
        )

    def test_create_and_list_own(self):
        self.client.force_authenticate(self.owner)
        r = self._create("Mine")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["is_owner"])
        listed = self.client.get("/api/intelligence/explorations/")
        self.assertIn("Mine", {e["name"] for e in listed.data["explorations"]})

    def test_private_hidden_from_others_but_shared_visible(self):
        self.client.force_authenticate(self.owner)
        self._create("Private")
        self._create("Shared", shared=True)
        self.client.force_authenticate(self.other)
        names = {e["name"] for e in self.client.get("/api/intelligence/explorations/").data["explorations"]}
        self.assertNotIn("Private", names)
        self.assertIn("Shared", names)


class DashboardAPITests(TestCase):
    """Dashboards — tile validation, ownership, sharing visibility, permission gate."""

    TILE = {
        "id": "t1", "title": "By stage", "dataset": "submissions",
        "spec": {"x": {"dimension": "current_stage"}, "metrics": [{"key": "count"}]},
        "chart_type": "column", "width": "half",
    }

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user("dash_owner", password="x")
        Profile.objects.create(user=self.owner, role=Role.PSC_ADMIN)
        self.other = User.objects.create_user("dash_other", password="x")
        Profile.objects.create(user=self.other, role=Role.PSC_ADMIN)
        self.outsider = User.objects.create_user("dash_outsider", password="x")
        Profile.objects.create(user=self.outsider, role=Role.MINISTRY_HR)  # no view_reports

    def _create(self, name, *, shared=False, tiles=None):
        return self.client.post(
            "/api/intelligence/dashboards/",
            {"name": name, "is_shared": shared,
             "tiles": tiles if tiles is not None else [self.TILE]},
            format="json",
        )

    def test_create_and_list_own(self):
        self.client.force_authenticate(self.owner)
        r = self._create("Ops board")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["is_owner"])
        self.assertEqual(len(r.data["tiles"]), 1)
        listed = self.client.get("/api/intelligence/dashboards/")
        self.assertIn("Ops board", {d["name"] for d in listed.data["dashboards"]})

    def test_invalid_tile_is_dropped(self):
        self.client.force_authenticate(self.owner)
        bad = {"title": "bad", "dataset": "nope", "spec": {}}
        r = self._create("Mixed", tiles=[self.TILE, bad])
        self.assertEqual(r.status_code, 201)
        self.assertEqual(len(r.data["tiles"]), 1)  # tile with unknown dataset removed

    def test_private_hidden_shared_visible(self):
        self.client.force_authenticate(self.owner)
        self._create("Private")
        self._create("Shared", shared=True)
        self.client.force_authenticate(self.other)
        names = {d["name"] for d in self.client.get("/api/intelligence/dashboards/").data["dashboards"]}
        self.assertNotIn("Private", names)
        self.assertIn("Shared", names)

    def test_shared_readable_but_only_owner_can_modify(self):
        self.client.force_authenticate(self.owner)
        d = self._create("Mine", shared=True).data
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f"/api/intelligence/dashboards/{d['id']}/").status_code, 200)
        patch = self.client.patch(f"/api/intelligence/dashboards/{d['id']}/",
                                  {"name": "Hacked"}, format="json")
        self.assertEqual(patch.status_code, 403)

    def test_permission_gate(self):
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.get("/api/intelligence/dashboards/").status_code, 403)

    def test_filters_persist_and_invalid_dropped(self):
        self.client.force_authenticate(self.owner)
        r = self.client.post(
            "/api/intelligence/dashboards/",
            {"name": "Filtered", "tiles": [self.TILE], "filters": [
                {"id": "f1", "type": "category", "col": "ministry__name", "label": "Ministry"},
                {"type": "bogus", "col": "x"},  # invalid type → dropped
            ]},
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(len(r.data["filters"]), 1)
        self.assertEqual(r.data["filters"][0]["col"], "ministry__name")

    def test_dataset_dimension_exposes_choices(self):
        self.client.force_authenticate(self.owner)
        ds = self.client.get("/api/intelligence/datasets/").data["datasets"]
        subs = next(d for d in ds if d["key"] == "submissions")
        stage = next(dim for dim in subs["dimensions"] if dim["key"] == "current_stage")
        self.assertIsInstance(stage["choices"], dict)
        self.assertIn("submitted", stage["choices"])


class IntelligenceReportTests(TestCase):
    """Scheduled reports & threshold alerts — CRUD, due-logic, and email delivery."""

    BASE = {"name": "Weekly count", "dataset": "submissions",
            "spec": {"metrics": [{"key": "count"}]},
            "frequency": "daily", "hour": 7, "recipients": ["ops@example.com"]}

    def setUp(self):
        Submission.objects.all().delete()  # deterministic alert values
        self.client = APIClient()
        self.owner = User.objects.create_user("rep_owner", password="x")
        Profile.objects.create(user=self.owner, role=Role.PSC_ADMIN)
        self.outsider = User.objects.create_user("rep_outsider", password="x")
        Profile.objects.create(user=self.outsider, role=Role.MINISTRY_HR)  # no view_reports
        self.ministry = Ministry.objects.create(code="RP", name="Report Ministry")
        for i in range(3):
            Submission.objects.create(title=f"r{i}", ministry=self.ministry,
                                      received_at=timezone.now(), created_by=self.owner,
                                      current_stage=WorkflowStage.SUBMITTED)

    # ── CRUD + validation ───────────────────────────────────────────────────
    def test_create_and_list_own(self):
        self.client.force_authenticate(self.owner)
        r = self.client.post("/api/intelligence/reports/", self.BASE, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["kind"], "report")
        listed = self.client.get("/api/intelligence/reports/")
        self.assertIn("Weekly count", {x["name"] for x in listed.data["reports"]})

    def test_alert_requires_threshold(self):
        self.client.force_authenticate(self.owner)
        bad = {**self.BASE, "kind": "alert", "alert_metric": "count", "alert_operator": "gt"}
        r = self.client.post("/api/intelligence/reports/", bad, format="json")
        self.assertEqual(r.status_code, 400)

    def test_permission_gate(self):
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.get("/api/intelligence/reports/").status_code, 403)

    # ── Due logic ───────────────────────────────────────────────────────────
    def test_due_logic(self):
        from tracker.intelligence.reports import report_is_due
        from tracker.models import IntelligenceReport

        now = timezone.localtime()
        rpt = IntelligenceReport(is_active=True, frequency="daily", hour=now.hour)
        self.assertTrue(report_is_due(rpt, now))           # matches hour, never run
        rpt.last_run_at = timezone.now()
        self.assertFalse(report_is_due(rpt, now))          # already ran today
        rpt.last_run_at = None
        rpt.hour = (now.hour + 1) % 24
        self.assertFalse(report_is_due(rpt, now))          # wrong hour

    # ── Delivery ────────────────────────────────────────────────────────────
    def test_run_now_sends_email(self):
        self.client.force_authenticate(self.owner)
        rid = self.client.post("/api/intelligence/reports/", self.BASE, format="json").data["id"]
        mail.outbox = []
        r = self.client.post(f"/api/intelligence/reports/{rid}/run/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(r.data["report"]["last_status"], "sent")

    def test_alert_triggers_and_sends(self):
        from tracker.intelligence.reports import run_report
        from tracker.models import IntelligenceReport

        rpt = IntelligenceReport.objects.create(
            owner=self.owner, name="Too many", dataset="submissions",
            spec={"metrics": [{"key": "count"}]}, kind="alert",
            alert_metric="count", alert_operator="gt", alert_threshold=2,
            recipients=["ops@example.com"],
        )
        mail.outbox = []
        run_report(rpt)               # 3 > 2 → triggered
        self.assertEqual(len(mail.outbox), 1)
        rpt.refresh_from_db()
        self.assertEqual(rpt.last_status, "triggered")
        self.assertEqual(rpt.last_value, 3)

    def test_alert_not_triggered_no_email(self):
        from tracker.intelligence.reports import run_report
        from tracker.models import IntelligenceReport

        rpt = IntelligenceReport.objects.create(
            owner=self.owner, name="Quiet", dataset="submissions",
            spec={"metrics": [{"key": "count"}]}, kind="alert",
            alert_metric="count", alert_operator="gt", alert_threshold=100,
            recipients=["ops@example.com"],
        )
        mail.outbox = []
        run_report(rpt)               # 3 > 100 is false → no email
        self.assertEqual(len(mail.outbox), 0)
        rpt.refresh_from_db()
        self.assertEqual(rpt.last_status, "ok")

    def test_non_owner_cannot_delete(self):
        self.client.force_authenticate(self.owner)
        eid = self._create("X", shared=True).data["id"]
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.delete(f"/api/intelligence/explorations/{eid}/").status_code, 403)

    def test_owner_can_delete(self):
        self.client.force_authenticate(self.owner)
        eid = self._create("Y").data["id"]
        self.assertEqual(self.client.delete(f"/api/intelligence/explorations/{eid}/").status_code, 204)

    def test_create_rejects_unknown_dataset(self):
        self.client.force_authenticate(self.owner)
        r = self.client.post(
            "/api/intelligence/explorations/",
            {"name": "Bad", "dataset": "nope", "spec": self.SPEC}, format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_gate_blocks_user_without_permission(self):
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.get("/api/intelligence/explorations/").status_code, 403)

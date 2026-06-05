"""Tests for SCDMS Intelligence — semantic layer, query executor, and API."""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from ..intelligence.query import execute_query
from ..models import FormCategory, Ministry, Profile, Role, Submission, WorkflowStage


def _total(result):
    return sum(r.get("count", 0) for r in result["rows"])


class IntelligenceExecutorTests(TestCase):
    def setUp(self):
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

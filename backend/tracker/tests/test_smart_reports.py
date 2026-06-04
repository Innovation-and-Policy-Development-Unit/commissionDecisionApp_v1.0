"""Tests for the Smart Report Enterprise Reporting Engine (Submissions domain)."""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    FormCategory,
    Ministry,
    Profile,
    Role,
    SmartReport,
    Submission,
    WorkflowStage,
)
from ..reports import render_helpers as rh
from ..reports.catalog import (
    CATALOG,
    build_catalog_spec,
    catalog_for_api,
    coerce_params,
    validate_spec,
)
from ..reports.domains import get_resolver


# ── Pure spec / catalog logic (no DB) ────────────────────────────────────────
class CatalogSpecTests(TestCase):
    def test_catalog_for_api_lists_reports(self):
        cards = catalog_for_api()
        self.assertEqual(len(cards), len(CATALOG))
        self.assertTrue(all("key" in c and "params" in c for c in cards))

    def test_build_catalog_spec_is_deterministic(self):
        spec = build_catalog_spec("submissions_volume_turnaround", {"date_from": "2026-01-01"})
        self.assertEqual(spec["domain"], "submissions")
        self.assertEqual(spec["report_type"], "submissions_volume_turnaround")
        self.assertTrue(spec["charts"])
        self.assertEqual(spec["params"]["date_from"], "2026-01-01")

    def test_build_catalog_spec_unknown_raises(self):
        with self.assertRaises(KeyError):
            build_catalog_spec("does_not_exist", {})

    def test_coerce_params_whitelists_and_types(self):
        out = coerce_params("submissions", {
            "ministry_id": "4",
            "date_from": "2026-01-01",
            "overdue_only": "true",
            "bogus": "x",
        })
        self.assertEqual(out["ministry_id"], 4)
        self.assertEqual(out["date_from"], "2026-01-01")
        self.assertIs(out["overdue_only"], True)
        self.assertNotIn("bogus", out)

    def test_validate_spec_strips_invalid_vocabulary(self):
        spec = validate_spec({
            "title": "X",
            "kpis": [{"source": "total"}, {"source": "not_a_kpi"}],
            "charts": [
                {"type": "bar", "source": "by_ministry", "title": "By ministry"},
                {"type": "pie", "source": "nonexistent"},
                {"type": "spaceship", "source": "by_stage"},
            ],
            "table": {"columns": ["reference_number", "evil_col"]},
            "narrative_markdown": "ok <script>alert(1)</script>",
        })
        self.assertEqual([k["source"] for k in spec["kpis"]], ["total"])
        self.assertEqual([c["source"] for c in spec["charts"]], ["by_ministry"])
        self.assertEqual(spec["table"]["columns"], ["reference_number"])
        self.assertEqual(spec["narrative_markdown"], "")  # script stripped

    def test_validate_spec_defaults_when_empty(self):
        spec = validate_spec({})
        self.assertTrue(spec["kpis"])
        self.assertTrue(spec["charts"])
        self.assertTrue(spec["table"]["columns"])


# ── Render helpers (pure) ────────────────────────────────────────────────────
class RenderHelperTests(TestCase):
    spec = {
        "kpis": [{"label": "Total", "source": "total"}],
        "charts": [{"id": "m", "type": "bar", "title": "By ministry", "source": "by_ministry"}],
        "table": {"columns": ["reference_number", "title"]},
    }
    agg = {"total": 5, "by_ministry": [{"name": "Health", "value": 3}, {"name": "Education", "value": 2}]}

    def test_render_kpis(self):
        html = rh.render_kpis(self.spec, self.agg)
        self.assertIn("kpi-card", html)
        self.assertIn("5", html)

    def test_charts_fallback_without_highcharts(self):
        html = rh.render_highcharts(self.spec, self.agg, "/* PLACEHOLDER */")
        self.assertIn("chart-fallback", html)
        self.assertNotIn("Highcharts.chart(", html)

    def test_charts_use_highcharts_when_present(self):
        fake_real = "var Highcharts={};" + ("x" * 3000)  # passes highcharts_available()
        html = rh.render_highcharts(self.spec, self.agg, fake_real)
        self.assertIn("Highcharts.chart(", html)

    def test_render_table(self):
        rows = [{"reference_number": "PSC-1", "title": "T"}]
        html = rh.render_table(rows, ["reference_number", "title"])
        self.assertIn("PSC-1", html)
        self.assertIn("Reference", html)


# ── Resolver RBAC scoping ────────────────────────────────────────────────────
class SubmissionsResolverScopingTests(TestCase):
    def setUp(self):
        self.min_a = Ministry.objects.create(code="MA", name="Ministry A")
        self.min_b = Ministry.objects.create(code="MB", name="Ministry B")
        self.cat = FormCategory.objects.create(code="psc_3_6", name="PSC 3.6")

        self.admin = User.objects.create_user("rep_admin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)

        self.mhr = User.objects.create_user("rep_mhr", password="x")
        Profile.objects.create(user=self.mhr, role=Role.MINISTRY_HR, ministry=self.min_a)

        for i in range(3):
            Submission.objects.create(
                title=f"A{i}", form_category=self.cat, ministry=self.min_a,
                received_at=timezone.now(), created_by=self.admin,
                current_stage=WorkflowStage.SUBMITTED,
            )
        for i in range(2):
            Submission.objects.create(
                title=f"B{i}", form_category=self.cat, ministry=self.min_b,
                received_at=timezone.now(), created_by=self.admin,
                current_stage=WorkflowStage.SUBMITTED,
            )

    def test_ministry_user_only_sees_own_ministry(self):
        resolver = get_resolver("submissions")
        ds = resolver.resolve(user=self.mhr, params={})
        self.assertEqual(ds.aggregates["total"], 3)

    def test_admin_sees_all(self):
        resolver = get_resolver("submissions")
        ds = resolver.resolve(user=self.admin, params={})
        self.assertEqual(ds.aggregates["total"], 5)

    def test_ministry_filter_param(self):
        resolver = get_resolver("submissions")
        ds = resolver.resolve(user=self.admin, params={"ministry_id": self.min_b.id})
        self.assertEqual(ds.aggregates["total"], 2)

    def test_aggregates_shape(self):
        resolver = get_resolver("submissions")
        ds = resolver.resolve(user=self.admin, params={})
        for key in ("total", "by_stage", "by_ministry", "by_month", "turnaround_buckets"):
            self.assertIn(key, ds.aggregates)
        self.assertEqual(ds.meta["row_count"], 5)


# ── API surface ──────────────────────────────────────────────────────────────
class SmartReportAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user("api_admin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.ministry_user = User.objects.create_user("api_mhr", password="x")
        Profile.objects.create(user=self.ministry_user, role=Role.MINISTRY_HR)

    def test_catalog_endpoint(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.get("/api/smart-reports/catalog/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["reports"]), len(CATALOG))

    def test_create_catalog_report_returns_202(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post(
            "/api/smart-reports/",
            {"report_type": "submissions_by_ministry", "params": {}},
            format="json",
        )
        self.assertEqual(resp.status_code, 202)
        self.assertTrue(SmartReport.objects.filter(requested_by=self.admin).exists())

    def test_adhoc_requires_prompt(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post("/api/smart-reports/", {"report_type": "adhoc"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_unknown_report_type_rejected(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post(
            "/api/smart-reports/", {"report_type": "bogus", "params": {}}, format="json"
        )
        self.assertEqual(resp.status_code, 400)

    def test_ministry_user_without_reports_permission_blocked(self):
        self.client.force_authenticate(self.ministry_user)
        resp = self.client.get("/api/smart-reports/catalog/")
        self.assertEqual(resp.status_code, 403)

    def test_library_scoped_to_owner(self):
        SmartReport.objects.create(requested_by=self.admin, report_type="adhoc", prompt="p")
        other = User.objects.create_user("api_other", password="x")
        Profile.objects.create(user=other, role=Role.PSC_ADMIN)
        SmartReport.objects.create(requested_by=other, report_type="adhoc", prompt="p2")

        self.client.force_authenticate(self.admin)
        resp = self.client.get("/api/smart-reports/?mine=1")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)

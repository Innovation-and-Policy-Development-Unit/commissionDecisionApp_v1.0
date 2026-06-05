"""Tests for the Smart Report engine (spec, resolver, render helpers, generation API)."""

from types import SimpleNamespace

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    FormCategory,
    Ministry,
    Profile,
    ReportTemplate,
    Role,
    SmartReport,
    Submission,
    WorkflowStage,
)
from ..reports import render_helpers as rh
from ..reports.catalog import build_template_spec, coerce_params, validate_spec, vocabulary
from ..reports.domains import get_resolver


# ── Pure spec logic (no DB) ───────────────────────────────────────────────────
class SpecLogicTests(TestCase):
    def test_vocabulary_shape(self):
        v = vocabulary()
        self.assertIn("chart_types", v)
        self.assertIn("kpi_sources", v)
        self.assertIn("table_columns", v)

    def test_coerce_params_whitelists_and_types(self):
        out = coerce_params("submissions", {
            "ministry_id": "4", "date_from": "2026-01-01",
            "overdue_only": "true", "bogus": "x",
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
        self.assertEqual(spec["narrative_markdown"], "")

    def test_build_template_spec(self):
        tmpl = SimpleNamespace(
            domain="submissions",
            default_params={},
            name="My Template",
            slug="my-template",
            spec={"kpis": [{"source": "total"}], "charts": [], "table": {"columns": ["reference_number"]}},
        )
        spec = build_template_spec(tmpl, {"date_from": "2026-01-01"})
        self.assertEqual(spec["report_type"], "my-template")
        self.assertEqual(spec["title"], "My Template")
        self.assertEqual(spec["params"]["date_from"], "2026-01-01")
        self.assertEqual([k["source"] for k in spec["kpis"]], ["total"])


# ── Render helpers (pure) ─────────────────────────────────────────────────────
class RenderHelperTests(TestCase):
    spec = {
        "kpis": [{"label": "Total", "source": "total"}],
        "charts": [{"id": "m", "type": "bar", "title": "By ministry", "source": "by_ministry"}],
        "table": {"columns": ["reference_number", "title"]},
    }
    agg = {"total": 5, "by_ministry": [{"name": "Health", "value": 3}, {"name": "Education", "value": 2}]}

    def test_render_kpis(self):
        self.assertIn("kpi-card", rh.render_kpis(self.spec, self.agg))

    def test_charts_fallback_without_highcharts(self):
        html = rh.render_highcharts(self.spec, self.agg, "/* PLACEHOLDER */")
        self.assertIn("chart-fallback", html)
        self.assertNotIn("Highcharts.chart(", html)

    def test_charts_use_highcharts_when_present(self):
        fake_real = "var Highcharts={};" + ("x" * 3000)
        self.assertIn("Highcharts.chart(", rh.render_highcharts(self.spec, self.agg, fake_real))

    def test_render_table(self):
        html = rh.render_table([{"reference_number": "PSC-1", "title": "T"}], ["reference_number", "title"])
        self.assertIn("PSC-1", html)
        self.assertIn("Reference", html)


# ── Resolver RBAC scoping ─────────────────────────────────────────────────────
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
            Submission.objects.create(title=f"A{i}", form_category=self.cat, ministry=self.min_a,
                                      received_at=timezone.now(), created_by=self.admin,
                                      current_stage=WorkflowStage.SUBMITTED)
        for i in range(2):
            Submission.objects.create(title=f"B{i}", form_category=self.cat, ministry=self.min_b,
                                      received_at=timezone.now(), created_by=self.admin,
                                      current_stage=WorkflowStage.SUBMITTED)

    def test_ministry_user_only_sees_own_ministry(self):
        ds = get_resolver("submissions").resolve(user=self.mhr, params={})
        self.assertEqual(ds.aggregates["total"], 3)

    def test_admin_sees_more_than_ministry_user(self):
        # Admin sees at least the created rows (plus any migration-seeded data),
        # and can see Ministry B — which the Ministry A user cannot.
        r = get_resolver("submissions")
        self.assertGreaterEqual(r.resolve(user=self.admin, params={}).aggregates["total"], 5)
        self.assertEqual(r.resolve(user=self.admin, params={"ministry_id": self.min_b.id}).aggregates["total"], 2)

    def test_ministry_filter_param(self):
        ds = get_resolver("submissions").resolve(user=self.admin, params={"ministry_id": self.min_b.id})
        self.assertEqual(ds.aggregates["total"], 2)


# ── Generation API ────────────────────────────────────────────────────────────
class SmartReportAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user("api_admin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)
        self.ministry_user = User.objects.create_user("api_mhr", password="x")
        Profile.objects.create(user=self.ministry_user, role=Role.MINISTRY_HR)

    def test_create_template_report_returns_202(self):
        # The seeded templates exist via migration 0129.
        self.assertTrue(ReportTemplate.objects.filter(slug="submissions_by_ministry").exists())
        self.client.force_authenticate(self.admin)
        resp = self.client.post(
            "/api/smart-reports/",
            {"template": "submissions_by_ministry", "params": {}},
            format="json",
        )
        self.assertEqual(resp.status_code, 202)
        self.assertTrue(SmartReport.objects.filter(requested_by=self.admin).exists())

    def test_adhoc_requires_prompt(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post("/api/smart-reports/", {"report_type": "adhoc"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_unknown_template_rejected(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post("/api/smart-reports/", {"template": "bogus"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_user_without_reports_permission_blocked(self):
        # ministry_hr has no seeded RoleDefinition in tests → no view_reports.
        self.client.force_authenticate(self.ministry_user)
        resp = self.client.get("/api/smart-reports/")
        self.assertEqual(resp.status_code, 403)

    def test_download_ready_report(self):
        # Regression: download uses ?fmt= (not DRF's reserved ?format=) and serves the file.
        from django.core.files.base import ContentFile
        self.client.force_authenticate(self.admin)
        r = SmartReport.objects.create(
            requested_by=self.admin, report_type="adhoc", prompt="p",
            status=SmartReport.Status.READY,
        )
        r.html_file.save("r.html", ContentFile(b"<html>hi report</html>"), save=True)
        resp = self.client.get(f"/api/smart-reports/{r.id}/download/?fmt=html")
        self.assertEqual(resp.status_code, 200)
        body = b"".join(resp.streaming_content)
        self.assertIn(b"hi report", body)

    def test_delete_report(self):
        self.client.force_authenticate(self.admin)
        r = SmartReport.objects.create(requested_by=self.admin, report_type="adhoc", prompt="p")
        resp = self.client.delete(f"/api/smart-reports/{r.id}/")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(SmartReport.objects.filter(id=r.id).exists())

    def test_library_scoped_to_owner(self):
        SmartReport.objects.create(requested_by=self.admin, report_type="adhoc", prompt="p")
        other = User.objects.create_user("api_other", password="x")
        Profile.objects.create(user=other, role=Role.PSC_ADMIN)
        SmartReport.objects.create(requested_by=other, report_type="adhoc", prompt="p2")
        self.client.force_authenticate(self.admin)
        resp = self.client.get("/api/smart-reports/?mine=1")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)

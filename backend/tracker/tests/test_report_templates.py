"""Tests for report templates: CRUD permissions, visibility, and generation."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from ..models import (
    Profile,
    ReportTemplate,
    Role,
    RoleDefinition,
    SmartReport,
    SystemPermission,
)


class ReportTemplateTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin = User.objects.create_user("tpl_admin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)

        # Reader: an officer granted view_reports (but NOT manage_report_templates).
        self.reader = User.objects.create_user("tpl_reader", password="x")
        Profile.objects.create(user=self.reader, role=Role.PSC_OFFICER)
        view_perm = SystemPermission.objects.create(code="view_reports", label="View Reports")
        rd = RoleDefinition.objects.create(role=Role.PSC_OFFICER)
        rd.permissions.add(view_perm)

    # ── CRUD permissions ──────────────────────────────────────────────────────
    def test_admin_can_create_template(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post("/api/report-templates/", {
            "name": "My Custom Report",
            "domain": "submissions",
            "spec": {"kpis": [{"source": "total"}], "charts": [], "table": {"columns": ["reference_number"]}},
            "param_schema": [{"key": "date_from", "type": "date", "label": "From"}],
            "visible_to_all": True,
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["slug"], "my-custom-report")

    def test_non_admin_cannot_create(self):
        self.client.force_authenticate(self.reader)
        resp = self.client.post("/api/report-templates/", {"name": "Nope"}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_spec_validation_strips_invalid_charts(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post("/api/report-templates/", {
            "name": "Stripper",
            "domain": "submissions",
            "spec": {
                "kpis": [{"source": "total"}],
                "charts": [{"type": "bar", "source": "not_real"}],
                "table": {"columns": ["reference_number", "evil"]},
            },
            "param_schema": [],
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["spec"]["charts"], [])
        self.assertEqual(resp.data["spec"]["table"]["columns"], ["reference_number"])

    def test_vocabulary_requires_manage(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get("/api/report-templates/vocabulary/").status_code, 200)
        self.client.force_authenticate(self.reader)
        self.assertEqual(self.client.get("/api/report-templates/vocabulary/").status_code, 403)

    # ── Visibility ────────────────────────────────────────────────────────────
    def test_reader_sees_active_visible_templates(self):
        # 3 seeded (migration 0129), all active + visible_to_all.
        self.client.force_authenticate(self.reader)
        resp = self.client.get("/api/report-templates/")
        self.assertEqual(resp.status_code, 200)
        slugs = {t["slug"] for t in resp.data}
        self.assertIn("submissions_by_ministry", slugs)

    def test_reader_excluded_from_inactive_and_restricted(self):
        ReportTemplate.objects.create(name="Hidden", slug="hidden", domain="submissions",
                                      spec={}, is_active=False, visible_to_all=True)
        ReportTemplate.objects.create(name="AdminsOnly", slug="admins-only", domain="submissions",
                                      spec={}, is_active=True, visible_to_all=False,
                                      visible_roles=[Role.PSC_ADMIN])
        self.client.force_authenticate(self.reader)
        slugs = {t["slug"] for t in self.client.get("/api/report-templates/").data}
        self.assertNotIn("hidden", slugs)
        self.assertNotIn("admins-only", slugs)

    # ── Generation from template ──────────────────────────────────────────────
    def test_generate_from_visible_template_strips_unknown_params(self):
        self.client.force_authenticate(self.reader)
        resp = self.client.post("/api/smart-reports/", {
            "template": "submissions_by_ministry",
            "params": {"date_from": "2026-01-01", "bogus": "x"},
        }, format="json")
        self.assertEqual(resp.status_code, 202)
        report = SmartReport.objects.filter(requested_by=self.reader).latest("id")
        self.assertEqual(report.params, {"date_from": "2026-01-01"})
        self.assertEqual(report.template.slug, "submissions_by_ministry")

    def test_generate_restricted_template_denied(self):
        ReportTemplate.objects.create(name="AdminsOnly", slug="admins-only-2", domain="submissions",
                                      spec={}, is_active=True, visible_to_all=False,
                                      visible_roles=[Role.PSC_ADMIN])
        self.client.force_authenticate(self.reader)
        resp = self.client.post("/api/smart-reports/", {"template": "admins-only-2"}, format="json")
        self.assertEqual(resp.status_code, 403)

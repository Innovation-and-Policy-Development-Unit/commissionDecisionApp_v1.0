"""Tests for the pilot adoption, stage flow and integrity report domains."""

import json
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.exceptions import PermissionDenied
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from ..audit import log_action
from ..models import (
    AuditLog,
    Ministry,
    Profile,
    ReportTemplate,
    Role,
    RoleDefinition,
    SmartReport,
    Submission,
    SystemPermission,
    WorkflowEvent,
    WorkflowStage,
)
from ..reports import render_helpers as rh
from ..reports.catalog import build_template_spec, validate_spec, vocabulary
from ..reports.domains import domain_allows, get_resolver

S = WorkflowStage


def _event(sub, prev, new, at):
    ev = WorkflowEvent.objects.create(submission=sub, previous_stage=prev, new_stage=new)
    WorkflowEvent.objects.filter(pk=ev.pk).update(created_at=at)
    return ev


def _sub(creator, ministry, title, stage, **extra):
    return Submission.objects.create(
        title=title, ministry=ministry, created_by=creator,
        received_at=timezone.now(), current_stage=stage, **extra,
    )


def _user(name, role, ministry=None, **profile_extra):
    user = User.objects.create_user(name, password="x")
    Profile.objects.create(user=user, role=role, ministry=ministry, **profile_extra)
    return user


class DomainVocabularyTests(TestCase):
    def test_vocabulary_is_per_domain(self):
        flow = vocabulary("stage_flow")
        self.assertEqual(flow["domain"], "stage_flow")
        self.assertIn("stage_median_days", flow["chart_sources"])
        self.assertNotIn("by_stage", flow["chart_sources"])
        self.assertIn("by_stage", vocabulary()["chart_sources"])
        self.assertEqual(vocabulary("nonsense")["domain"], "submissions")

    def test_validate_spec_uses_domain_vocabulary(self):
        spec = validate_spec(
            {"kpis": [{"source": "ministries_total"}, {"source": "total"}],
             "charts": [{"type": "pie", "source": "adoption_status"}, {"type": "bar", "source": "by_stage"}],
             "table": {"columns": ["ministry", "reference_number"]}},
            domain="pilot_adoption",
        )
        self.assertEqual([k["source"] for k in spec["kpis"]], ["ministries_total"])
        self.assertEqual([c["source"] for c in spec["charts"]], ["adoption_status"])
        self.assertEqual(spec["table"]["columns"], ["ministry"])

    def test_empty_spec_gets_domain_defaults(self):
        spec = validate_spec({}, domain="integrity")
        self.assertEqual(spec["kpis"][0]["source"], "audit_chain_status")

    def test_seeded_templates(self):
        expected = {
            "pilot_adoption_scorecard": "pilot_adoption",
            "stage_flow_bottlenecks": "stage_flow",
            "integrity_access_attestation": "integrity",
        }
        for slug, domain in expected.items():
            tmpl = ReportTemplate.objects.get(slug=slug)
            self.assertEqual(tmpl.domain, domain)
            spec = build_template_spec(tmpl, {})
            self.assertEqual(len(spec["kpis"]), len(tmpl.spec["kpis"]), slug)
            self.assertEqual(len(spec["charts"]), len(tmpl.spec["charts"]), slug)
            self.assertTrue(spec["table"]["labels"], slug)


class PilotAdoptionTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.now = now
        self.admin = _user("pa_admin", Role.PSC_ADMIN)
        self.min_a = Ministry.objects.create(code="PA", name="Ministry A")
        self.min_b = Ministry.objects.create(code="PB", name="Ministry B")

        active = _user("pa_a1", Role.MINISTRY_HR, self.min_a)
        _user("pa_a2", Role.MINISTRY_HR, self.min_a)  # never signed in
        User.objects.filter(pk=active.pk).update(last_login=now - timedelta(days=5))
        stale = _user("pa_b1", Role.MINISTRY_HR, self.min_b)
        User.objects.filter(pk=stale.pk).update(last_login=now - timedelta(days=60))

        # Lodged, returned once, then approved 10 days after lodgement.
        s1 = _sub(self.admin, self.min_a, "S1", S.APPROVED)
        _event(s1, S.DRAFT, S.SUBMITTED, now - timedelta(days=20))
        _event(s1, S.SUBMITTED, S.RETURNED_FOR_CLARIFICATION, now - timedelta(days=18))
        _event(s1, S.RETURNED_FOR_CLARIFICATION, S.SUBMITTED, now - timedelta(days=15))
        _event(s1, S.SUBMITTED, S.APPROVED, now - timedelta(days=10))
        # Lodged, clean, still under assessment.
        s2 = _sub(self.admin, self.min_a, "S2", S.UNDER_ASSESSMENT)
        _event(s2, S.DRAFT, S.SUBMITTED, now - timedelta(days=5))
        # Excluded by default: test submission and OPSC-internal submission.
        s3 = _sub(self.admin, self.min_a, "S3", S.SUBMITTED, is_test=True)
        _event(s3, S.DRAFT, S.SUBMITTED, now - timedelta(days=3))
        s4 = _sub(self.admin, self.min_a, "S4", S.SUBMITTED, is_internal=True)
        _event(s4, S.DRAFT, S.SUBMITTED, now - timedelta(days=3))
        # A draft untouched for a month.
        s5 = _sub(self.admin, self.min_a, "S5", S.DRAFT)
        Submission.objects.filter(pk=s5.pk).update(updated_at=now - timedelta(days=30))

    def _rows(self, **params):
        ds = get_resolver("pilot_adoption").resolve(user=self.admin, params=params)
        return ds, {r["ministry"]: r for r in ds.rows}

    def test_ministry_scorecard(self):
        ds, rows = self._rows()
        a, b = rows["Ministry A"], rows["Ministry B"]
        self.assertEqual((a["accounts"], a["active_users"], a["never_logged_in"]), (2, 1, 1))
        self.assertEqual((a["lodged"], a["returned"], a["decided"]), (2, 1, 1))
        self.assertEqual(a["first_time_right_pct"], 50.0)
        self.assertEqual(a["median_turnaround_days"], 10.0)
        self.assertEqual(a["stalled_drafts"], 1)
        self.assertEqual(a["status"], "Needs support")
        self.assertEqual((b["accounts"], b["active_users"], b["lodged"]), (1, 0, 0))
        self.assertEqual(b["status"], "Not started")

        # Migration-seeded demo ministries/submissions also appear, so totals are lower bounds.
        agg = ds.aggregates
        self.assertGreaterEqual(agg["ministries_total"], 2)
        self.assertGreaterEqual(agg["lodged_total"], 2)
        self.assertGreaterEqual(agg["active_users"], 1)
        self.assertGreaterEqual(agg["ministries_needs_support"], 1)
        self.assertGreaterEqual(agg["ministries_not_started"], 1)
        # Attention-first ordering: no "Active" row before a "Needs support" row.
        order = ["Needs support", "Not started", "Onboarding", "Active"]
        positions = [order.index(r["status"]) for r in ds.rows]
        self.assertEqual(positions, sorted(positions))

    def test_test_submissions_only_counted_on_request(self):
        _, rows = self._rows(include_test=True)
        self.assertEqual(rows["Ministry A"]["lodged"], 3)

    def test_date_range_limits_lodgements_but_not_activity(self):
        start = (self.now - timedelta(days=8)).strftime("%Y-%m-%d")
        ds, rows = self._rows(date_from=start)
        self.assertEqual(rows["Ministry A"]["lodged"], 1)  # only S2
        self.assertEqual(rows["Ministry A"]["active_users"], 1)

    def test_ministry_users_cannot_run_it(self):
        mhr = User.objects.get(username="pa_a1")
        resolver = get_resolver("pilot_adoption")
        self.assertFalse(resolver.authorize(mhr))
        with self.assertRaises(PermissionDenied):
            resolver.resolve(user=mhr, params={})


class StageFlowTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.admin = _user("sf_admin", Role.PSC_ADMIN)
        self.min_a = Ministry.objects.create(code="FA", name="Flow A")
        self.min_b = Ministry.objects.create(code="FB", name="Flow B")

        # x: waiting in under_assessment for 11 days.
        t0 = now - timedelta(days=20)
        self.x = _sub(self.admin, self.min_a, "X", S.UNDER_ASSESSMENT)
        _event(self.x, S.DRAFT, S.SUBMITTED, t0)
        _event(self.x, S.SUBMITTED, S.RECEIVED_BY_PSC, t0 + timedelta(days=2))
        _event(self.x, S.RECEIVED_BY_PSC, S.REGISTERED_ROUTED, t0 + timedelta(days=5))
        _event(self.x, S.REGISTERED_ROUTED, S.UNDER_ASSESSMENT, t0 + timedelta(days=9))
        # y: approved ten days after lodgement.
        t1 = now - timedelta(days=30)
        self.y = _sub(self.admin, self.min_a, "Y", S.APPROVED)
        _event(self.y, S.DRAFT, S.SUBMITTED, t1)
        _event(self.y, S.SUBMITTED, S.RECEIVED_BY_PSC, t1 + timedelta(days=4))
        _event(self.y, S.RECEIVED_BY_PSC, S.APPROVED, t1 + timedelta(days=10))

    def _resolve(self, **extra):
        # Scope to this test's ministry: migration 0052 seeds demo submissions elsewhere.
        params = {"ministry_id": self.min_a.id, **extra}
        return get_resolver("stage_flow").resolve(user=self.admin, params=params)

    def test_dwell_and_wait_statistics(self):
        ds = self._resolve()
        agg = ds.aggregates
        self.assertEqual(agg["matters_in_scope"], 2)
        self.assertEqual(agg["open_now"], 1)
        self.assertEqual(agg["decided_total"], 1)
        self.assertEqual(agg["median_end_to_end_days"], 10.0)
        self.assertAlmostEqual(agg["longest_open_days"], 11.0, delta=0.2)
        self.assertEqual(agg["waiting_over_30_days"], 0)
        # Submitted-to-PSC stays: x 2 days, y 4 days → median 3.
        medians = {d["name"]: d["value"] for d in agg["stage_median_days"]}
        self.assertEqual(medians["Submitted to PSC"], 3)
        # Too few completed stays to name a slowest stage.
        self.assertEqual(agg["slowest_stage"], "n/a")
        # The matter waiting is listed; the approved one is not.
        self.assertEqual([r["title"] for r in ds.rows], ["X"])
        self.assertEqual(ds.rows[0]["stage"], "Under Assessment")
        self.assertAlmostEqual(ds.rows[0]["days_in_stage"], 11.0, delta=0.2)

    def test_slowest_stage_needs_three_samples(self):
        now = timezone.now()
        for i in range(3):
            s = _sub(self.admin, self.min_a, f"Z{i}", S.APPROVED)
            _event(s, S.DRAFT, S.SUBMITTED, now - timedelta(days=40))
            _event(s, S.SUBMITTED, S.UNDER_ASSESSMENT, now - timedelta(days=39))
            _event(s, S.UNDER_ASSESSMENT, S.APPROVED, now - timedelta(days=29))
        agg = self._resolve().aggregates
        self.assertEqual(agg["slowest_stage"], "Under Assessment")
        self.assertEqual(agg["slowest_stage_median_days"], 10.0)

    def test_test_submissions_excluded_by_default(self):
        t = _sub(self.admin, self.min_a, "T", S.UNDER_ASSESSMENT, is_test=True)
        _event(t, S.DRAFT, S.UNDER_ASSESSMENT, timezone.now() - timedelta(days=2))
        self.assertEqual(self._resolve().aggregates["matters_in_scope"], 2)
        self.assertEqual(self._resolve(include_test=True).aggregates["matters_in_scope"], 3)

    def test_scoped_to_what_the_user_can_see(self):
        other = _user("sf_mhr", Role.MINISTRY_HR, self.min_b)
        ds = get_resolver("stage_flow").resolve(user=other, params={})
        self.assertEqual(ds.aggregates["matters_in_scope"], 0)
        self.assertEqual(ds.rows, [])


class IntegrityAttestationTests(TestCase):
    def setUp(self):
        self.admin = _user("ia_admin", Role.PSC_ADMIN)
        self.officer = _user("ia_officer", Role.PSC_OFFICER)
        log_action(None, AuditLog.Action.LOGIN_FAILED, description="bad password 1")
        log_action(None, AuditLog.Action.LOGIN_FAILED, description="bad password 2")
        log_action(None, AuditLog.Action.LOCKOUT, description="locked")
        log_action(None, AuditLog.Action.LOGIN, description="not a security event")

    def resolve(self, **params):
        return get_resolver("integrity").resolve(user=self.admin, params=params)

    def test_chain_intact_and_events_counted(self):
        agg = self.resolve().aggregates
        self.assertEqual(agg["audit_chain_status"], "Intact")
        self.assertEqual(agg["audit_chain_breaks"], 0)
        self.assertGreaterEqual(agg["audit_rows_checked"], 4)
        self.assertGreaterEqual(agg["failed_logins"], 2)
        self.assertGreaterEqual(agg["lockouts"], 1)
        names = {e["name"] for e in agg["security_events"]}
        self.assertNotIn("Login", names)

    def test_tampering_is_reported(self):
        first = AuditLog.objects.order_by("id").first()
        AuditLog.objects.filter(pk=first.pk).update(description="rewritten after the fact")
        ds = self.resolve()
        self.assertEqual(ds.aggregates["audit_chain_status"], "BROKEN")
        self.assertGreaterEqual(ds.aggregates["audit_chain_breaks"], 1)
        self.assertIn("AUDIT CHAIN BROKEN", ds.meta["notes"][0])

    def test_privileged_accounts_and_two_factor_coverage(self):
        ds = self.resolve()
        usernames = [r["username"] for r in ds.rows]
        self.assertIn("ia_admin", usernames)
        self.assertNotIn("ia_officer", usernames)
        self.assertEqual(ds.aggregates["privileged_without_2fa"], len(ds.rows))
        Profile.objects.filter(user=self.admin).update(two_factor_enabled=True)
        row = {r["username"]: r for r in self.resolve().rows}["ia_admin"]
        self.assertEqual(row["two_factor"], "Yes")
        self.assertIn("PSC Administrator", row["privilege"])

    def test_period_filter(self):
        future = (timezone.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        far_future = (timezone.now() + timedelta(days=9)).strftime("%Y-%m-%d")
        agg = self.resolve(date_from=future, date_to=far_future).aggregates
        self.assertEqual(agg["failed_logins"], 0)

    def test_restricted_to_leadership_roles(self):
        resolver = get_resolver("integrity")
        self.assertTrue(resolver.authorize(self.admin))
        self.assertFalse(resolver.authorize(self.officer))
        with self.assertRaises(PermissionDenied):
            resolver.resolve(user=self.officer, params={})
        self.assertTrue(resolver.authorize(_user("ia_chair", Role.CHAIRPERSON)))


class RestrictedDomainAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = _user("rd_admin", Role.PSC_ADMIN)
        self.officer = _user("rd_officer", Role.PSC_OFFICER)
        rd = RoleDefinition.objects.create(role=Role.PSC_OFFICER)
        for code in ("view_reports", "export_reports"):
            rd.permissions.add(SystemPermission.objects.create(code=code, label=code))

    def test_domain_allows(self):
        self.assertTrue(domain_allows("integrity", self.admin))
        self.assertFalse(domain_allows("integrity", self.officer))
        self.assertTrue(domain_allows("pilot_adoption", self.officer))
        self.assertTrue(domain_allows("submissions", self.officer))

    def test_officer_cannot_generate_integrity_report(self):
        self.client.force_authenticate(self.officer)
        resp = self.client.post("/api/smart-reports/", {"template": "integrity_access_attestation"}, format="json")
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(SmartReport.objects.filter(domain="integrity").exists())

    def test_admin_can_queue_integrity_report(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post("/api/smart-reports/", {"template": "integrity_access_attestation"}, format="json")
        self.assertEqual(resp.status_code, 202)

    def test_officer_does_not_see_integrity_template(self):
        self.client.force_authenticate(self.officer)
        slugs = {t["slug"] for t in self.client.get("/api/report-templates/").data}
        self.assertNotIn("integrity_access_attestation", slugs)
        self.assertIn("stage_flow_bottlenecks", slugs)

    def test_report_admin_cannot_open_restricted_report_of_another_user(self):
        secret = SmartReport.objects.create(
            requested_by=self.admin, domain="integrity", report_type="integrity_access_attestation",
            status=SmartReport.Status.READY,
        )
        normal = SmartReport.objects.create(
            requested_by=self.admin, domain="submissions", report_type="adhoc", prompt="p",
            status=SmartReport.Status.READY,
        )
        self.client.force_authenticate(self.officer)  # holds export_reports → report admin
        self.assertEqual(self.client.get(f"/api/smart-reports/{secret.id}/").status_code, 403)
        self.assertEqual(self.client.get(f"/api/smart-reports/{normal.id}/").status_code, 200)
        listed = {r["id"] for r in self.client.get("/api/smart-reports/").data}
        self.assertIn(normal.id, listed)
        self.assertNotIn(secret.id, listed)

    def test_unknown_domain_rejected_on_template_save(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post("/api/report-templates/", {
            "name": "Bad domain", "domain": "payroll", "spec": {}, "param_schema": [],
        }, format="json")
        self.assertEqual(resp.status_code, 400)


class SeededTemplateRenderTests(TestCase):
    """Every seeded template resolves and renders its HTML fragments without Quarto."""

    def test_templates_render_fragments(self):
        admin = _user("rt_admin", Role.PSC_ADMIN)
        for slug in ("pilot_adoption_scorecard", "stage_flow_bottlenecks", "integrity_access_attestation"):
            tmpl = ReportTemplate.objects.get(slug=slug)
            spec = build_template_spec(tmpl, {})
            ds = get_resolver(spec["domain"]).resolve(user=admin, params=spec["params"])
            json.dumps(ds.to_payload(), default=str)  # data.json must serialise
            self.assertIn("kpi-card", rh.render_kpis(spec, ds.aggregates), slug)
            rh.render_highcharts(spec, ds.aggregates, "")
            table = rh.render_table(ds.rows, spec["table"]["columns"], spec["table"]["labels"])
            # With no matters waiting (empty demo DB) the table is a "no records" note.
            self.assertIn("<table" if ds.rows else "No records", table, slug)
            self.assertIn("<li>", rh.render_notes(ds.meta["notes"]), slug)
        self.assertEqual(rh.render_notes([]), "")
        self.assertIn("Why privileged", rh.render_table(
            [{"privilege": "x"}], ["privilege"], {"privilege": "Why privileged"}))

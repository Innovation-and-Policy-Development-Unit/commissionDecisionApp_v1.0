"""Tests for the Annual Report statistics chapter."""

from datetime import date, datetime, time
from unittest import skipUnless

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    AgendaItem,
    AnnualReport,
    CommissionTask,
    FormCategory,
    Meeting,
    Ministry,
    Profile,
    Role,
    Submission,
    WorkflowEvent,
    WorkflowStage,
)
from ..reports.annual_report import (
    build_annual_report_dataset,
    build_report_dataset,
    resolve_period,
)

try:
    import weasyprint  # noqa: F401
    HAS_WEASYPRINT = True
except Exception:
    HAS_WEASYPRINT = False

YEAR = 2024  # fixed past year — keeps fixtures clear of seeded demo data


def _aware(d):
    return timezone.make_aware(datetime.combine(d, time(hour=12)))


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class AnnualReportDatasetTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-Y", name="Test Ministry Y")
        self.form_cat = FormCategory.objects.get_or_create(
            code="psc_3_6", defaults={"name": "PSC 3.6"}
        )[0]
        self.secretary = User.objects.create_user("secretary", password="x")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)

    def _submission(self, received, stage=WorkflowStage.UNDER_ASSESSMENT, **kw):
        sub = Submission.objects.create(
            title=kw.pop("title", "Paper"),
            form_category=self.form_cat,
            form_type_code="PSC 3.6",
            agenda_category=kw.pop("agenda_category", "appointment"),
            ministry=self.ministry,
            received_at=_aware(received),
            created_by=self.secretary,
            current_stage=stage,
            **kw,
        )
        return sub

    def _decide(self, sub, decided_on, outcome="approved"):
        event = WorkflowEvent.objects.create(
            submission=sub, actor=self.secretary,
            previous_stage=WorkflowStage.COMMISSION_SITTING,
            new_stage=outcome,
        )
        WorkflowEvent.objects.filter(pk=event.pk).update(created_at=_aware(decided_on))

    def test_dataset_core_numbers(self):
        # Received in March and June of YEAR; one decided in-year (12 days),
        # one rejected; a third received the year before — excluded from intake
        # but its in-year decision still counts.
        s1 = self._submission(date(YEAR, 3, 10))
        self._decide(s1, date(YEAR, 3, 22), "approved")
        s2 = self._submission(date(YEAR, 6, 1))
        self._decide(s2, date(YEAR, 6, 11), "rejected")
        s3 = self._submission(date(YEAR - 1, 12, 20))
        self._decide(s3, date(YEAR, 1, 5), "approved")
        # Decision outside the year — ignored entirely.
        s4 = self._submission(date(YEAR, 8, 1))
        self._decide(s4, date(YEAR + 1, 2, 1), "approved")
        # Attachment — excluded from intake.
        self._submission(date(YEAR, 3, 12), is_attachment=True)

        Meeting.objects.create(
            title="Sitting 1", date=date(YEAR, 3, 20), time="09:00",
            venue="PSC", status="completed", type="ordinary",
        )
        Meeting.objects.create(
            title="Sitting 2", date=date(YEAR, 7, 20), time="09:00",
            venue="PSC", status="completed", type="special",
        )
        Meeting.objects.create(  # scheduled only — not counted
            title="Sitting 3", date=date(YEAR, 9, 20), time="09:00",
            venue="PSC", status="scheduled", type="ordinary",
        )

        CommissionTask.objects.create(
            title="Task", assigned_manager=self.secretary, created_by=self.secretary,
        )

        d = build_annual_report_dataset(YEAR)

        self.assertEqual(d["intake"]["total_received"], 3)  # s1, s2, s4
        march = next(m for m in d["intake"]["monthly"] if m["month"] == 3)
        self.assertEqual(march["count"], 1)

        self.assertEqual(d["sittings"]["total"], 2)

        self.assertEqual(d["decisions"]["total_decided"], 3)  # s1, s2, s3
        self.assertEqual(d["decisions"]["approved"], 2)
        self.assertEqual(d["decisions"]["rejected"], 1)
        self.assertEqual(d["decisions"]["approval_rate"], 67)

        # Days to decision: s1=12, s2=10, s3=16 → median 12.
        self.assertEqual(d["timeliness"]["median_days_to_decision"], 12)
        self.assertEqual(d["timeliness"]["decisions_measured"], 3)

        ministry_row = next(
            m for m in d["ministries"] if m["ministry"] == "Test Ministry Y"
        )
        self.assertEqual(ministry_row["received"], 3)
        self.assertEqual(ministry_row["decided"], 3)
        self.assertEqual(ministry_row["approved"], 2)

        # CommissionTask created now (current year) — not in YEAR.
        self.assertEqual(d["tasks"]["created"], 0)

    def test_first_decision_only_counted_once(self):
        sub = self._submission(date(YEAR, 2, 1))
        self._decide(sub, date(YEAR, 2, 10), "returned")
        self._decide(sub, date(YEAR, 5, 10), "approved")  # after resubmission
        d = build_annual_report_dataset(YEAR)
        self.assertEqual(d["decisions"]["total_decided"], 1)
        self.assertEqual(d["decisions"]["returned"], 1)
        self.assertEqual(d["decisions"]["approved"], 0)

    def _sitting_with_agenda(self, on, n_items, mtype="ordinary"):
        meeting = Meeting.objects.create(
            title=f"Sitting {on}", date=on, time="09:00",
            venue="PSC", status="completed", type=mtype,
        )
        for i in range(n_items):
            sub = self._submission(on, title=f"Item {on}-{i}")
            AgendaItem.objects.create(meeting=meeting, submission=sub, sequence=i)
        return meeting

    def test_agenda_load_per_sitting(self):
        self._sitting_with_agenda(date(YEAR, 3, 20), 3)
        self._sitting_with_agenda(date(YEAR, 7, 20), 5, mtype="special")

        d = build_annual_report_dataset(YEAR)
        s = d["sittings"]
        self.assertEqual(s["total"], 2)
        self.assertEqual(s["total_agenda_items"], 8)
        self.assertEqual(s["avg_agenda_per_sitting"], 4.0)
        self.assertEqual(len(s["detail"]), 2)
        self.assertEqual(s["detail"][0]["agenda_count"], 3)

    def test_quarterly_and_monthly_scope_intake(self):
        self._submission(date(YEAR, 2, 5))   # Q1 / Feb
        self._submission(date(YEAR, 5, 5))   # Q2 / May
        self._submission(date(YEAR, 5, 9))   # Q2 / May

        start, end, label, key = resolve_period("quarterly", year=YEAR, quarter=2)
        self.assertEqual(label, f"Q2 {YEAR}")
        self.assertEqual(key, f"{YEAR}-Q2")
        q2 = build_report_dataset(start, end, period={"type": "quarterly", "label": label, "key": key})
        self.assertEqual(q2["intake"]["total_received"], 2)
        self.assertEqual(q2["period"]["label"], f"Q2 {YEAR}")

        start, end, label, key = resolve_period("monthly", year=YEAR, month=2)
        self.assertEqual(key, f"{YEAR}-02")
        feb = build_report_dataset(start, end, period={"type": "monthly", "label": label, "key": key})
        self.assertEqual(feb["intake"]["total_received"], 1)

    def test_custom_range_and_include_filtering(self):
        self._submission(date(YEAR, 6, 15))
        start, end, label, key = resolve_period(
            "custom", date_from=f"{YEAR}-06-01", date_to=f"{YEAR}-06-30",
        )
        d = build_report_dataset(
            start, end, include=["intake"],
            period={"type": "custom", "label": label, "key": key},
        )
        self.assertEqual(d["intake"]["total_received"], 1)
        # Excluded sections are dropped from the payload.
        self.assertNotIn("decisions", d)
        self.assertNotIn("sittings", d)
        self.assertIn("period", d)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class AnnualReportAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.secretary = User.objects.create_user("secretary", password="x")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)
        self.officer = User.objects.create_user("officer", password="x")
        Profile.objects.create(user=self.officer, role=Role.PSC_OFFICER)

    def test_preview_rbac(self):
        self.client.force_authenticate(user=self.officer)
        self.assertEqual(
            self.client.get("/api/reports/annual/preview/", {"year": YEAR}).status_code,
            403,
        )
        self.client.force_authenticate(user=self.secretary)
        resp = self.client.get("/api/reports/annual/preview/", {"year": YEAR})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["year"], YEAR)

    def test_preview_quarterly_with_include(self):
        self.client.force_authenticate(user=self.secretary)
        resp = self.client.get("/api/reports/annual/preview/", {
            "period_type": "quarterly", "year": YEAR, "quarter": 2,
            "include": "intake,sittings",
        })
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["period"]["label"], f"Q2 {YEAR}")
        self.assertIn("intake", body)
        self.assertNotIn("decisions", body)

    @skipUnless(HAS_WEASYPRINT, "WeasyPrint not available")
    def test_generate_freezes_dataset_and_serves_pdf(self):
        self.client.force_authenticate(user=self.secretary)
        resp = self.client.post("/api/reports/annual/generate/", {"year": YEAR}, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        payload = resp.json()
        self.assertEqual(payload["year"], YEAR)
        self.assertTrue(payload["download_url"])

        report = AnnualReport.objects.get(pk=payload["id"])
        self.assertEqual(report.dataset["year"], YEAR)
        self.assertTrue(report.pdf_file)

        listing = self.client.get("/api/reports/annual/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.json()["reports"]), 1)

        download = self.client.get(f"/api/reports/annual/{report.id}/download/")
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download["Content-Type"], "application/pdf")

    def test_generate_rejects_bad_year_gracefully(self):
        self.client.force_authenticate(user=self.secretary)
        try:
            import weasyprint  # noqa: F401
        except Exception:
            self.skipTest("WeasyPrint not available")
        # Nonsense year falls back to the previous calendar year.
        resp = self.client.post("/api/reports/annual/generate/", {"year": "nonsense"}, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()["year"], timezone.localdate().year - 1)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class ReportAccessAndDeleteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.secretary = User.objects.create_user("rpt_sec", password="x")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)
        self.admin = User.objects.create_user("rpt_admin", password="x")
        Profile.objects.create(user=self.admin, role=Role.PSC_ADMIN)

    def _report(self, owner, label="Calendar year 2024"):
        return AnnualReport.objects.create(
            year=2024, period_type="annual",
            period_start=date(2024, 1, 1), period_end=date(2024, 12, 31),
            period_label=label, requested_by=owner,
        )

    def test_non_admin_sees_only_own_reports(self):
        self._report(self.secretary, "Mine")
        self._report(self.admin, "Theirs")
        self.client.force_authenticate(user=self.secretary)
        resp = self.client.get("/api/reports/annual/")
        labels = [r["period_label"] for r in resp.json()["reports"]]
        self.assertEqual(labels, ["Mine"])

    def test_admin_sees_all_reports_and_can_delete(self):
        self._report(self.secretary, "Mine")
        self._report(self.admin, "Theirs")
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/reports/annual/")
        rows = resp.json()["reports"]
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(r["can_delete"] for r in rows))

    def test_owner_can_delete_own_report(self):
        mine = self._report(self.secretary)
        self.client.force_authenticate(user=self.secretary)
        resp = self.client.delete(f"/api/reports/annual/{mine.id}/")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(AnnualReport.objects.filter(id=mine.id).exists())

    def test_non_owner_non_admin_cannot_delete(self):
        theirs = self._report(self.admin)
        self.client.force_authenticate(user=self.secretary)
        resp = self.client.delete(f"/api/reports/annual/{theirs.id}/")
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(AnnualReport.objects.filter(id=theirs.id).exists())

    def test_admin_can_delete_any_report(self):
        theirs = self._report(self.secretary)
        self.client.force_authenticate(user=self.admin)
        resp = self.client.delete(f"/api/reports/annual/{theirs.id}/")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(AnnualReport.objects.filter(id=theirs.id).exists())

    def test_user_without_report_access_denied(self):
        officer = User.objects.create_user("off", password="x")
        Profile.objects.create(user=officer, role=Role.PSC_OFFICER)
        rep = self._report(self.secretary)
        self.client.force_authenticate(user=officer)
        resp = self.client.delete(f"/api/reports/annual/{rep.id}/")
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(AnnualReport.objects.filter(id=rep.id).exists())

"""Tests for the Annual Report statistics chapter."""

from datetime import date, datetime, time
from unittest import skipUnless

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
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
from ..reports.annual_report import build_annual_report_dataset

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

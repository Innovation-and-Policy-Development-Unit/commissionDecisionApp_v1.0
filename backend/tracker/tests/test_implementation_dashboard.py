"""Tests for the decision implementation rollup (dashboard + milestones)."""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    FormCategory,
    ImplementationStatus,
    Ministry,
    Profile,
    Role,
    Submission,
    WorkflowStage,
)
from ..reports.implementation_rollup import (
    build_implementation_rollup,
    previous_quarter,
    quarter_bounds,
)


def _make_submission(ministry, user, form_cat, **overrides):
    defaults = dict(
        title="Decision",
        form_category=form_cat,
        form_type_code="PSC 3.6",
        ministry=ministry,
        received_at=timezone.now(),
        created_by=user,
        current_stage=WorkflowStage.UNDER_IMPLEMENTATION,
    )
    defaults.update(overrides)
    sub = Submission.objects.create(**defaults)
    return sub


def _force_timestamps(sub, approved_at=None, completed_at=None):
    """Set milestone timestamps directly (bypasses the auto-stamp signal)."""
    Submission.objects.filter(pk=sub.pk).update(
        commission_approved_at=approved_at,
        implementation_completed_at=completed_at,
    )
    sub.refresh_from_db()
    return sub


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class MilestoneStampTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("officer", password="x")
        Profile.objects.create(user=self.user, role=Role.PSC_OFFICER)
        # Codes must not collide with the ministries seeded by migration 0052.
        self.ministry = Ministry.objects.create(code="TST-A", name="Test Ministry A")
        self.form_cat = FormCategory.objects.get_or_create(
            code="psc_3_6", defaults={"name": "PSC 3.6"}
        )[0]

    def test_approved_stage_stamps_commission_approved_at(self):
        sub = _make_submission(
            self.ministry, self.user, self.form_cat,
            current_stage=WorkflowStage.UNDER_ASSESSMENT,
        )
        self.assertIsNone(sub.commission_approved_at)
        sub.current_stage = WorkflowStage.APPROVED
        sub.save(update_fields=["current_stage"])
        sub.refresh_from_db()
        self.assertIsNotNone(sub.commission_approved_at)

    def test_approved_stamp_is_first_arrival_only(self):
        sub = _make_submission(
            self.ministry, self.user, self.form_cat,
            current_stage=WorkflowStage.APPROVED,
        )
        sub.refresh_from_db()
        first = sub.commission_approved_at
        self.assertIsNotNone(first)
        sub.save()  # second save must not move the timestamp
        sub.refresh_from_db()
        self.assertEqual(sub.commission_approved_at, first)

    def test_implemented_status_stamps_completion(self):
        sub = _make_submission(self.ministry, self.user, self.form_cat)
        self.assertIsNone(sub.implementation_completed_at)
        sub.implementation_status = ImplementationStatus.IMPLEMENTED
        sub.save()
        sub.refresh_from_db()
        self.assertIsNotNone(sub.implementation_completed_at)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class RollupMathTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("officer", password="x")
        Profile.objects.create(user=self.user, role=Role.PSC_OFFICER)
        # Codes must not collide with the ministries seeded by migration 0052.
        self.health = Ministry.objects.create(code="TST-A", name="Test Ministry A")
        self.finance = Ministry.objects.create(code="TST-B", name="Test Ministry B")
        self.form_cat = FormCategory.objects.get_or_create(
            code="psc_3_6", defaults={"name": "PSC 3.6"}
        )[0]
        self.now = timezone.now()

    def test_rollup_buckets(self):
        # Health 1: implemented 10 days after approval — within default 30-day target.
        s1 = _make_submission(
            self.health, self.user, self.form_cat,
            implementation_status=ImplementationStatus.IMPLEMENTED,
        )
        _force_timestamps(
            s1,
            approved_at=self.now - timedelta(days=100),
            completed_at=self.now - timedelta(days=90),
        )
        # Health 2: approved 100 days ago, never implemented — overdue.
        s2 = _make_submission(self.health, self.user, self.form_cat)
        _force_timestamps(s2, approved_at=self.now - timedelta(days=100))
        # Finance 1: implemented 50 days after approval — late.
        s3 = _make_submission(
            self.finance, self.user, self.form_cat,
            implementation_status=ImplementationStatus.IMPLEMENTED,
        )
        _force_timestamps(
            s3,
            approved_at=self.now - timedelta(days=100),
            completed_at=self.now - timedelta(days=50),
        )
        # Finance 2: approved 5 days ago — still in progress, not overdue.
        s4 = _make_submission(self.finance, self.user, self.form_cat)
        _force_timestamps(s4, approved_at=self.now - timedelta(days=5))
        # Finance 3: explicit due date in the future — in progress even though
        # the default target would have lapsed.
        s5 = _make_submission(
            self.finance, self.user, self.form_cat,
            implementation_due_date=(self.now + timedelta(days=30)).date(),
        )
        _force_timestamps(s5, approved_at=self.now - timedelta(days=60))
        # Attachment: must be excluded entirely.
        s6 = _make_submission(
            self.health, self.user, self.form_cat, is_attachment=True,
        )
        _force_timestamps(s6, approved_at=self.now - timedelta(days=100))

        rollup = build_implementation_rollup()
        overall = rollup["overall"]

        self.assertEqual(overall["total"], 5)
        self.assertEqual(overall["implemented"], 2)
        self.assertEqual(overall["implemented_within_target"], 1)
        self.assertEqual(overall["implemented_late"], 1)
        self.assertEqual(overall["overdue"], 1)
        self.assertEqual(overall["in_progress"], 2)
        self.assertEqual(overall["pct_within_target"], 20)
        self.assertEqual(overall["explicit_target"], 1)

        by_ministry = {m["ministry_code"]: m for m in rollup["by_ministry"]}
        self.assertEqual(by_ministry["TST-A"]["total"], 2)
        self.assertEqual(by_ministry["TST-A"]["implemented_within_target"], 1)
        self.assertEqual(by_ministry["TST-A"]["overdue"], 1)
        self.assertEqual(by_ministry["TST-B"]["total"], 3)
        self.assertEqual(by_ministry["TST-B"]["implemented_late"], 1)
        self.assertEqual(by_ministry["TST-B"]["in_progress"], 2)

        # Worst-first ordering: TST-B (0% within target) before TST-A (50%).
        self.assertEqual(rollup["by_ministry"][0]["ministry_code"], "TST-B")

        # Overdue drill-down carries the reference and day count.
        self.assertEqual(len(rollup["top_overdue"]), 1)
        self.assertEqual(rollup["top_overdue"][0]["id"], s2.id)
        self.assertGreaterEqual(rollup["top_overdue"][0]["days_overdue"], 69)

    def test_date_window_filters_on_approval_date(self):
        s1 = _make_submission(self.health, self.user, self.form_cat)
        _force_timestamps(s1, approved_at=self.now - timedelta(days=400))
        s2 = _make_submission(self.health, self.user, self.form_cat)
        _force_timestamps(s2, approved_at=self.now - timedelta(days=10))

        window = build_implementation_rollup(
            date_from=(self.now - timedelta(days=30)).date()
        )
        self.assertEqual(window["overall"]["total"], 1)

    def test_quarter_helpers(self):
        from datetime import date

        self.assertEqual(quarter_bounds(2026, 1), (date(2026, 1, 1), date(2026, 3, 31)))
        self.assertEqual(quarter_bounds(2026, 4), (date(2026, 10, 1), date(2026, 12, 31)))
        self.assertEqual(previous_quarter(date(2026, 1, 15)), (2025, 4))
        self.assertEqual(previous_quarter(date(2026, 6, 11)), (2026, 1))


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class ImplementationDashboardAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Codes must not collide with the ministries seeded by migration 0052.
        self.health = Ministry.objects.create(code="TST-A", name="Test Ministry A")
        self.finance = Ministry.objects.create(code="TST-B", name="Test Ministry B")
        self.form_cat = FormCategory.objects.get_or_create(
            code="psc_3_6", defaults={"name": "PSC 3.6"}
        )[0]

        self.secretary = User.objects.create_user("secretary", password="x")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)
        self.ministry_hr = User.objects.create_user("hruser", password="x")
        Profile.objects.create(
            user=self.ministry_hr, role=Role.MINISTRY_HR, ministry=self.health,
        )
        self.traveller = User.objects.create_user("traveller", password="x")
        Profile.objects.create(user=self.traveller, role=Role.TRAVELLER)

        now = timezone.now()
        for ministry in (self.health, self.finance):
            sub = _make_submission(ministry, self.secretary, self.form_cat)
            _force_timestamps(sub, approved_at=now - timedelta(days=10))

    def test_secretary_sees_all_ministries(self):
        self.client.force_authenticate(user=self.secretary)
        resp = self.client.get("/api/analytics/implementation/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["overall"]["total"], 2)
        self.assertEqual(len(data["by_ministry"]), 2)

    def test_ministry_user_scoped_to_own_ministry(self):
        self.client.force_authenticate(user=self.ministry_hr)
        # Even if they ask for another ministry, the scope is forced.
        resp = self.client.get("/api/analytics/implementation/", {"ministry": self.finance.id})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["overall"]["total"], 1)
        self.assertEqual(data["by_ministry"][0]["ministry_code"], "TST-A")

    def test_unrelated_role_denied(self):
        self.client.force_authenticate(user=self.traveller)
        resp = self.client.get("/api/analytics/implementation/")
        self.assertEqual(resp.status_code, 403)

    def test_report_generate_requires_secretariat(self):
        self.client.force_authenticate(user=self.ministry_hr)
        resp = self.client.post("/api/analytics/implementation/reports/generate/", {})
        self.assertEqual(resp.status_code, 403)

    def test_report_generate_and_list(self):
        try:
            import weasyprint  # noqa: F401
        except Exception:
            self.skipTest("WeasyPrint not available in this environment.")
        self.client.force_authenticate(user=self.secretary)
        resp = self.client.post(
            "/api/analytics/implementation/reports/generate/",
            {"year": 2026, "quarter": 1},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        payload = resp.json()
        self.assertEqual(payload["label"], "Q1 2026")
        self.assertTrue(payload["download_url"])

        listing = self.client.get("/api/analytics/implementation/reports/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.json()["reports"]), 1)

        download = self.client.get(
            f"/api/analytics/implementation/reports/{payload['id']}/download/"
        )
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download["Content-Type"], "application/pdf")

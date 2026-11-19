"""Security scan: the shared runner, the administrator's button, and the weekly schedule."""
import json
from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tracker.models import Profile, Role, SecurityScan


def _fake_run(dep_vulns=0, issues=(), fail_dep=False):
    def run(cmd, **kw):
        if "pip_audit" in cmd:
            if fail_dep:
                return mock.Mock(returncode=1, stdout="", stderr="could not reach the vulnerability database")
            return mock.Mock(returncode=0, stderr="", stdout=json.dumps(
                {"dependencies": [{"name": "x", "version": "1", "vulns": [{"id": f"V{i}"} for i in range(dep_vulns)]}]}))
        return mock.Mock(returncode=0, stderr="", stdout=json.dumps({"results": list(issues), "metrics": {}}))
    return run


class RunnerTests(TestCase):
    def test_scheduled_style_run_has_no_actor_and_counts_findings(self):
        from tracker.security_scan import run_security_scan
        issues = [{"issue_severity": "HIGH"}, {"issue_severity": "LOW"}, {"issue_severity": "LOW"}]
        with mock.patch("tracker.security_scan.subprocess.run", side_effect=_fake_run(2, issues)):
            scan = run_security_scan("full")
        self.assertEqual(scan.status, "completed")
        self.assertIsNone(scan.triggered_by)
        self.assertEqual(scan.summary["dependency_vulnerabilities"], 2)
        self.assertEqual((scan.summary["sast_high"], scan.summary["sast_low"]), (1, 2))

    def test_failed_dependency_check_is_recorded_not_raised(self):
        from tracker.security_scan import run_security_scan
        with mock.patch("tracker.security_scan.subprocess.run", side_effect=_fake_run(fail_dep=True)):
            scan = run_security_scan("full")
        self.assertEqual(scan.status, "failed")
        self.assertIn("vulnerability database", scan.error_message)

    def test_unknown_scan_type_falls_back_to_full(self):
        from tracker.security_scan import run_security_scan
        with mock.patch("tracker.security_scan.subprocess.run", side_effect=_fake_run()):
            self.assertEqual(run_security_scan("nonsense").scan_type, "full")

    def test_scheduled_task_never_raises(self):
        from tracker.tasks import run_scheduled_security_scan
        with mock.patch("tracker.security_scan.run_security_scan", side_effect=RuntimeError("boom")):
            run_scheduled_security_scan()  # must not raise
        with mock.patch("tracker.security_scan.subprocess.run", side_effect=_fake_run()):
            run_scheduled_security_scan()
        self.assertEqual(SecurityScan.objects.count(), 1)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class ButtonAndScheduleTests(TestCase):
    def test_admin_button_still_works_and_records_the_user(self):
        admin = User.objects.create_user("scan_admin", password="x", is_staff=True)
        Profile.objects.create(user=admin, role=Role.PSC_ADMIN)
        c = APIClient(); c.force_authenticate(user=admin)
        with mock.patch("tracker.security_scan.subprocess.run", side_effect=_fake_run(1)):
            res = c.post("/api/security-scans/run/", {"scan_type": "dependency"}, format="json")
        self.assertEqual(res.status_code, 201)
        scan = SecurityScan.objects.get()
        self.assertEqual(scan.triggered_by_id, admin.id)
        self.assertEqual(scan.scan_type, "dependency")

    def test_weekly_task_is_registered_sunday_3am_vanuatu(self):
        from django_celery_beat.models import PeriodicTask
        t = PeriodicTask.objects.get(name="weekly-security-scan")
        self.assertTrue(t.enabled)
        self.assertEqual(t.task, "tracker.tasks.run_scheduled_security_scan")
        self.assertEqual((t.crontab.hour, t.crontab.minute, t.crontab.day_of_week), ("3", "0", "0"))
        self.assertEqual(str(t.crontab.timezone), "Pacific/Efate")

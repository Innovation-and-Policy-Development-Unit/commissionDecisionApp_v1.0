import tempfile
from io import StringIO
from pathlib import Path
from unittest import mock

from django.contrib.auth.models import User
from django.core import mail
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from ..models import Department, Ministry, Role, Unit

HEADER = "first_name,last_name,email,role,ministry,department,unit,is_active\n"
ROW_A = "Christina,Thyna,cthyna@psc.gov.vu,Compliance Manager,Ministry of the Prime Minister,Office of the Public Service Commission,Compliance Unit,TRUE\n"
ROW_B = "Jack,Philip,jnphilip@psc.gov.vu,Manager HRMIS (Read-Only Reviewer),Ministry of the Prime Minister,Office of the Public Service Commission,,TRUE\n"
PASSWORD = "Temp-Pass-1"


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class ImportUsersTests(TestCase):
    def setUp(self):
        ministry = Ministry.objects.create(code="OPM", name="Ministry of the Prime Minister")
        dept = Department.objects.create(ministry=ministry, code="OPSC", name="Office of the Public Service Commission")
        Unit.objects.create(department=dept, code="COMPLIANCE", name="Compliance Unit")
        patcher = mock.patch("tracker.management.commands.import_users.time.sleep")
        patcher.start()
        self.addCleanup(patcher.stop)

    def _run(self, body, *flags):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "users.csv"
            path.write_text(body, encoding="utf-8")
            out = StringIO()
            call_command("import_users", str(path), "--password", PASSWORD, *flags, stdout=out, stderr=StringIO())
        return out.getvalue()

    def test_dry_run_writes_and_sends_nothing(self):
        self._run(HEADER + ROW_A, "--dry-run", "--send-emails")
        self.assertFalse(User.objects.filter(username="cthyna").exists())
        self.assertEqual(len(mail.outbox), 0)

    def test_creates_users_with_profile_and_forced_password_change(self):
        self._run(HEADER + ROW_A + ROW_B)
        user = User.objects.get(username="cthyna")
        self.assertTrue(user.check_password(PASSWORD))
        self.assertEqual((user.first_name, user.last_name), ("Christina", "Thyna"))
        self.assertEqual(user.psc_profile.role, Role.COMPLIANCE_MANAGER)
        self.assertEqual(user.psc_profile.unit.name, "Compliance Unit")
        self.assertTrue(user.psc_profile.force_password_change)
        reviewer = User.objects.get(username="jnphilip").psc_profile
        self.assertEqual(reviewer.role, Role.HRMIS_REVIEWER)
        self.assertIsNone(reviewer.unit)
        self.assertEqual(len(mail.outbox), 0)

    def test_send_emails_mails_each_new_user_with_username_and_password(self):
        self._run(HEADER + ROW_A + ROW_B, "--send-emails")
        self.assertEqual(sorted(m.to[0] for m in mail.outbox), ["cthyna@psc.gov.vu", "jnphilip@psc.gov.vu"])
        body = mail.outbox[0].body
        self.assertIn(PASSWORD, body)
        self.assertIn("cthyna", body + mail.outbox[0].subject)

    def test_bad_row_aborts_everything(self):
        bad = ROW_B.replace("Manager HRMIS (Read-Only Reviewer)", "Grand Vizier")
        with self.assertRaises(CommandError):
            self._run(HEADER + ROW_A + bad)
        self.assertEqual(User.objects.count(), 0)

    def test_unknown_unit_is_rejected(self):
        with self.assertRaises(CommandError):
            self._run(HEADER + ROW_A.replace("Compliance Unit", "Nonexistent Unit"))
        self.assertEqual(User.objects.count(), 0)

    def test_rerun_skips_existing_then_emails_them_in_second_pass(self):
        self._run(HEADER + ROW_A)
        self.assertEqual(User.objects.count(), 1)
        self._run(HEADER + ROW_A, "--send-emails")  # phase 2: mail without recreating
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(len(mail.outbox), 1)

    def test_existing_user_who_changed_password_is_not_emailed(self):
        self._run(HEADER + ROW_A)
        profile = User.objects.get(username="cthyna").psc_profile
        profile.force_password_change = False
        profile.save()
        self._run(HEADER + ROW_A, "--send-emails")
        self.assertEqual(len(mail.outbox), 0)

    def test_only_restricts_the_run(self):
        self._run(HEADER + ROW_A + ROW_B, "--only", "cthyna")
        self.assertEqual(list(User.objects.values_list("username", flat=True)), ["cthyna"])

    def test_duplicate_username_in_file_is_rejected(self):
        with self.assertRaises(CommandError):
            self._run(HEADER + ROW_A + ROW_A)

    def test_inactive_user_is_created_inactive_and_not_emailed(self):
        self._run(HEADER + ROW_A.replace("TRUE", "FALSE"), "--send-emails")
        self.assertFalse(User.objects.get(username="cthyna").is_active)
        self.assertEqual(len(mail.outbox), 0)

"""
After HR sends a paper to the DG: a reminder at day 3, a notice to HR when the link
dies, the public tracking label, and the approval line on the printed summary.
"""
import re
from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from django.template.loader import render_to_string
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker import dg_approval
from tracker.models import (
    DGApprovalToken, Department, Ministry, Notification, Profile, Role, Submission,
    SystemSetting, WorkflowStage,
)
from tracker.tasks import send_dg_approval_follow_ups

PIN = "4821"


@override_settings(
    SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"],
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class DGFollowUpTests(TestCase):
    def setUp(self):
        cache.clear()
        SystemSetting.objects.create(key="DG_EMAIL_APPROVAL_ENABLED", value="true")
        self.ministry = Ministry.objects.create(code="ZZ_DGF", name="DG Follow-up Ministry")
        self.hr = User.objects.create_user("dgf_hr", password="x", email="hr@ministry.gov.vu", first_name="Hana")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.dg = User.objects.create_user("dgf_dg", password="x", email="dg@ministry.gov.vu",
                                           first_name="Daniel", last_name="Garae")
        Profile.objects.create(user=self.dg, role=Role.HEAD_OF_AGENCY, ministry=self.ministry,
                               session_pin=make_password(PIN))
        self.sub = Submission.objects.create(
            title="Establishment of a new post", ministry=self.ministry,
            form_type_code="TEST-NONE-XYZ", current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(), created_by=self.hr,
        )
        self.hr_client = APIClient()
        self.hr_client.force_authenticate(user=self.hr)
        self.public = APIClient()

    def _send(self):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.hr_client.post(
                f"/api/submissions/{self.sub.id}/transition/",
                {"new_stage": "pending_dg_endorsement"}, format="json",
            )
        self.assertEqual(res.status_code, 200, res.content)
        self.sub.refresh_from_db()

    def _age(self, days):
        DGApprovalToken.objects.update(created_at=timezone.now() - timedelta(days=days))

    def _links_to_dg(self):
        return [m for m in mail.outbox if m.to == ["dg@ministry.gov.vu"]]

    # ── reminder at day 3 ────────────────────────────────────────────────────
    def test_no_reminder_before_day_three(self):
        self._send()
        self._age(2)
        self.assertEqual(dg_approval.run_follow_ups(), {"reminded": 0, "expired": 0})
        self.assertEqual(len(self._links_to_dg()), 1)

    def test_a_waiting_dg_gets_one_reminder_with_a_fresh_link(self):
        self._send()
        first = re.search(r"/dg-approval/([\w-]+)", self._links_to_dg()[0].body).group(1)
        self._age(4)
        self.assertEqual(dg_approval.run_follow_ups()["reminded"], 1)
        msgs = self._links_to_dg()
        self.assertEqual(len(msgs), 2)
        self.assertIn("Reminder", msgs[1].body)
        second = re.search(r"/dg-approval/([\w-]+)", msgs[1].body).group(1)
        self.assertNotEqual(first, second)
        self.assertEqual(self.public.get(f"/api/dg-approval/{first}/").status_code, 404)
        self.assertEqual(self.public.get(f"/api/dg-approval/{second}/").status_code, 200)

    def test_the_dg_is_reminded_only_once(self):
        self._send()
        self._age(4)
        dg_approval.run_follow_ups()
        self._age(4)
        self.assertEqual(dg_approval.run_follow_ups()["reminded"], 0)
        self.assertEqual(len(self._links_to_dg()), 2)

    def test_no_reminder_once_the_paper_has_moved_on(self):
        self._send()
        self._age(4)
        Submission.objects.filter(pk=self.sub.pk).update(current_stage=WorkflowStage.DRAFT)
        self.assertEqual(dg_approval.run_follow_ups()["reminded"], 0)

    # ── a dead link: tell HR once ────────────────────────────────────────────
    def test_hr_is_told_when_the_link_expires(self):
        self._send()
        DGApprovalToken.objects.update(expires_at=timezone.now() - timedelta(hours=1))
        self.assertEqual(dg_approval.run_follow_ups()["expired"], 1)
        notice = [m for m in mail.outbox if m.to == ["hr@ministry.gov.vu"] and "Resend" in m.subject]
        self.assertEqual(len(notice), 1)
        self.assertIn("has expired", notice[0].body)
        self.assertIn("Daniel Garae", notice[0].body)
        self.assertTrue(Notification.objects.filter(
            recipient=self.hr, submission=self.sub, title__contains="needs resending").exists())

    def test_hr_is_told_only_once(self):
        self._send()
        DGApprovalToken.objects.update(expires_at=timezone.now() - timedelta(hours=1))
        dg_approval.run_follow_ups()
        self.assertEqual(dg_approval.run_follow_ups()["expired"], 0)
        self.assertEqual(len([m for m in mail.outbox if "Resend" in m.subject]), 1)

    def test_no_notice_for_a_link_that_was_replaced(self):
        self._send()
        DGApprovalToken.objects.update(created_at=timezone.now() - timedelta(minutes=10))
        self.hr_client.post(f"/api/submissions/{self.sub.id}/resend-dg-link/")
        DGApprovalToken.objects.filter(cancelled_at__isnull=False).update(
            expires_at=timezone.now() - timedelta(hours=1))
        self.assertEqual(dg_approval.run_follow_ups()["expired"], 0)

    def test_hr_is_told_when_wrong_pins_lock_the_link(self):
        self._send()
        token = re.search(r"/dg-approval/([\w-]+)", self._links_to_dg()[0].body).group(1)
        for _ in range(dg_approval.MAX_PIN_ATTEMPTS):
            self.public.post(f"/api/dg-approval/{token}/decide/",
                             {"decision": "approve", "pin": "0000"}, format="json")
        notice = [m for m in mail.outbox if m.to == ["hr@ministry.gov.vu"] and "Resend" in m.subject]
        self.assertEqual(len(notice), 1)
        self.assertIn("too many wrong PINs", notice[0].body)
        # ...and the daily job does not tell them a second time.
        self.assertEqual(dg_approval.run_follow_ups()["expired"], 0)

    def test_the_daily_task_does_nothing_while_the_switch_is_off(self):
        self._send()
        self._age(4)
        SystemSetting.objects.filter(key="DG_EMAIL_APPROVAL_ENABLED").update(value="false")
        self.assertEqual(send_dg_approval_follow_ups()["skipped"], "switch off")
        self.assertEqual(len(self._links_to_dg()), 1)

    def test_the_daily_task_runs_the_follow_ups(self):
        self._send()
        self._age(4)
        self.assertEqual(send_dg_approval_follow_ups()["reminded"], 1)

    # ── the DG sees it in-app even if their account carries a department ─────
    def test_a_dg_account_with_a_department_still_gets_the_in_app_notice(self):
        dept = Department.objects.create(ministry=self.ministry, code="D1", name="Some department")
        Profile.objects.filter(user=self.dg).update(department=dept)
        self._send()
        self.assertTrue(Notification.objects.filter(recipient=self.dg, submission=self.sub).exists())

    # ── public tracking label ────────────────────────────────────────────────
    def test_tracking_says_awaiting_ministry_approval_while_with_the_dg(self):
        self._send()
        res = self.public.get(f"/api/track/{self.sub.applicant_tracking_code}/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data["current_stage_label"], "Awaiting ministry approval")
        self.assertIsNone(res.data["milestone_index"])

    # ── approval line on the printed summary ─────────────────────────────────
    def _approve(self):
        self._send()
        token = re.search(r"/dg-approval/([\w-]+)", self._links_to_dg()[0].body).group(1)
        res = self.public.post(f"/api/dg-approval/{token}/decide/",
                               {"decision": "approve", "pin": PIN}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.sub.refresh_from_db()

    def test_an_emailed_approval_is_stated_on_the_print(self):
        self._approve()
        line = dg_approval.approval_statement(self.sub)
        self.assertIn("Approved electronically by Daniel Garae", line)
        self.assertIn("DG Follow-up Ministry", line)
        self.assertIn("emailed link", line)
        self.assertIn("no handwritten signature", line)

    def test_the_summary_template_prints_the_approval_line(self):
        self._approve()
        html = render_to_string("tracker/submission_detail_pdf.html", {
            "submission": self.sub, "form_type_name": "", "stage_label": "Submitted",
            "classification_label": "Normal", "checklist": [], "documents": [],
            "board_paper": None, "reviewer_content": None,
            "dg_approval_statement": dg_approval.approval_statement(self.sub),
            "generated_at": timezone.now(), "generated_by": "Tester",
        })
        self.assertIn("Director-General approval", html)
        self.assertIn("Approved electronically by Daniel Garae", html)

    def test_a_paper_without_an_approval_prints_no_line(self):
        self.assertEqual(dg_approval.approval_statement(self.sub), "")
        html = render_to_string("tracker/submission_detail_pdf.html", {
            "submission": self.sub, "checklist": [], "documents": [], "dg_approval_statement": "",
            "generated_at": timezone.now(), "generated_by": "Tester",
        })
        self.assertNotIn("Director-General approval", html)

    def test_a_paper_approval_prints_as_attested_by_hr(self):
        res = self.hr_client.post(
            f"/api/submissions/{self.sub.id}/transition/",
            {"new_stage": "submitted", "dg_approval_name": "Mr. John Kalo",
             "dg_approval_date": timezone.localdate().isoformat()}, format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.dg_approval_method, "paper")
        line = dg_approval.approval_statement(self.sub)
        self.assertIn("Mr. John Kalo, signed on paper", line)
        self.assertNotIn("electronically", line)

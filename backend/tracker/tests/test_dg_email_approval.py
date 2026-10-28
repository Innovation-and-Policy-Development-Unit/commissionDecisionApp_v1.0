"""
Director-General approval by emailed link: HR sends the paper, the DG gets a
single-use link, opens a public page, confirms with their session PIN and approves
(the paper goes to PSC) or returns it to HR.
"""
import re
import shutil
import tempfile
from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import (
    DGApprovalToken, Ministry, Notification, Profile, PSCFormType, RequiredDocument, Role,
    Submission, SubmissionChecklistItem, SubmissionDocument, SystemSetting, WorkflowStage,
)

PIN = "4821"
MEDIA = tempfile.mkdtemp(prefix="dg-approval-media-")


@override_settings(
    SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"], MEDIA_ROOT=MEDIA,
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class DGEmailApprovalTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()  # the public pages are throttled per IP; keep tests independent
        SystemSetting.objects.create(key="DG_EMAIL_APPROVAL_ENABLED", value="true")
        self.ministry = Ministry.objects.create(code="ZZ_DGA", name="DG Approval Ministry")
        self.hr = User.objects.create_user("dga_hr", password="x", email="hr@ministry.gov.vu",
                                           first_name="Hana", last_name="Roro")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.dg = User.objects.create_user("dga_dg", password="x", email="dg@ministry.gov.vu",
                                           first_name="Daniel", last_name="Garae")
        Profile.objects.create(
            user=self.dg, role=Role.HEAD_OF_AGENCY, ministry=self.ministry,
            session_pin=make_password(PIN),
        )
        self.sub = Submission.objects.create(
            title="Establishment of a new post", ministry=self.ministry,
            form_type_code="TEST-NONE-XYZ", current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(), created_by=self.hr,
        )
        self.hr_client = self._client(self.hr)
        self.public = APIClient()

    def _client(self, user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    def _send_to_dg(self):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.hr_client.post(
                f"/api/submissions/{self.sub.id}/transition/",
                {"new_stage": "pending_dg_endorsement"}, format="json",
            )
        self.assertEqual(res.status_code, 200, res.content)
        self.sub.refresh_from_db()
        return res

    def _raw_token(self):
        msg = [m for m in mail.outbox if "approval is needed" in m.subject][-1]
        return re.search(r"/dg-approval/([\w-]+)", msg.body).group(1)

    def _decide(self, token, **body):
        return self.public.post(f"/api/dg-approval/{token}/decide/", body, format="json")

    # ── sending ──────────────────────────────────────────────────────────────
    def test_send_to_dg_locks_the_paper_and_emails_the_dg_a_link(self):
        self._send_to_dg()
        self.assertEqual(self.sub.current_stage, WorkflowStage.PENDING_DG_ENDORSEMENT)
        self.assertEqual(DGApprovalToken.objects.filter(submission=self.sub).count(), 1)
        msgs = [m for m in mail.outbox if "approval is needed" in m.subject]
        self.assertEqual(len(msgs), 1)
        self.assertEqual(msgs[0].to, ["dg@ministry.gov.vu"])
        self.assertIn("/dg-approval/", msgs[0].body)
        self.assertIn(self.sub.reference_number, msgs[0].subject)

    def test_the_dg_gets_one_email_not_two(self):
        self._send_to_dg()
        to_dg = [m for m in mail.outbox if "dg@ministry.gov.vu" in m.to]
        self.assertEqual(len(to_dg), 1)

    def test_the_dg_also_sees_it_in_app(self):
        self._send_to_dg()
        self.assertTrue(Notification.objects.filter(recipient=self.dg, submission=self.sub).exists())

    def test_the_token_is_stored_hashed(self):
        self._send_to_dg()
        raw = self._raw_token()
        row = DGApprovalToken.objects.get()
        self.assertNotEqual(row.token_hash, raw)
        self.assertEqual(len(row.token_hash), 64)

    def test_hr_cannot_edit_the_paper_while_it_waits_for_the_dg(self):
        self._send_to_dg()
        res = self.hr_client.patch(f"/api/submissions/{self.sub.id}/", {"title": "Changed"}, format="json")
        self.assertIn(res.status_code, (400, 403), res.content)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.title, "Establishment of a new post")

    # ── the public page ──────────────────────────────────────────────────────
    def test_summary_needs_no_login_and_shows_the_paper(self):
        self._send_to_dg()
        res = self.public.get(f"/api/dg-approval/{self._raw_token()}/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data["reference_number"], self.sub.reference_number)
        self.assertEqual(res.data["title"], "Establishment of a new post")
        self.assertEqual(res.data["ministry"], "DG Approval Ministry")
        self.assertEqual(res.data["prepared_by"], "Hana Roro")
        self.assertEqual(res.data["dg_name"], "Daniel Garae")
        self.assertTrue(res.data["pin_required"])
        self.assertTrue(res.data["has_pin"])

    def test_pages_are_never_cached_or_indexed(self):
        self._send_to_dg()
        res = self.public.get(f"/api/dg-approval/{self._raw_token()}/")
        self.assertEqual(res["Cache-Control"], "no-store")
        self.assertEqual(res["Referrer-Policy"], "no-referrer")
        self.assertIn("noindex", res["X-Robots-Tag"])

    def test_opening_the_link_does_not_approve_anything(self):
        self._send_to_dg()
        token = self._raw_token()
        for _ in range(3):
            self.public.get(f"/api/dg-approval/{token}/")
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.PENDING_DG_ENDORSEMENT)
        self.assertTrue(DGApprovalToken.objects.get().is_active())

    def test_the_public_pages_are_throttled_per_ip(self):
        codes = [self.public.get(f"/api/dg-approval/guess-{i}/").status_code for i in range(40)]
        self.assertEqual(set(codes), {404, 429})
        self.assertEqual(codes[0], 404)
        self.assertEqual(codes[-1], 429)

    def test_an_unknown_token_is_a_plain_404(self):
        self.assertEqual(self.public.get("/api/dg-approval/not-a-real-token/").status_code, 404)
        res = self._decide("not-a-real-token", decision="approve", pin=PIN)
        self.assertEqual(res.status_code, 404)

    def test_an_expired_token_is_a_404(self):
        self._send_to_dg()
        DGApprovalToken.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
        token = self._raw_token()
        self.assertEqual(self.public.get(f"/api/dg-approval/{token}/").status_code, 404)
        self.assertEqual(self._decide(token, decision="approve", pin=PIN).status_code, 404)

    # ── approving ────────────────────────────────────────────────────────────
    def test_approving_with_the_pin_sends_the_paper_to_psc(self):
        self._send_to_dg()
        res = self._decide(self._raw_token(), decision="approve", pin=PIN)
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data["outcome"], "approved")
        self.sub.refresh_from_db()
        self.assertNotIn(
            self.sub.current_stage,
            {WorkflowStage.PENDING_DG_ENDORSEMENT, WorkflowStage.DG_APPROVED, WorkflowStage.DRAFT},
        )
        self.assertEqual(self.sub.dg_endorsed_by, self.dg)
        self.assertIsNotNone(self.sub.dg_endorsed_at)
        self.assertEqual(self.sub.dg_approval_method, "email_link")
        self.assertEqual(self.sub.dg_approval_name, "Daniel Garae")
        row = DGApprovalToken.objects.get()
        self.assertIsNotNone(row.used_at)
        self.assertEqual(row.outcome, "approved")
        events = list(self.sub.events.order_by("id").values_list("previous_stage", "new_stage", "actor__username"))
        self.assertIn(("pending_dg_endorsement", "dg_approved", "dga_dg"), events)

    def test_the_link_works_only_once(self):
        self._send_to_dg()
        token = self._raw_token()
        self.assertEqual(self._decide(token, decision="approve", pin=PIN).status_code, 200)
        self.assertEqual(self._decide(token, decision="approve", pin=PIN).status_code, 404)
        self.assertEqual(self.public.get(f"/api/dg-approval/{token}/").status_code, 404)

    def test_approval_is_written_to_the_audit_log(self):
        from tracker.models import AuditLog

        self._send_to_dg()
        self._decide(self._raw_token(), decision="approve", pin=PIN)
        self.assertTrue(AuditLog.objects.filter(
            resource_type="Submission", resource_id=str(self.sub.id),
            description__contains="DG endorsed and auto-submitted to PSC (email_link)",
        ).exists())

    def test_a_wrong_pin_does_not_approve(self):
        self._send_to_dg()
        res = self._decide(self._raw_token(), decision="approve", pin="0000")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["code"], "wrong_pin")
        self.assertEqual(res.data["attempts_left"], 4)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.PENDING_DG_ENDORSEMENT)

    def test_five_wrong_pins_cancel_the_link(self):
        self._send_to_dg()
        token = self._raw_token()
        codes = [self._decide(token, decision="approve", pin="0000").data["code"] for _ in range(5)]
        self.assertEqual(codes[-1], "locked")
        self.assertEqual(self._decide(token, decision="approve", pin=PIN).status_code, 404)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.PENDING_DG_ENDORSEMENT)

    def test_a_dg_who_never_set_a_pin_is_told_to_sign_in_once(self):
        Profile.objects.filter(user=self.dg).update(session_pin=None)
        self._send_to_dg()
        res = self._decide(self._raw_token(), decision="approve", pin="1234")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["code"], "no_pin")

    def test_the_pin_requirement_can_be_switched_off(self):
        SystemSetting.objects.create(key="DG_APPROVAL_REQUIRE_PIN", value="false")
        self._send_to_dg()
        res = self._decide(self._raw_token(), decision="approve")
        self.assertEqual(res.status_code, 200, res.content)

    def test_a_decision_must_be_approve_or_return(self):
        self._send_to_dg()
        self.assertEqual(self._decide(self._raw_token(), decision="maybe", pin=PIN).status_code, 400)

    # ── returning ────────────────────────────────────────────────────────────
    def test_returning_needs_a_comment(self):
        self._send_to_dg()
        res = self._decide(self._raw_token(), decision="return", pin=PIN)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["code"], "remarks_required")

    def test_returning_needs_the_pin_too(self):
        self._send_to_dg()
        token = self._raw_token()
        wrong = self._decide(token, decision="return", pin="0000", remarks="Fix the costs.")
        self.assertEqual(wrong.status_code, 400)
        self.assertEqual(wrong.data["code"], "wrong_pin")
        missing = self._decide(token, decision="return", remarks="Fix the costs.")
        self.assertEqual(missing.status_code, 400)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.PENDING_DG_ENDORSEMENT)
        self.assertIsNone(DGApprovalToken.objects.get().used_at)

    def test_returning_sends_the_paper_back_to_hr_as_a_draft(self):
        self._send_to_dg()
        res = self._decide(self._raw_token(), decision="return", pin=PIN, remarks="Cost table is missing.")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data["outcome"], "returned")
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.DRAFT)
        event = self.sub.events.order_by("-id").first()
        self.assertEqual(event.new_stage, WorkflowStage.DRAFT)
        self.assertEqual(event.remarks, "Cost table is missing.")
        self.assertTrue(Notification.objects.filter(recipient=self.hr, submission=self.sub).exists())
        self.assertEqual(DGApprovalToken.objects.get().outcome, "returned")

    def test_hr_can_send_it_again_after_it_is_returned(self):
        self._send_to_dg()
        self._decide(self._raw_token(), decision="return", pin=PIN, remarks="Fix the costs.")
        self._send_to_dg()
        self.assertEqual(self.sub.current_stage, WorkflowStage.PENDING_DG_ENDORSEMENT)
        self.assertEqual(DGApprovalToken.objects.filter(submission=self.sub, used_at__isnull=True,
                                                         cancelled_at__isnull=True).count(), 1)

    # ── resend / recall / in-app ─────────────────────────────────────────────
    def test_resend_replaces_the_old_link(self):
        self._send_to_dg()
        old = self._raw_token()
        DGApprovalToken.objects.update(created_at=timezone.now() - timedelta(minutes=10))
        res = self.hr_client.post(f"/api/submissions/{self.sub.id}/resend-dg-link/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(res.data["sent"])
        new = self._raw_token()
        self.assertNotEqual(old, new)
        self.assertEqual(self.public.get(f"/api/dg-approval/{old}/").status_code, 404)
        self.assertEqual(self.public.get(f"/api/dg-approval/{new}/").status_code, 200)

    def test_resend_is_rate_limited(self):
        self._send_to_dg()
        res = self.hr_client.post(f"/api/submissions/{self.sub.id}/resend-dg-link/")
        self.assertEqual(res.status_code, 429)

    def test_only_hr_can_resend(self):
        self._send_to_dg()
        DGApprovalToken.objects.update(created_at=timezone.now() - timedelta(minutes=10))
        res = self._client(self.dg).post(f"/api/submissions/{self.sub.id}/resend-dg-link/")
        self.assertEqual(res.status_code, 403)

    def test_recalling_the_paper_kills_the_link(self):
        self._send_to_dg()
        token = self._raw_token()
        res = self.hr_client.post(
            f"/api/submissions/{self.sub.id}/transition/",
            {"new_stage": "recalled", "remarks": "Sent by mistake."}, format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(self.public.get(f"/api/dg-approval/{token}/").status_code, 404)
        self.assertFalse(DGApprovalToken.objects.get().is_active())

    def test_the_dg_can_still_approve_by_signing_in(self):
        self._send_to_dg()
        token = self._raw_token()
        res = self._client(self.dg).post(f"/api/submissions/{self.sub.id}/endorse/")
        self.assertEqual(res.status_code, 200, res.content)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.dg_approval_method, "in_app")
        self.assertEqual(self.sub.dg_endorsed_by, self.dg)
        self.assertEqual(self.public.get(f"/api/dg-approval/{token}/").status_code, 404)

    def test_hr_sees_who_the_paper_is_waiting_for(self):
        self._send_to_dg()
        res = self.hr_client.get(f"/api/submissions/{self.sub.id}/allowed_transitions/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data["dg_status"]["dg_name"], "Daniel Garae")
        self.assertTrue(res.data["dg_status"]["link_active"])

    def test_hr_is_told_why_it_cannot_go_to_the_dg(self):
        self.dg.is_active = False
        self.dg.save()
        res = self.hr_client.get(f"/api/submissions/{self.sub.id}/allowed_transitions/")
        self.assertEqual(res.status_code, 200, res.content)
        send = res.data["dg_send"]
        self.assertFalse(send["available"])
        self.assertTrue(send["enabled"])
        self.assertIn("no active Director-General", send["reason"])
        self.assertNotIn("pending_dg_endorsement", res.data["allowed"])

    def test_only_hr_is_offered_the_resend_button(self):
        self._send_to_dg()
        hr = self.hr_client.get(f"/api/submissions/{self.sub.id}/allowed_transitions/")
        dg = self._client(self.dg).get(f"/api/submissions/{self.sub.id}/allowed_transitions/")
        self.assertTrue(hr.data["can_resend_dg_link"])
        self.assertFalse(dg.data["can_resend_dg_link"])
        self.assertTrue(dg.data["can_endorse"])

    def test_the_submission_records_how_the_dg_approved(self):
        self._send_to_dg()
        self._decide(self._raw_token(), decision="approve", pin=PIN)
        res = self.hr_client.get(f"/api/submissions/{self.sub.id}/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data["dg_approval_method"], "email_link")
        self.assertEqual(res.data["dg_approval_name"], "Daniel Garae")

    def test_a_stale_login_header_does_not_break_the_public_page(self):
        self._send_to_dg()
        res = self.public.get(
            f"/api/dg-approval/{self._raw_token()}/", HTTP_AUTHORIZATION="Bearer not-a-valid-jwt",
        )
        self.assertEqual(res.status_code, 200, res.content)

    # ── documents ────────────────────────────────────────────────────────────
    def test_the_dg_can_open_the_papers_files_through_the_link(self):
        doc = SubmissionDocument.objects.create(
            submission=self.sub, original_name="memo.txt", uploaded_by=self.hr,
            file=SimpleUploadedFile("memo.txt", b"the memo", content_type="text/plain"),
        )
        self._send_to_dg()
        token = self._raw_token()
        summary = self.public.get(f"/api/dg-approval/{token}/")
        self.assertEqual([d["name"] for d in summary.data["documents"]], ["memo.txt"])
        res = self.public.get(f"/api/dg-approval/{token}/documents/{doc.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(b"".join(res.streaming_content), b"the memo")
        self.assertEqual(res["X-Content-Type-Options"], "nosniff")

    def test_a_link_cannot_open_another_papers_files(self):
        other = Submission.objects.create(
            title="Someone else's paper", ministry=self.ministry, form_type_code="TEST-NONE-XYZ",
            current_stage=WorkflowStage.DRAFT, received_at=timezone.now(), created_by=self.hr,
        )
        doc = SubmissionDocument.objects.create(
            submission=other, original_name="secret.txt", uploaded_by=self.hr,
            file=SimpleUploadedFile("secret.txt", b"secret"),
        )
        self._send_to_dg()
        res = self.public.get(f"/api/dg-approval/{self._raw_token()}/documents/{doc.id}/")
        self.assertEqual(res.status_code, 404)

    # ── the DG's letter on the checklist ─────────────────────────────────────
    def _checklist(self):
        ft = PSCFormType.objects.create(code="T-DGLETTER", name="Test form")
        RequiredDocument.objects.create(
            form_type=ft, name="DG's Endorsement Letter", item_type="document",
            mandatory_for_stage="draft", is_active=True,
        )
        self.sub.form_type_code = "T-DGLETTER"
        self.sub.save()
        return ft

    def test_the_missing_dg_letter_does_not_stop_hr_sending_to_the_dg(self):
        self._checklist()
        self._send_to_dg()
        self.assertEqual(self.sub.current_stage, WorkflowStage.PENDING_DG_ENDORSEMENT)

    def test_other_missing_required_documents_still_stop_hr(self):
        ft = self._checklist()
        RequiredDocument.objects.create(
            form_type=ft, name="Position description", item_type="document",
            mandatory_for_stage="draft", is_active=True,
        )
        res = self.hr_client.post(
            f"/api/submissions/{self.sub.id}/transition/",
            {"new_stage": "pending_dg_endorsement"}, format="json",
        )
        self.assertEqual(res.status_code, 400, res.content)
        self.assertIn("mandatory", res.data["detail"])

    def test_the_dg_approval_ticks_the_dg_letter_on_the_checklist(self):
        self._checklist()
        self._send_to_dg()
        self._decide(self._raw_token(), decision="approve", pin=PIN)
        item = SubmissionChecklistItem.objects.get(submission=self.sub, document__name="DG's Endorsement Letter")
        self.assertTrue(item.is_present)
        self.assertEqual(item.checked_by, self.dg)

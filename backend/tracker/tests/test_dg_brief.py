"""
The AI summary on the Director-General's emailed approval page: written when HR sends
the paper, shown above the documents, and never in the way when the AI is off or fails.
"""
import re
import shutil
import tempfile
from unittest import mock

from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.models import (
    AuditLog, Ministry, Profile, Role, Submission, SubmissionDocument, SystemSetting, WorkflowStage,
)
from tracker.tasks import _clean_dg_brief, build_dg_brief_context, generate_dg_brief, queue_dg_brief

MEDIA = tempfile.mkdtemp(prefix="dg-brief-media-")

ANSWER = {
    "request": "Confirm Ms Sarah Tari in her post as Senior Officer after probation.",
    "key_facts": [
        {"label": "Officer", "value": "Sarah Tari"},
        {"label": "Position", "value": "Senior Officer"},
    ],
    "documents": [{"name": "Supervisor letter.pdf", "summary": "Recommends confirmation after 12 months."}],
    "points_to_check": ["The appraisal covers 10 months, not 12."],
}


@override_settings(
    SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"], MEDIA_ROOT=MEDIA,
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class DGBriefTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        SystemSetting.objects.create(key="DG_EMAIL_APPROVAL_ENABLED", value="true")
        self.ministry = Ministry.objects.create(code="ZZ_DGB", name="DG Brief Ministry")
        self.hr = User.objects.create_user("dgb_hr", password="x", email="hr@ministry.gov.vu",
                                           first_name="Hana", last_name="Roro")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.dg = User.objects.create_user("dgb_dg", password="x", email="dg@ministry.gov.vu",
                                           first_name="Daniel", last_name="Garae")
        Profile.objects.create(user=self.dg, role=Role.HEAD_OF_AGENCY, ministry=self.ministry,
                               session_pin=make_password("4821"))
        self.sub = Submission.objects.create(
            title="Confirmation of appointment", ministry=self.ministry, form_type_code="TEST-NONE-XYZ",
            current_stage=WorkflowStage.DRAFT, received_at=timezone.now(), created_by=self.hr,
            notes="Probation ended in March.",
        )
        doc = SubmissionDocument(
            submission=self.sub, original_name="Supervisor letter.pdf", description="Supervisor's letter",
            uploaded_by=self.hr, extracted_text="I recommend confirming Sarah Tari after twelve months.",
        )
        doc.file.save("Supervisor letter.pdf", ContentFile(b"%PDF-1.4 test"), save=False)
        doc.save()
        self.hr_client = APIClient()
        self.hr_client.force_authenticate(user=self.hr)
        self.public = APIClient()

    def _send_to_dg(self):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.hr_client.post(
                f"/api/submissions/{self.sub.id}/transition/",
                {"new_stage": "pending_dg_endorsement"}, format="json",
            )
        self.assertEqual(res.status_code, 200, res.content)
        self.sub.refresh_from_db()

    def _token(self):
        msg = [m for m in mail.outbox if "approval is needed" in m.subject][-1]
        return re.search(r"/dg-approval/([\w-]+)", msg.body).group(1)

    def _page(self, **params):
        return self.public.get(f"/api/dg-approval/{self._token()}/", params)

    def _generate(self, answer=(ANSWER, None)):
        with mock.patch("tracker.ai.claude_client.ai_enabled", return_value=True), \
                mock.patch("tracker.ai.claude_client.complete_json_with_error", return_value=answer) as call:
            generate_dg_brief(self.sub.id)
        self.sub.refresh_from_db()
        return call

    # ── the page ─────────────────────────────────────────────────────────────
    def test_no_summary_is_shown_when_nothing_was_written(self):
        self._send_to_dg()
        self.assertIsNone(self._page().data["ai_brief"])

    def test_a_written_summary_is_on_the_page(self):
        self._send_to_dg()
        self._generate()
        self.assertEqual(self.sub.ai_dg_brief_status, "ready")
        brief = self._page().data["ai_brief"]
        self.assertEqual(brief["status"], "ready")
        self.assertEqual(brief["request"], ANSWER["request"])
        self.assertEqual(brief["key_facts"][0], {"label": "Officer", "value": "Sarah Tari"})
        self.assertEqual(brief["documents"][0]["name"], "Supervisor letter.pdf")
        self.assertEqual(brief["points_to_check"], ANSWER["points_to_check"])
        self.assertNotIn("context_key", brief)

    def test_the_page_says_so_while_the_summary_is_being_written(self):
        self._send_to_dg()
        Submission.objects.filter(pk=self.sub.pk).update(ai_dg_brief_status="pending")
        self.assertEqual(self._page().data["ai_brief"], {"status": "pending"})

    def test_a_failed_summary_leaves_the_page_as_it_was(self):
        self._send_to_dg()
        self._generate(answer=(None, "invalid request"))
        self.assertEqual(self.sub.ai_dg_brief_status, "failed")
        self.assertIsNone(self._page().data["ai_brief"])

    def test_checking_for_the_summary_is_not_logged_as_opening_the_link(self):
        self._send_to_dg()
        opened = AuditLog.objects.filter(description__contains="DG approval link opened")
        self._page()
        self.assertEqual(opened.count(), 1)
        self._page(poll=1)
        self.assertEqual(opened.count(), 1)

    # ── writing it ───────────────────────────────────────────────────────────
    def test_the_model_is_given_the_form_notes_and_each_documents_text(self):
        call = self._generate()
        prompt = call.call_args.kwargs["user"]
        self.assertIn("Probation ended in March.", prompt)
        self.assertIn("Supervisor letter.pdf", prompt)
        self.assertIn("I recommend confirming Sarah Tari after twelve months.", prompt)
        self.assertNotIn("assigned", prompt.lower())  # nothing from PSC's internal workflow

    def test_a_document_with_no_readable_text_is_said_to_be_unreadable(self):
        SubmissionDocument.objects.update(extracted_text="")
        self.assertIn("no readable text", build_dg_brief_context(self.sub))

    def test_odd_model_output_is_trimmed_to_the_expected_shape(self):
        cleaned = _clean_dg_brief({
            "request": "  Do  this ",
            "key_facts": [{"label": "A", "value": "1"}, {"label": "", "value": "x"}, "junk"],
            "documents": "not a list",
            "points_to_check": ["ok", 5, None],
        })
        self.assertEqual(cleaned["request"], "Do this")
        self.assertEqual(cleaned["key_facts"], [{"label": "A", "value": "1"}])
        self.assertEqual(cleaned["documents"], [])
        self.assertEqual(cleaned["points_to_check"], ["ok"])
        self.assertEqual(_clean_dg_brief({"key_facts": []}), {})
        self.assertEqual(_clean_dg_brief("nope"), {})

    # ── starting it ──────────────────────────────────────────────────────────
    def test_sending_to_the_dg_starts_the_summary(self):
        with mock.patch("tracker.tasks.queue_dg_brief") as queue:
            self._send_to_dg()
        queue.assert_called_once_with(self.sub.id)

    def test_starting_it_marks_the_paper_pending(self):
        with mock.patch("tracker.ai_settings.dg_brief_enabled", return_value=True), \
                mock.patch("tracker.tasks.generate_dg_brief.delay") as delay:
            queue_dg_brief(self.sub.id)
        delay.assert_called_once_with(self.sub.id)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.ai_dg_brief_status, "pending")

    def test_nothing_starts_when_the_ai_is_off(self):
        with mock.patch("tracker.tasks.generate_dg_brief.delay") as delay:
            queue_dg_brief(self.sub.id)
        delay.assert_not_called()
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.ai_dg_brief_status, "")

    def test_a_current_summary_is_not_written_again(self):
        self._generate()
        with mock.patch("tracker.ai_settings.dg_brief_enabled", return_value=True), \
                mock.patch("tracker.tasks.generate_dg_brief.delay") as delay:
            queue_dg_brief(self.sub.id)
        delay.assert_not_called()

    def test_a_changed_document_set_is_written_again(self):
        self._generate()
        extra = SubmissionDocument(submission=self.sub, original_name="Appraisal.pdf", uploaded_by=self.hr,
                                   extracted_text="Appraisal text.")
        extra.file.save("Appraisal.pdf", ContentFile(b"%PDF-1.4 test"), save=False)
        extra.save()
        with mock.patch("tracker.ai_settings.dg_brief_enabled", return_value=True), \
                mock.patch("tracker.tasks.generate_dg_brief.delay") as delay:
            queue_dg_brief(self.sub.id)
        delay.assert_called_once_with(self.sub.id)

    def test_a_queue_failure_never_blocks_the_link(self):
        with mock.patch("tracker.ai_settings.dg_brief_enabled", return_value=True), \
                mock.patch("tracker.tasks.generate_dg_brief.delay", side_effect=OSError("no broker")):
            self._send_to_dg()
        self.assertEqual(self.sub.current_stage, WorkflowStage.PENDING_DG_ENDORSEMENT)
        self.assertTrue([m for m in mail.outbox if "approval is needed" in m.subject])
        self.assertEqual(self.sub.ai_dg_brief_status, "failed")

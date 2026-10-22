"""
The DG approves a ministry paper on paper, outside SCDMS. Two soft controls stand in
for a workflow step: the DG is told (read-only) when HR submits a paper, and an AI
vision hint says whether the uploaded scan shows a signature on a DG approval block.
Neither blocks a submission.
"""
import contextlib
from pathlib import Path
from unittest import mock

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.ai import signature_check as sig
from tracker.ai.submission_package_validation import _rule_based_gaps
from tracker.models import (
    Ministry, Notification, Profile, Role, Submission, SubmissionDocument, WorkflowStage,
)


def _pdf(name="p.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4\n%%EOF\n", content_type="application/pdf")


class _Base(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_DGN", name="DG Notice Ministry")
        self.hr = User.objects.create_user("dgn_hr", password="x", first_name="Jane", last_name="Tari")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.dg = User.objects.create_user("dgn_dg", password="x", email="dg@example.org")
        Profile.objects.create(user=self.dg, role=Role.HEAD_OF_AGENCY, ministry=self.ministry)
        self.sub = Submission.objects.create(
            title="Establishment of a new post", ministry=self.ministry,
            form_type_code="TEST-NONE-XYZ", current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(), created_by=self.hr,
        )

    def _doc(self, facts=None, name="p.pdf"):
        return SubmissionDocument.objects.create(
            submission=self.sub, file=_pdf(name), original_name=name, extracted_facts=facts or {},
        )

    @staticmethod
    def _check(verdict, name="p.pdf"):
        return {sig.FACTS_KEY: {"verdict": verdict, "where": "p1", "note": "", "file": name}}


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DgPaperNoticeTests(_Base):
    def _submit(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        with self.captureOnCommitCallbacks(execute=True):
            return client.post(
                f"/api/submissions/{self.sub.id}/transition/", {"new_stage": "submitted"}, format="json",
            )

    def test_dg_is_told_when_hr_submits_a_paper(self):
        with mock.patch("tracker.tasks.queue_dg_paper_notice_emails") as notice, \
             mock.patch("tracker.tasks.queue_external_submission_confirmation_emails") as receipt:
            res = self._submit(self.hr)
        self.assertEqual(res.status_code, 200, res.content)

        note = Notification.objects.get(recipient=self.dg, submission=self.sub)
        self.assertTrue(note.title.startswith("Submitted to PSC with your approval"))
        notice.assert_called_once_with(self.sub.id, [self.dg.id], "Jane Tari")
        # The DG gets the notice instead of the generic receipt.
        self.assertNotIn(self.dg.id, receipt.call_args.args[1])

    def test_no_dg_notice_for_a_paper_the_dg_never_approved_on_paper(self):
        # Secretary-only and OPSC-internal papers have no ministry DG approving them.
        self.sub.secretary_only = True
        self.sub.save()
        with mock.patch("tracker.tasks.queue_dg_paper_notice_emails") as notice:
            self._submit(self.hr)
        notice.assert_not_called()
        self.assertFalse(Notification.objects.filter(recipient=self.dg).exists())

    def test_email_goes_to_the_dg_with_who_submitted(self):
        from tracker.email_notify import notify_dg_paper_submitted

        with mock.patch("tracker.email_notify.send_templated_email") as send:
            notify_dg_paper_submitted(self.sub, [self.dg], "Jane Tari")
        kwargs = send.call_args.kwargs
        self.assertEqual(kwargs["slug"], "submission_dg_paper_notice")
        self.assertEqual(kwargs["to"], ["dg@example.org"])
        self.assertEqual(kwargs["context"]["submitted_by"], "Jane Tari")

    def test_notice_template_is_seeded(self):
        from tracker.models import EmailTemplate

        self.assertTrue(EmailTemplate.objects.filter(slug="submission_dg_paper_notice").exists())


class DgSignatureGapTests(_Base):
    def _endorsement_gaps(self):
        return [g for g in _rule_based_gaps(self.sub) if g["category"] == "endorsement"]

    def test_no_signature_nudge_without_any_upload(self):
        self.assertEqual(self._endorsement_gaps(), [])

    def test_signature_seen_means_no_gap(self):
        self._doc(self._check("seen"))
        self.assertEqual(self._endorsement_gaps(), [])

    def test_not_seen_is_a_warning(self):
        self._doc(self._check("not_seen"))
        (gap,) = self._endorsement_gaps()
        self.assertEqual(gap["severity"], "warning")
        self.assertIn("signature", gap["message"])

    def test_unclear_is_only_info_and_names_the_file(self):
        self._doc(self._check("unclear", "scan.pdf"), name="scan.pdf")
        (gap,) = self._endorsement_gaps()
        self.assertEqual(gap["severity"], "info")
        self.assertIn("scan.pdf", gap["message"])

    def test_unchecked_upload_is_only_info(self):
        self._doc()
        (gap,) = self._endorsement_gaps()
        self.assertEqual(gap["severity"], "info")

    def test_one_signed_paper_outweighs_an_unsigned_one(self):
        self._doc(self._check("not_seen"), name="a.pdf")
        self._doc(self._check("seen", "b.pdf"), name="b.pdf")
        self.assertEqual(self._endorsement_gaps(), [])


class DgSignatureCheckTests(_Base):
    @staticmethod
    @contextlib.contextmanager
    def _fake_file(_field):
        yield Path("/nonexistent.pdf")

    def test_check_document_returns_the_models_verdict(self):
        reply = ({"verdict": "seen", "where": "p3, DG block", "note": "ok"}, None)
        with mock.patch.object(sig, "_page_images", return_value=[("image/jpeg", "aaaa")]), \
             mock.patch.object(sig, "complete_json_with_images", return_value=reply):
            result = sig.check_document(Path("x.pdf"), "x.pdf")
        self.assertEqual(result["verdict"], "seen")
        self.assertEqual(result["where"], "p3, DG block")

    def test_bad_or_failed_answers_are_ignored(self):
        with mock.patch.object(sig, "_page_images", return_value=[("image/jpeg", "aaaa")]):
            with mock.patch.object(sig, "complete_json_with_images", return_value=({"verdict": "maybe"}, None)):
                self.assertIsNone(sig.check_document(Path("x.pdf"), "x.pdf"))
            with mock.patch.object(sig, "complete_json_with_images", return_value=(None, "quota")):
                self.assertIsNone(sig.check_document(Path("x.pdf"), "x.pdf"))

    def test_result_is_stored_once_and_not_repeated(self):
        doc = self._doc()
        found = {"verdict": "seen", "where": "p1", "note": ""}
        with mock.patch.object(sig, "ai_enabled", return_value=True), \
             mock.patch("tracker.media_access.materialize_file_field", self._fake_file), \
             mock.patch.object(sig, "check_document", return_value=found) as check:
            sig.ensure_dg_signature_checks(self.sub)
            sig.ensure_dg_signature_checks(self.sub)
        self.assertEqual(check.call_count, 1)
        doc.refresh_from_db()
        self.assertEqual(doc.extracted_facts[sig.FACTS_KEY]["verdict"], "seen")
        self.assertEqual(doc.extracted_facts[sig.FACTS_KEY]["file"], doc.file.name)

    def test_nothing_runs_when_ai_is_off_or_paper_is_internal(self):
        self._doc()
        with mock.patch("tracker.media_access.materialize_file_field", self._fake_file), \
             mock.patch.object(sig, "check_document") as check:
            with mock.patch.object(sig, "ai_enabled", return_value=False):
                sig.ensure_dg_signature_checks(self.sub)
            self.sub.is_internal = True
            with mock.patch.object(sig, "ai_enabled", return_value=True):
                sig.ensure_dg_signature_checks(self.sub)
        check.assert_not_called()

    def test_brief_context_carries_the_hint(self):
        from tracker.tasks import build_submission_brief_context

        self._doc(self._check("not_seen"))
        self.assertIn("DG signature (AI hint, unverified): not seen", build_submission_brief_context(self.sub))

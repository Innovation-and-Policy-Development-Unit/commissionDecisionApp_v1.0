"""
The DG approves a ministry paper on paper, outside SCDMS. Two soft controls stand in
for a workflow step: the DG is told (read-only) when HR submits a paper, and an AI
vision hint says whether the uploaded scan shows a signature on a DG approval block.
Neither blocks a submission.
"""
import contextlib
from datetime import timedelta
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
    Ministry, Notification, Profile, RequiredDocument, Role, Submission, SubmissionDocument,
    WorkflowStage,
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
                f"/api/submissions/{self.sub.id}/transition/",
                {"new_stage": "submitted", "dg_approval_name": "Mr. John Kalo",
                 "dg_approval_date": timezone.localdate().isoformat()},
                format="json",
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

    def _slot(self, name="DG's Endorsement Letter"):
        return RequiredDocument.objects.create(name=name)

    def _slot_doc(self, name="dg.pdf"):
        doc = self._doc(name=name)
        doc.required_document = self._slot()
        doc.save()
        return doc

    def test_slot_names_are_recognised(self):
        for name in ("DG's Endorsement Letter", "Director-General's Endorsement Letter",
                     "Head of Agency approval"):
            self.assertTrue(sig.is_dg_slot(RequiredDocument(name=name)), name)
        for name in ("Position Description", "DG briefing note", "Endorsement of the Board"):
            self.assertFalse(sig.is_dg_slot(RequiredDocument(name=name)), name)

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

    def test_only_the_dg_slot_upload_is_checked_when_there_is_one(self):
        slot = self._slot_doc()
        self._doc(name="other.pdf")
        found = {"verdict": "seen", "where": "p1", "note": ""}
        with mock.patch.object(sig, "ai_enabled", return_value=True), \
             mock.patch("tracker.media_access.materialize_file_field", self._fake_file), \
             mock.patch.object(sig, "check_document", return_value=found) as check:
            sig.ensure_dg_signature_checks(self.sub)
            sig.ensure_dg_signature_checks(self.sub)  # already checked: no second call
        self.assertEqual(check.call_count, 1)
        slot.refresh_from_db()
        self.assertEqual(slot.extracted_facts[sig.FACTS_KEY]["verdict"], "seen")
        self.assertEqual(slot.extracted_facts[sig.FACTS_KEY]["file"], slot.file.name)

    def test_without_a_slot_only_files_whose_text_mentions_the_dg_are_checked(self):
        plain = self._doc(name="costing.pdf")
        plain.extracted_text = "Salary costing for the new post."
        plain.save()
        signed = self._doc(name="signed.pdf")
        signed.extracted_text = "Approved by the Director General, Ministry of Finance"
        signed.save()
        found = {"verdict": "not_seen", "where": "", "note": ""}
        with mock.patch.object(sig, "ai_enabled", return_value=True), \
             mock.patch("tracker.media_access.materialize_file_field", self._fake_file), \
             mock.patch.object(sig, "check_document", return_value=found) as check:
            sig.ensure_dg_signature_checks(self.sub)
        self.assertEqual(check.call_count, 1)
        signed.refresh_from_db()
        plain.refresh_from_db()
        self.assertIn(sig.FACTS_KEY, signed.extracted_facts)
        self.assertNotIn(sig.FACTS_KEY, plain.extracted_facts)

    def test_nothing_runs_when_ai_is_off_or_paper_is_internal(self):
        self._slot_doc()
        with mock.patch("tracker.media_access.materialize_file_field", self._fake_file), \
             mock.patch.object(sig, "check_document") as check:
            with mock.patch.object(sig, "ai_enabled", return_value=False):
                sig.ensure_dg_signature_checks(self.sub)
            self.sub.is_internal = True
            with mock.patch.object(sig, "ai_enabled", return_value=True):
                sig.ensure_dg_signature_checks(self.sub)
        check.assert_not_called()

    def test_pages_sent_are_the_ones_that_mention_the_dg(self):
        try:
            import fitz
        except ImportError:
            self.skipTest("PyMuPDF not installed")
        import tempfile

        doc = fitz.open()
        texts = ["Cover", "Background", "Approved by: Director General", "Annex", "Annex B"]
        for text in texts:
            doc.new_page().insert_text((72, 72), text)
        with tempfile.NamedTemporaryFile(suffix=".pdf") as tmp:
            doc.save(tmp.name)
            self.assertEqual(sig._pages_to_check(Path(tmp.name)), [2])
        plain = fitz.open()
        for text in ["One", "Two", "Three", "Four", "Five"]:
            plain.new_page().insert_text((72, 72), text)
        with tempfile.NamedTemporaryFile(suffix=".pdf") as tmp:
            plain.save(tmp.name)
            # No page mentions the DG: the cover plus the last two, never the whole file.
            self.assertEqual(sig._pages_to_check(Path(tmp.name)), [0, 3, 4])

    def test_uploading_into_the_dg_slot_queues_a_check(self):
        slot = self._slot()
        with mock.patch("tracker.tasks.queue_dg_signature_check") as queue:
            with self.captureOnCommitCallbacks(execute=True):
                doc = SubmissionDocument.objects.create(
                    submission=self.sub, file=_pdf("dg.pdf"), original_name="dg.pdf", required_document=slot,
                )
        queue.assert_called_once_with(doc.id)

    def test_other_uploads_do_not_queue_a_check(self):
        other = RequiredDocument.objects.create(name="Position Description")
        with mock.patch("tracker.tasks.queue_dg_signature_check") as queue:
            with self.captureOnCommitCallbacks(execute=True):
                SubmissionDocument.objects.create(
                    submission=self.sub, file=_pdf("pd.pdf"), original_name="pd.pdf", required_document=other,
                )
                SubmissionDocument.objects.create(submission=self.sub, file=_pdf("x.pdf"), original_name="x.pdf")
        queue.assert_not_called()

    def test_rereading_the_text_keeps_an_earlier_signature_hint(self):
        from tracker import tasks

        doc = self._doc(self._check("seen", "p.pdf"))
        doc.refresh_from_db()
        doc.extracted_facts = {sig.FACTS_KEY: {"verdict": "seen", "file": doc.file.name}}
        doc.save()
        ocr = ({"extracted_text": "x" * 40, "key_facts": {}, "document_summary": ""}, None)
        with mock.patch("tracker.ai.document_extraction.run_document_extraction", return_value=ocr), \
             mock.patch("tracker.media_access.materialize_file_field", self._fake_file), \
             mock.patch.object(tasks, "queue_document_classification"):
            tasks.extract_document_facts(doc.id)
        doc.refresh_from_db()
        self.assertEqual(doc.extracted_facts[sig.FACTS_KEY]["verdict"], "seen")

    def test_brief_context_carries_the_hint_and_the_attestation(self):
        from tracker.tasks import build_submission_brief_context

        self.sub.dg_approval_name = "Mr. John Kalo"
        self.sub.dg_approval_date = timezone.localdate()
        self.sub.save()
        self._doc(self._check("not_seen"))
        text = build_submission_brief_context(self.sub)
        self.assertIn("DG signature (AI hint, unverified): not seen", text)
        self.assertIn("attested by HR, not verified): Mr. John Kalo", text)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DgAttestationTests(_Base):
    def _post(self, **extra):
        client = APIClient()
        client.force_authenticate(user=self.hr)
        return client.post(
            f"/api/submissions/{self.sub.id}/transition/", {"new_stage": "submitted", **extra}, format="json",
        )

    def _good(self):
        return {"dg_approval_name": "Mr. John Kalo", "dg_approval_date": timezone.localdate().isoformat()}

    def test_name_and_date_are_required(self):
        self.assertEqual(self._post().status_code, 400)
        self.assertEqual(self._post(dg_approval_name="Mr. John Kalo").status_code, 400)
        self.assertEqual(self._post(dg_approval_date=timezone.localdate().isoformat()).status_code, 400)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.DRAFT)

    def test_signing_date_cannot_be_in_the_future(self):
        future = (timezone.localdate() + timedelta(days=2)).isoformat()
        res = self._post(dg_approval_name="Mr. John Kalo", dg_approval_date=future)
        self.assertEqual(res.status_code, 400)
        self.assertIn("future", res.data["detail"])

    def test_attestation_is_saved_and_in_the_audit_trail(self):
        res = self._post(**self._good())
        self.assertEqual(res.status_code, 200, res.content)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.dg_approval_name, "Mr. John Kalo")
        self.assertEqual(self.sub.dg_approval_date, timezone.localdate())
        self.assertEqual(self.sub.dg_approval_attested_by_id, self.hr.id)
        self.assertIsNotNone(self.sub.dg_approval_attested_at)
        event = self.sub.events.filter(new_stage=WorkflowStage.SUBMITTED).first()
        self.assertIn("DG approval on paper attested by HR: Mr. John Kalo", event.remarks)

    def test_resubmission_after_clarification_keeps_the_attestation(self):
        self._post(**self._good())
        self.sub.refresh_from_db()
        self.sub.current_stage = WorkflowStage.RETURNED_FOR_CLARIFICATION
        self.sub.save()
        res = self._post()
        self.assertEqual(res.status_code, 200, res.content)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.dg_approval_name, "Mr. John Kalo")

    def test_not_asked_for_papers_that_have_no_ministry_dg(self):
        self.sub.secretary_only = True
        self.sub.save()
        self.assertEqual(self._post().status_code, 200)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DgContactTests(_Base):
    def test_fallback_address_is_used_when_the_ministry_has_no_dg_account(self):
        from tracker.email_notify import notify_dg_paper_submitted

        self.ministry.dg_contact_email = "office-of-dg@example.org"
        self.ministry.save()
        with mock.patch("tracker.email_notify.send_templated_email") as send:
            notify_dg_paper_submitted(self.sub, [], "Jane Tari")
        self.assertEqual(send.call_args.kwargs["to"], ["office-of-dg@example.org"])

    def test_dg_account_and_fallback_are_not_both_sent_the_same_address(self):
        from tracker.email_notify import notify_dg_paper_submitted

        self.ministry.dg_contact_email = "DG@example.org"
        self.ministry.save()
        with mock.patch("tracker.email_notify.send_templated_email") as send:
            notify_dg_paper_submitted(self.sub, [self.dg], "Jane Tari")
        self.assertEqual(send.call_count, 1)

    def test_notice_goes_out_for_a_ministry_with_only_a_fallback_address(self):
        self.dg.is_active = False
        self.dg.save()
        self.ministry.dg_contact_email = "office-of-dg@example.org"
        self.ministry.save()
        client = APIClient()
        client.force_authenticate(user=self.hr)
        with mock.patch("tracker.tasks.queue_dg_paper_notice_emails") as notice, \
             self.captureOnCommitCallbacks(execute=True):
            client.post(
                f"/api/submissions/{self.sub.id}/transition/",
                {"new_stage": "submitted", "dg_approval_name": "Mr. John Kalo",
                 "dg_approval_date": timezone.localdate().isoformat()},
                format="json",
            )
        notice.assert_called_once()

    def test_coverage_lists_ministries_nobody_could_notify(self):
        admin = User.objects.create_user("dgc_admin", password="x")
        Profile.objects.create(user=admin, role=Role.PSC_ADMIN)
        bare = Ministry.objects.create(code="ZZ_BARE", name="Bare Ministry")
        emailed = Ministry.objects.create(code="ZZ_MAIL", name="Mail Ministry", dg_contact_email="a@b.org")
        client = APIClient()
        client.force_authenticate(user=admin)
        res = client.get("/api/ministries/dg-coverage/")
        self.assertEqual(res.status_code, 200, res.content)
        names = {m["name"] for m in res.data["ministries"]}
        self.assertIn(bare.name, names)
        self.assertNotIn(emailed.name, names)           # has a fallback email
        self.assertNotIn(self.ministry.name, names)      # has a DG account with an email

    def test_coverage_is_admin_only_and_the_email_is_hidden_from_others(self):
        self.ministry.dg_contact_email = "office-of-dg@example.org"
        self.ministry.save()
        client = APIClient()
        client.force_authenticate(user=self.hr)
        self.assertEqual(client.get("/api/ministries/dg-coverage/").status_code, 403)
        rows = client.get("/api/ministries/").data
        rows = rows["results"] if isinstance(rows, dict) else rows
        self.assertNotIn("dg_contact_email", rows[0])

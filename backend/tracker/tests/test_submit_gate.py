"""HR may only submit to PSC once the package is complete: every required document
uploaded, the digitized form filled in, and a validation run that came back clean."""
from unittest import mock

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker import submit_gate
from tracker.models import (
    Department, Ministry, Profile, PSCFormField, PSCFormResponse, PSCFormType, RequiredDocument,
    Role, Submission, SubmissionChecklistItem, SubmissionDocument, WorkflowStage,
)

SUBMIT = {"dg_approval_name": "Mr. John Kalo", "dg_approval_date": "2026-10-01"}


@override_settings(SECURE_SSL_REDIRECT=False)
class _Base(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_GATE", name="Gate Ministry")
        self.hr = User.objects.create_user("gate_hr", password="x", email="gate.hr@example.org")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.form_type = PSCFormType.objects.create(
            code="GATE-TEST", name="Gate Test Form", routed_unit="hr", is_active=True,
        )
        self.sub = Submission.objects.create(
            title="A properly titled gate test paper", ministry=self.ministry,
            form_type_code="GATE-TEST", current_stage=WorkflowStage.DRAFT,
            received_at=timezone.now(), created_by=self.hr,
        )
        self.required = RequiredDocument.objects.create(
            form_type=self.form_type, name="Supervisor's Recommendation Letter", is_active=True,
        )
        self.item = SubmissionChecklistItem.objects.create(
            submission=self.sub, document=self.required, is_present=False,
        )

    def api(self, user=None):
        c = APIClient()
        c.force_authenticate(user=user or self.hr)
        return c

    def attach_required(self):
        doc = SubmissionDocument(
            submission=self.sub, required_document=self.required, uploaded_by=self.hr,
            original_name="letter.pdf",
        )
        doc.file.save("letter.pdf", ContentFile(b"%PDF-1.4 letter"), save=True)
        self.item.is_present = True
        self.item.save(update_fields=["is_present"])
        return doc

    def pass_validation(self):
        """Record a clean validation of the package as it stands."""
        self.sub.ai_package_gaps = []
        self.sub.ai_package_ready = True
        self.sub.ai_package_processed = True
        self.sub.ai_package_generated_at = timezone.now()
        self.sub.ai_package_signature = submit_gate.package_signature(self.sub)
        self.sub.save()

    def codes(self):
        self.sub.refresh_from_db()
        return [b["code"] for b in submit_gate.submit_blockers(self.sub, Role.MINISTRY_HR)]

    def submit(self):
        with mock.patch("tracker.tasks.queue_external_submission_confirmation_emails"), \
                mock.patch("tracker.tasks.queue_dg_paper_notice_emails"), \
                self.captureOnCommitCallbacks(execute=True):
            return self.api().post(
                f"/api/submissions/{self.sub.id}/transition/",
                {"new_stage": "submitted", **SUBMIT}, format="json",
            )


class BlockerTests(_Base):
    def test_missing_required_document_blocks(self):
        self.assertIn(submit_gate.MISSING_DOCUMENTS, self.codes())

    def test_missing_document_is_named(self):
        blockers = submit_gate.submit_blockers(self.sub, Role.MINISTRY_HR)
        self.assertIn("Supervisor's Recommendation Letter", blockers[0]["message"])

    def test_documents_attached_leaves_only_the_validation_blocker(self):
        self.attach_required()
        self.assertEqual(self.codes(), [submit_gate.NOT_VALIDATED])

    def test_incomplete_digitized_form_blocks(self):
        self.attach_required()
        self.form_type.is_digitized = True
        self.form_type.save()
        PSCFormField.objects.create(
            form_type=self.form_type, field_key="officer_name", label="Officer",
            field_type="text", is_required=True,
        )
        PSCFormResponse.objects.create(
            submission=self.sub, form_type=self.form_type, data={"officer_name": ""},
        )
        self.assertIn(submit_gate.FORM_INCOMPLETE, self.codes())

    def test_validation_that_found_problems_blocks(self):
        self.attach_required()
        self.pass_validation()
        self.sub.ai_package_ready = False
        self.sub.ai_package_gaps = [
            {"severity": "critical", "category": "checklist", "message": "Appraisal rating is missing."},
        ]
        self.sub.save()
        self.assertEqual(self.codes(), [submit_gate.VALIDATION_FAILED])

    def test_failed_validation_quotes_the_gap(self):
        self.attach_required()
        self.pass_validation()
        self.sub.ai_package_ready = False
        self.sub.ai_package_gaps = [
            {"severity": "critical", "category": "checklist", "message": "Appraisal rating is missing."},
        ]
        self.sub.save()
        blockers = submit_gate.submit_blockers(self.sub, Role.MINISTRY_HR)
        self.assertIn("Appraisal rating is missing.", blockers[0]["message"])

    def test_complete_package_has_no_blockers(self):
        self.attach_required()
        self.pass_validation()
        self.assertEqual(self.codes(), [])


class StalenessTests(_Base):
    def test_removing_a_document_makes_the_validation_stale(self):
        doc = self.attach_required()
        self.pass_validation()
        self.assertEqual(self.codes(), [])
        doc.delete()
        self.item.is_present = False
        self.item.save(update_fields=["is_present"])
        codes = self.codes()
        self.assertIn(submit_gate.MISSING_DOCUMENTS, codes)
        self.assertIn(submit_gate.VALIDATION_STALE, codes)

    def test_adding_a_document_makes_the_validation_stale(self):
        self.attach_required()
        self.pass_validation()
        extra = SubmissionDocument(submission=self.sub, uploaded_by=self.hr, original_name="extra.pdf")
        extra.file.save("extra.pdf", ContentFile(b"%PDF-1.4 extra"), save=True)
        self.assertEqual(self.codes(), [submit_gate.VALIDATION_STALE])

    def test_signature_is_stable_when_nothing_changes(self):
        self.attach_required()
        first = submit_gate.package_signature(self.sub)
        self.sub.refresh_from_db()
        self.assertEqual(first, submit_gate.package_signature(self.sub))


class ScopeTests(_Base):
    def test_gate_skips_opsc_internal_papers(self):
        self.sub.is_internal = True
        self.sub.save()
        self.assertEqual(submit_gate.submit_blockers(self.sub, Role.MINISTRY_HR), [])

    def test_gate_skips_papers_lodged_on_paper(self):
        self.sub.lodged_from_paper = True
        self.sub.save()
        self.assertEqual(submit_gate.submit_blockers(self.sub, Role.MINISTRY_HR), [])

    def test_gate_does_not_apply_to_opsc_roles(self):
        self.assertEqual(submit_gate.submit_blockers(self.sub, Role.PSC_OFFICER), [])


class TransitionTests(_Base):
    def test_submit_is_refused_while_blocked(self):
        res = self.submit()
        self.assertEqual(res.status_code, 400)
        self.assertIn("submit_blockers", res.data)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.current_stage, WorkflowStage.DRAFT)

    def test_refusal_names_the_first_blocker(self):
        res = self.submit()
        self.assertIn("Supervisor's Recommendation Letter", res.data["detail"])

    def test_submit_goes_through_once_the_package_is_complete(self):
        self.attach_required()
        self.pass_validation()
        res = self.submit()
        self.assertEqual(res.status_code, 200, getattr(res, "data", None))
        self.sub.refresh_from_db()
        self.assertNotEqual(self.sub.current_stage, WorkflowStage.DRAFT)

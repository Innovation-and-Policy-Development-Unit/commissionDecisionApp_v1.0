"""ORG-3.1 restructure checklist: the DG Endorsement Letter is only required
for department-level restructures — see resolve_required_documents() and
migration 0203_org_3_1_conditional_dg_letter.py.

PSCFormType(code='ORG-3.1') and its RequiredDocument rows are seeded by
migrations 0200/0203, which run as part of building the test database — so
these tests exercise the real migrated seed data rather than recreating it.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from ..models import Ministry, PSCFormResponse, PSCFormType, RequiredDocument, Submission, WorkflowStage
from ..submission_checklist import resolve_required_documents


class RestructureConditionalChecklistTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TST-R", name="Test Ministry R")
        self.hr = User.objects.create_user("hruser_restructure", password="x")
        self.form_type = PSCFormType.objects.get(code="ORG-3.1")

    def _submission(self):
        return Submission.objects.create(
            reference_number=f"SUB-ORG31-{Submission.objects.count()}",
            title="Restructure proposal",
            form_type_code="ORG-3.1",
            ministry=self.ministry,
            current_stage=WorkflowStage.UNDER_ASSESSMENT,
            received_at=timezone.now(),
            created_by=self.hr,
        )

    def test_dg_letter_required_for_department_level(self):
        submission = self._submission()
        PSCFormResponse.objects.create(
            submission=submission, form_type=self.form_type,
            data={"restructure_scope": "department"},
        )
        names = {d.name for d in resolve_required_documents(submission)}
        self.assertIn("DG Endorsement Letter", names)
        self.assertIn("Official Letter request to restructure", names)

    def test_dg_letter_excluded_for_ministry_level(self):
        submission = self._submission()
        PSCFormResponse.objects.create(
            submission=submission, form_type=self.form_type,
            data={"restructure_scope": "ministry"},
        )
        names = {d.name for d in resolve_required_documents(submission)}
        self.assertNotIn("DG Endorsement Letter", names)
        self.assertIn("Official Letter request to restructure", names)

    def test_dg_letter_excluded_when_scope_not_yet_chosen(self):
        submission = self._submission()
        # No PSCFormResponse yet — ministry hasn't filled the form.
        names = {d.name for d in resolve_required_documents(submission)}
        self.assertNotIn("DG Endorsement Letter", names)

    def test_dg_letter_excluded_when_form_data_missing_key(self):
        submission = self._submission()
        PSCFormResponse.objects.create(
            submission=submission, form_type=self.form_type, data={},
        )
        names = {d.name for d in resolve_required_documents(submission)}
        self.assertNotIn("DG Endorsement Letter", names)

    def test_submission_template_item_deactivated(self):
        item = RequiredDocument.objects.get(
            form_type=self.form_type, name="PSC Restructure Submission Template",
        )
        self.assertFalse(item.is_active)

    def test_official_letter_description_mentions_both_signers(self):
        item = RequiredDocument.objects.get(
            form_type=self.form_type, name="Official Letter request to restructure",
        )
        self.assertIn("Director", item.description)
        self.assertIn("Director-General", item.description)

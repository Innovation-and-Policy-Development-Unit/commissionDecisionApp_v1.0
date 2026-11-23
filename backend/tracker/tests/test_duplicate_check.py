"""Possible-repeat flag: rules pick earlier papers about the same officer, the AI judges them."""

from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker.ai.A4_duplicate_detector import _sanitize_result
from tracker.duplicate_check import (
    _names_match, _name_tokens, comparison_context, flag_level, officer_names, shortlist,
)
from tracker.models import (
    Ministry, Notification, Profile, PSCFormResponse, PSCFormType, Role, Submission,
    SubmissionDocument, WorkflowStage,
)
from tracker.tasks import detect_submission_duplicates

AI = "tracker.ai.A4_duplicate_detector.detect_duplicates"
ENABLED = "tracker.ai.claude_client.ai_enabled"


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"], SUBMISSION_RECALL_WINDOW_HOURS=0)
class DuplicateCheckTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_DUP", name="Dup Ministry")
        self.other_ministry = Ministry.objects.create(code="ZZ_DUP2", name="Other Ministry")
        self.form = PSCFormType.objects.create(code="DUP-ALLOW", name="Allowance", is_active=True)
        self.other_form = PSCFormType.objects.create(code="DUP-OTHER", name="Other", is_active=True)
        self.hr = self._user("dp_hr", Role.MINISTRY_HR, ministry=self.ministry)
        self.secretary = self._user("dp_sec", Role.PSC_SECRETARY)
        self.manager = self._user("dp_mgr", Role.HR_UNIT_MANAGER)

    def _user(self, name, role, **kw):
        u = User.objects.create_user(name, password="x")
        Profile.objects.create(user=u, role=role, **kw)
        return u

    def _paper(self, officer="Mary Tari", stage=WorkflowStage.APPROVED, form=None, ministry=None,
               email="", period="March to May 2026", key="officer_name"):
        form = form or self.form
        sub = Submission.objects.create(
            title=f"Allowance for {officer}", ministry=ministry or self.ministry,
            form_type_code=form.code, current_stage=stage, received_at=timezone.now(),
            created_by=self.hr, applicant_email=email,
        )
        PSCFormResponse.objects.create(
            submission=sub, form_type=form, data={key: officer, "period": period},
        )
        return sub

    # ── rules ──────────────────────────────────────────────────────────────
    def test_name_matching_ignores_order_titles_and_case(self):
        a = _name_tokens("Mrs. Mary TARI")
        self.assertTrue(_names_match(a, _name_tokens("Tari, Mary")))
        self.assertTrue(_names_match(a, _name_tokens("Mary Joy Tari")))   # fuller form of the name
        self.assertFalse(_names_match(a, _name_tokens("John Tari")))
        self.assertFalse(_names_match(_name_tokens("Tari"), _name_tokens("Mary Tari")))  # one word is too loose
        self.assertFalse(_names_match(_name_tokens("Tari"), _name_tokens("Tari")))

    def test_officer_names_only_reads_person_fields(self):
        sub = self._paper()
        PSCFormResponse.objects.filter(submission=sub).update(
            data={"officer_name": "Mary Tari", "department_name": "Finance", "supervisor_name": "Bob"},
        )
        sub.refresh_from_db()
        self.assertEqual(officer_names(sub), [_name_tokens("Mary Tari")])

    def test_shortlist_same_officer_same_form_only(self):
        new = self._paper(stage=WorkflowStage.RECEIVED_BY_PSC, period="June to August 2026")
        same = self._paper(period="March to May 2026")
        self._paper(officer="John Kalo")                          # other officer
        self._paper(form=self.other_form)                          # other form type
        self._paper(ministry=self.other_ministry)                  # other ministry
        self._paper(stage=WorkflowStage.DRAFT)                     # never submitted
        picked = shortlist(new)
        self.assertEqual([p["submission"].pk for p in picked], [same.pk])
        self.assertIn("same officer name", picked[0]["matched_on"])

    def test_shortlist_matches_on_email(self):
        new = self._paper(officer="M. Tari", email="mary@gov.vu", stage=WorkflowStage.RECEIVED_BY_PSC)
        old = self._paper(officer="Mary Tari", email="MARY@gov.vu")
        picked = shortlist(new)
        self.assertEqual([p["submission"].pk for p in picked], [old.pk])
        self.assertIn("same officer email", picked[0]["matched_on"])

    def test_no_officer_named_compares_same_form_type(self):
        new = self._paper(key="remarks", stage=WorkflowStage.RECEIVED_BY_PSC)
        old = self._paper(key="remarks")
        self.assertEqual([p["submission"].pk for p in shortlist(new)], [old.pk])

    def test_other_forms_name_fields_are_recognised(self):
        for key in ("acting_name", "subject_name", "subject_employee", "eligible_name", "applicant_name"):
            sub = self._paper(key=key)
            self.assertEqual(officer_names(sub), [_name_tokens("Mary Tari")], key)

    # ── names found in the uploaded letters ────────────────────────────────
    def _letter(self, sub, names, text="Please approve acting allowance.", doc_type="dg_endorsement"):
        return SubmissionDocument.objects.create(
            submission=sub, original_name="cover.pdf", extracted_text=text, uploaded_by=self.hr,
            document_type=doc_type, extracted_facts={"names": names, "dates": ["1 June 2026"]},
        )

    def _scan(self, stage=WorkflowStage.RECEIVED_BY_PSC):
        """A paper with no digitized form at all."""
        return Submission.objects.create(
            title="Scanned paper", ministry=self.ministry, form_type_code=self.form.code,
            current_stage=stage, received_at=timezone.now(), created_by=self.hr,
        )

    def test_letter_names_are_used_when_the_form_names_no_one(self):
        new, old = self._scan(), self._scan(WorkflowStage.APPROVED)
        self._letter(new, ["Mary Tari", "Ministry of Finance"])
        self._letter(old, ["Tari, Mary", "Ministry of Finance"])
        picked = shortlist(new)
        self.assertEqual([p["submission"].pk for p in picked], [old.pk])
        self.assertEqual(picked[0]["matched_on"], ["same officer name (in the letter)"])

    def test_signers_and_organisations_are_not_treated_as_the_officer(self):
        self.hr.first_name, self.hr.last_name = "Helen", "Bani"
        self.hr.save()
        new, old = self._scan(), self._scan(WorkflowStage.APPROVED)
        for sub in (new, old):
            # the lodging HR officer and the DG sign every letter; the ministry is named in all
            self._letter(sub, ["Helen Bani", "Director General Joe Kalo", "Ministry of Finance"])
        new.dg_approval_name = "Joe Kalo"
        new.save(update_fields=["dg_approval_name"])
        # No officer is identified, so it is NOT matched as "same officer": only the loose
        # same-form-type fallback applies.
        self.assertEqual([p["matched_on"] for p in shortlist(new)], [["same form type, no officer named"]])

    def test_a_paper_with_a_form_name_matches_an_older_scanned_paper_by_its_letter(self):
        new = self._paper(stage=WorkflowStage.RECEIVED_BY_PSC)
        old = self._scan(WorkflowStage.APPROVED)
        self._letter(old, ["Mary Tari"])
        self.assertEqual([p["submission"].pk for p in shortlist(new)], [old.pk])

    def test_the_ai_is_given_the_letter_text(self):
        sub = self._paper()
        self._letter(sub, ["Mary Tari"], text="Acting allowance for June to August 2026 as Director.")
        ctx = comparison_context(sub)
        self.assertIn("Acting allowance for June to August 2026", ctx)
        self.assertIn("cover.pdf", ctx)

    # ── AI result handling ─────────────────────────────────────────────────
    def test_sanitize_drops_invented_references_and_unknown_verdicts(self):
        out = _sanitize_result(
            {"confidence": 90, "cases": [
                {"reference": "REAL-1", "verdict": "same_claim", "reason": "Same dates"},
                {"reference": "MADE-UP", "verdict": "same_claim", "reason": "x"},
                {"reference": "REAL-2", "verdict": "banana", "reason": "?"},
            ]},
            allowed_refs={"REAL-1", "REAL-2"},
        )
        self.assertEqual([c["reference"] for c in out["similar_cases"]], ["REAL-1", "REAL-2"])
        self.assertEqual(out["similar_cases"][1]["verdict"], "unclear")
        self.assertTrue(out["is_duplicate"])

    def _run(self, new, ai_result=None, ai_error=None, enabled=True):
        with mock.patch(ENABLED, return_value=enabled), mock.patch(AI, return_value=(ai_result, ai_error)) as ai:
            detect_submission_duplicates(new.pk, force=True)
        new.refresh_from_db()
        return ai

    def test_same_claim_is_flagged_and_secretary_is_told(self):
        new = self._paper(stage=WorkflowStage.RECEIVED_BY_PSC)
        old = self._paper()
        result = {"is_duplicate": True, "confidence": 90, "recommendation": "Same period.",
                  "similar_cases": [{"reference": old.reference_number, "verdict": "same_claim",
                                     "similarity_reason": "Same period", "overlap": "Full overlap"}]}
        self._run(new, result)
        self.assertTrue(new.ai_duplicate_is_duplicate)
        row = new.ai_duplicate_similar_cases[0]
        self.assertEqual((row["submission_id"], row["verdict"]), (old.pk, "same_claim"))
        self.assertEqual(flag_level(new), "warn")
        self.assertTrue(Notification.objects.filter(recipient=self.secretary, submission=new).exists())

    def test_different_period_is_info_and_does_not_notify(self):
        new = self._paper(stage=WorkflowStage.RECEIVED_BY_PSC, period="June to August 2026")
        old = self._paper()
        self._run(new, {"is_duplicate": False, "confidence": 10, "recommendation": "Separate periods.",
                        "similar_cases": [{"reference": old.reference_number, "verdict": "different_period",
                                           "similarity_reason": "Different months"}]})
        self.assertEqual(flag_level(new), "info")
        self.assertFalse(Notification.objects.filter(recipient=self.secretary, submission=new).exists())

    def test_nothing_to_compare_means_no_ai_call_and_no_flag(self):
        new = self._paper(stage=WorkflowStage.RECEIVED_BY_PSC)
        ai = self._run(new, {})
        ai.assert_not_called()
        self.assertTrue(new.ai_duplicate_processed)
        self.assertEqual(flag_level(new), "none")

    def test_ai_off_still_shows_the_earlier_papers(self):
        new = self._paper(stage=WorkflowStage.RECEIVED_BY_PSC)
        old = self._paper()
        ai = self._run(new, enabled=False)
        ai.assert_not_called()
        self.assertEqual(new.ai_duplicate_similar_cases[0]["submission_id"], old.pk)
        self.assertEqual(flag_level(new), "warn")
        self.assertIn("AI check unavailable", new.ai_duplicate_recommendation)

    def test_ai_error_still_shows_the_earlier_papers(self):
        new = self._paper(stage=WorkflowStage.RECEIVED_BY_PSC)
        self._paper()
        self._run(new, ai_error="invalid request")   # not retryable
        self.assertEqual(flag_level(new), "warn")

    # ── trigger, API, access ───────────────────────────────────────────────
    def test_paper_reaching_the_secretary_is_checked(self):
        from tracker.views import SubmissionViewSet

        sub = self._paper(stage=WorkflowStage.SUBMITTED)
        with mock.patch("tracker.tasks.queue_duplicate_detection") as queued, \
                self.captureOnCommitCallbacks(execute=True):
            SubmissionViewSet()._route_submitted_paper(sub)
        sub.refresh_from_db()
        self.assertEqual(sub.current_stage, WorkflowStage.RECEIVED_BY_PSC)
        queued.assert_called_once_with(sub.pk, force=True)

    def _client(self, user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    def test_ministry_cannot_see_the_flag(self):
        sub = self._paper(stage=WorkflowStage.RECEIVED_BY_PSC)
        self.assertEqual(self._client(self.hr).get(f"/api/submissions/{sub.pk}/ai-duplicate/").status_code, 403)
        self.assertEqual(self._client(self.hr).post(f"/api/submissions/{sub.pk}/ai-duplicate/review/").status_code, 403)

    def test_secretary_reads_and_reviews_the_flag(self):
        new = self._paper(stage=WorkflowStage.RECEIVED_BY_PSC)
        old = self._paper()
        self._run(new, {"is_duplicate": True, "confidence": 80, "recommendation": "r",
                        "similar_cases": [{"reference": old.reference_number, "verdict": "same_claim",
                                           "similarity_reason": "Same"}]})
        c = self._client(self.secretary)
        body = c.get(f"/api/submissions/{new.pk}/ai-duplicate/").json()
        self.assertEqual(body["flag_level"], "warn")
        self.assertTrue(body["ai_duplicate_similar_cases"][0]["can_open"])
        body = c.post(f"/api/submissions/{new.pk}/ai-duplicate/review/", {"reviewed": True}, format="json").json()
        self.assertTrue(body["reviewed_at"])
        body = c.post(f"/api/submissions/{new.pk}/ai-duplicate/review/", {"reviewed": False}, format="json").json()
        self.assertIsNone(body["reviewed_at"])

    def test_a_paper_the_user_cannot_open_shows_no_title(self):
        new = self._paper(stage=WorkflowStage.MANAGER_CHECKLIST_REVIEW)
        new.routed_unit = "hr"
        new.save(update_fields=["routed_unit"])
        old = self._paper()   # approved, routed to no unit: not in the HR manager's queue
        self._run(new, {"is_duplicate": False, "confidence": 20, "recommendation": "r",
                        "similar_cases": [{"reference": old.reference_number, "verdict": "unclear",
                                           "similarity_reason": "?"}]})
        row = self._client(self.manager).get(f"/api/submissions/{new.pk}/ai-duplicate/").json()["ai_duplicate_similar_cases"][0]
        self.assertFalse(row["can_open"])
        self.assertNotIn("title", row)

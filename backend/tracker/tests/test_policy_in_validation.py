"""Salary / precedent policy findings now appear in Validate package, as advice only."""
from unittest import mock

from django.test import SimpleTestCase

from tracker.ai import submission_package_validation as spv
from tracker.ai.policy_guardrail import policy_gaps
from tracker.models import WorkflowStage
from tracker.tests.test_policy_guardrail import _FakeSubmission


def _over_ceiling():
    return _FakeSubmission(
        stage=WorkflowStage.DRAFT,
        category_code="salary_adjustment",
        form_data={"post_level": "5", "salary_vt": "450000"},
    )


class PolicyGapsTests(SimpleTestCase):
    def test_not_applicable_gives_nothing(self):
        sub = _FakeSubmission(stage=WorkflowStage.DRAFT, category_code="meeting")
        self.assertEqual(policy_gaps(sub, use_ai=False), [])

    def test_salary_over_ceiling_is_a_warning_never_critical(self):
        gaps = policy_gaps(_over_ceiling(), use_ai=False)
        self.assertEqual(len(gaps), 1)
        self.assertEqual(gaps[0]["severity"], "warning")  # the scan said "high"
        self.assertEqual(gaps[0]["category"], "policy")
        self.assertIn("ceiling", gaps[0]["message"].lower())

    def test_documentation_and_empty_precedent_notes_are_dropped(self):
        scan = {"observations": [
            {"severity": "high", "category": "documentation", "message": "Placeholder text", "evidence": ""},
            {"severity": "high", "category": "documentation", "message": "DG not attested", "evidence": ""},
            {"severity": "low", "category": "precedent", "message": "No precedent on file", "evidence": ""},
            {"severity": "medium", "category": "salary_ceiling", "message": "Near the ceiling", "evidence": "VT 1"},
            {"severity": "low", "category": "policy", "message": "Minor note", "evidence": ""},
        ]}
        with mock.patch("tracker.ai.policy_guardrail.run_policy_guardrail_scan", return_value=scan):
            gaps = policy_gaps(_over_ceiling(), use_ai=True)
        self.assertEqual([(g["severity"], g["message"]) for g in gaps],
                         [("warning", "Near the ceiling (VT 1)"), ("info", "Minor note")])
        self.assertNotIn("critical", {g["severity"] for g in gaps})


class ValidationIntegrationTests(SimpleTestCase):
    def test_rule_based_result_includes_policy_advice_and_stays_ready(self):
        advice = [{"severity": "warning", "category": "policy", "message": "Over ceiling"}]
        with mock.patch.object(spv, "_rule_based_gaps", return_value=[]), \
                mock.patch("tracker.ai.policy_guardrail.policy_gaps", return_value=advice):
            result = spv.rule_based_result(object())
        self.assertEqual(result["gaps"], advice)
        self.assertTrue(result["ready"])

    def test_policy_failure_never_breaks_validation(self):
        sub = mock.Mock(pk=1)
        with mock.patch("tracker.ai.policy_guardrail.policy_gaps", side_effect=RuntimeError("boom")):
            self.assertEqual(spv._policy_gaps(sub, use_ai=True), [])

    def test_critical_document_gap_still_blocks_with_policy_advice(self):
        crit = [{"severity": "critical", "category": "checklist", "message": "Missing X"}]
        advice = [{"severity": "warning", "category": "policy", "message": "Over ceiling"}]
        with mock.patch.object(spv, "_rule_based_gaps", return_value=crit), \
                mock.patch("tracker.ai.policy_guardrail.policy_gaps", return_value=advice):
            result = spv.rule_based_result(object())
        self.assertFalse(result["ready"])
        self.assertEqual(len(result["gaps"]), 2)

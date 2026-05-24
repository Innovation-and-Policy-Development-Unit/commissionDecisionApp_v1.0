"""Tests for policy guardrail rule checks."""
from django.test import SimpleTestCase

from tracker.ai.policy_guardrail import (
    _rule_based_observations,
    policy_guardrail_applies,
    PSC_GRADE_SALARY_CEILINGS_VT,
)
from tracker.models import WorkflowStage


class _FakeCategory:
    def __init__(self, code, name=""):
        self.code = code
        self.name = name


class _FakeFormResponse:
    def __init__(self, data):
        self.data = data


class _FakeSubmission:
    def __init__(self, *, stage, category_code, form_data=None, internal=False):
        self.current_stage = stage
        self.form_category = _FakeCategory(category_code) if category_code else None
        self.is_internal = internal
        self.is_attachment = False
        self.dynamic_form_response = _FakeFormResponse(form_data or {})


class PolicyGuardrailTests(SimpleTestCase):
    def test_applies_to_salary_adjustment_draft(self):
        sub = _FakeSubmission(stage=WorkflowStage.DRAFT, category_code="salary_adjustment")
        self.assertTrue(policy_guardrail_applies(sub))

    def test_salary_above_ceiling(self):
        sub = _FakeSubmission(
            stage=WorkflowStage.DRAFT,
            category_code="salary_adjustment",
            form_data={"post_level": "5", "salary_vt": "450000"},
        )
        obs = _rule_based_observations(sub)
        self.assertTrue(any(o["category"] == "salary_ceiling" for o in obs))
        ceiling = PSC_GRADE_SALARY_CEILINGS_VT["5"]
        self.assertIn(f"{ceiling:,}", obs[0]["evidence"])

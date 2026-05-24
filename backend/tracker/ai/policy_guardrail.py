"""
Pre-emptive policy guardrail scan (draft submissions).

Compares form data against PSC salary reference ceilings and recent commission
decision register outcomes for the same ministry / category.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import timedelta
from typing import Any

from django.utils import timezone

from ..models import CommissionTask, Submission, WorkflowStage
from ..reports.decision_register import build_register_rows
from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

# Annual salary ceiling (VT) — illustrative PSC reference bands for rule checks.
PSC_GRADE_SALARY_CEILINGS_VT: dict[str, int] = {
    "1": 2_400_000,
    "2": 1_800_000,
    "3": 1_400_000,
    "4": 1_100_000,
    "5": 390_000,
    "6": 320_000,
    "7": 280_000,
    "8": 250_000,
    "9": 220_000,
    "10": 200_000,
}

POLICY_CATEGORY_CODES = frozenset({
    "salary_adjustment",
    "appointment",
    "direct_appointment",
    "contract",
    "temporary_salaried",
    "extra_responsibility",
})

SYSTEM = """You are a PSC policy compliance analyst for the Public Service Commission of Vanuatu.

Before a ministry submits a draft package, review the submission against:
1. Salary / grade reference ceilings (when salary or grade fields are present)
2. Patterns in recent commission decisions for the same ministry and submission type
3. Common rejection reasons (missing annexes, weak justification, precedent)

Output valid JSON only:
{
  "confidence_score": 0-100,
  "summary": "One sentence for the submitter — higher score = stronger likelihood of passing PSC review without return",
  "observations": [
    {
      "severity": "high",
      "category": "salary_ceiling",
      "message": "Plain-language observation for the user",
      "evidence": "Short factual basis (numbers, dates, refs)"
    }
  ]
}

Severity: high (likely block or return), medium (fix before submit), low (informational).
Categories: salary_ceiling, precedent, documentation, policy, other.
Use the historical decision register excerpt — do not invent cases not listed.
If data is insufficient, say so in a low-severity observation and set confidence_score around 50-65."""


def policy_guardrail_applies(submission: Submission) -> bool:
    if submission.is_internal or submission.is_attachment:
        return False
    if submission.current_stage != WorkflowStage.DRAFT:
        return False
    cat = submission.form_category
    if not cat:
        return False
    code = (cat.code or "").lower()
    if code in POLICY_CATEGORY_CODES:
        return True
    name = (cat.name or "").lower()
    return any(k in name for k in ("salary", "appointment", "recruit", "contract"))


def _extract_grade_and_salary(submission: Submission) -> tuple[str | None, int | None]:
    """Best-effort parse from dynamic form JSON and legacy form fields."""
    grade: str | None = None
    salary: int | None = None

    try:
        data = submission.dynamic_form_response.data or {}
    except Exception:
        data = {}

    flat = json.dumps(data, ensure_ascii=False, default=str).lower()

    for key in ("post_level", "grade", "salary_grade", "position_grade", "level"):
        val = data.get(key)
        if val:
            m = re.search(r"\d+", str(val))
            if m:
                grade = m.group(0)
                break

    if not grade:
        m = re.search(r"grade\s*(\d{1,2})", flat)
        if m:
            grade = m.group(1)

    for key in ("salary_vt", "proposed_salary", "salary", "annual_salary", "new_salary"):
        val = data.get(key)
        if val is not None and str(val).strip():
            digits = re.sub(r"[^\d]", "", str(val))
            if digits:
                salary = int(digits)
                break

    if salary is None:
        m = re.search(r"(?:vt|vatu)\s*[:=]?\s*([\d,]+)", flat, re.I)
        if m:
            salary = int(re.sub(r"[^\d]", "", m.group(1)))

    return grade, salary


def _rule_based_observations(submission: Submission) -> list[dict[str, str]]:
    observations: list[dict[str, str]] = []
    grade, salary = _extract_grade_and_salary(submission)

    if grade and salary and grade in PSC_GRADE_SALARY_CEILINGS_VT:
        ceiling = PSC_GRADE_SALARY_CEILINGS_VT[grade]
        if salary > ceiling:
            pct = round((salary - ceiling) / ceiling * 100)
            observations.append({
                "severity": "high",
                "category": "salary_ceiling",
                "message": (
                    f"This request for Grade {grade} salary (VT {salary:,}) exceeds the "
                    f"standard PSC reference ceiling (VT {ceiling:,}) by about {pct}%."
                ),
                "evidence": f"Proposed VT {salary:,} vs ceiling VT {ceiling:,}",
            })
        elif salary > ceiling * 0.95:
            observations.append({
                "severity": "medium",
                "category": "salary_ceiling",
                "message": (
                    f"Proposed Grade {grade} salary is within 5% of the PSC reference ceiling — "
                    "ensure exceptional circumstances are documented."
                ),
                "evidence": f"Proposed VT {salary:,}, ceiling VT {ceiling:,}",
            })

    return observations


def fetch_decision_register_excerpt(submission: Submission, *, limit: int = 12) -> list[dict[str, Any]]:
    """Recent commission decisions for precedent context (same ministry when possible)."""
    since = timezone.now() - timedelta(days=400)
    qs = (
        CommissionTask.objects.filter(
            submission__isnull=False,
            created_at__gte=since,
        )
        .exclude(decision_outcome="")
        .select_related("submission", "submission__ministry", "submission__form_category")
        .order_by("-created_at")
    )
    if submission.ministry_id:
        ministry_qs = qs.filter(submission__ministry_id=submission.ministry_id)
        if ministry_qs.exists():
            qs = ministry_qs
        elif submission.form_category_id:
            qs = qs.filter(submission__form_category_id=submission.form_category_id)
    elif submission.form_category_id:
        qs = qs.filter(submission__form_category_id=submission.form_category_id)

    rows = build_register_rows(qs[:40])
    return rows[:limit]


def _summarize_register_for_prompt(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "No recent commission decisions in register for this ministry/category."
    lines = ["Recent decision register (newest first):"]
    for r in rows:
        outcome = r.get("decision_outcome") or "—"
        lines.append(
            f"- {r.get('submission_ref', '—')} | {r.get('submission_title', '')[:80]} | "
            f"outcome={outcome} | {r.get('decision_detail', '')[:120]}"
        )
    rejected = [r for r in rows if "reject" in (r.get("decision_outcome") or "").lower()]
    if rejected:
        lines.append(f"\nRejected in sample: {len(rejected)} of {len(rows)} shown.")
    return "\n".join(lines)


def _normalize_observation(raw: Any) -> dict[str, str] | None:
    if not isinstance(raw, dict):
        return None
    severity = str(raw.get("severity") or "medium").lower()
    if severity not in ("high", "medium", "low"):
        severity = "medium"
    category = str(raw.get("category") or "other").lower()
    message = str(raw.get("message") or "").strip()
    if not message:
        return None
    evidence = str(raw.get("evidence") or "").strip()[:400]
    return {
        "severity": severity,
        "category": category,
        "message": message[:600],
        "evidence": evidence,
    }


def _merge_observations(*lists: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[tuple[str, str]] = set()
    out: list[dict[str, str]] = []
    for obs_list in lists:
        for o in obs_list:
            key = (o.get("message", ""), o.get("category", ""))
            if key in seen:
                continue
            seen.add(key)
            out.append(o)
    return out


def _confidence_from_observations(observations: list[dict[str, str]], ai_score: int | None) -> int:
    if ai_score is not None:
        base = max(0, min(100, int(ai_score)))
    else:
        base = 78
    for o in observations:
        sev = o.get("severity")
        if sev == "high":
            base -= 18
        elif sev == "medium":
            base -= 8
        else:
            base -= 2
    return max(5, min(98, base))


def build_policy_guardrail_context(submission: Submission) -> str:
    """Text context for policy scan (submission + register excerpt)."""
    from ..tasks import build_submission_brief_context

    lines = [build_submission_brief_context(submission), ""]
    grade, salary = _extract_grade_and_salary(submission)
    if grade or salary:
        lines.append(f"Parsed grade: {grade or '—'} | Parsed annual salary (VT): {salary or '—'}")
    cat = submission.form_category
    if cat:
        lines.append(f"Category: {cat.name} ({cat.code})")
    return "\n".join(lines)


def run_policy_guardrail_scan(
    submission: Submission,
    *,
    context: str | None = None,
) -> dict[str, Any]:
    """
    Run policy guardrail (rules + Claude). Returns dict for API persistence.
    """
    rule_obs = _rule_based_observations(submission)
    register_rows = fetch_decision_register_excerpt(submission)
    register_text = _summarize_register_for_prompt(register_rows)

    if not policy_guardrail_applies(submission):
        return {
            "confidence_score": None,
            "summary": "Policy guardrail does not apply to this submission type.",
            "observations": [],
            "skipped": True,
        }

    if not ai_enabled():
        score = _confidence_from_observations(rule_obs, None)
        summary = (
            "Rule-based policy check only (AI not configured). "
            + (f"{len(rule_obs)} issue(s) flagged." if rule_obs else "No rule-based flags.")
        )
        return {
            "confidence_score": score,
            "summary": summary,
            "observations": rule_obs,
            "skipped": False,
        }

    ctx = context or build_policy_guardrail_context(submission)
    tier = FEATURE_MODEL_TIER.get("A6_policy_guardrail", "sonnet")
    data, err = complete_json_with_error(
        system=SYSTEM,
        user=(
            "Smart policy scan before submit.\n\n"
            f"{ctx}\n\n"
            f"{register_text}\n\n"
            "Return observations the ministry submitter should see. "
            "Reference register rows when citing precedent."
        ),
        tier=tier,
        max_tokens=2048,
    )

    if not data or not isinstance(data, dict):
        score = _confidence_from_observations(rule_obs, None)
        return {
            "confidence_score": score,
            "summary": err or "Policy scan could not complete — showing rule-based checks only.",
            "observations": rule_obs,
            "skipped": False,
        }

    ai_obs = []
    for raw in data.get("observations") or []:
        o = _normalize_observation(raw)
        if o:
            ai_obs.append(o)

    observations = _merge_observations(rule_obs, ai_obs)
    ai_score = data.get("confidence_score")
    try:
        ai_score = int(ai_score) if ai_score is not None else None
    except (TypeError, ValueError):
        ai_score = None

    score = _confidence_from_observations(observations, ai_score)
    summary = str(data.get("summary") or "").strip()[:1000]
    if not summary:
        summary = (
            "No major policy flags — confidence is moderate to high."
            if score >= 70
            else "Review observations before submitting."
        )

    return {
        "confidence_score": score,
        "summary": summary,
        "observations": observations,
        "skipped": False,
    }


def persist_policy_guardrail(submission: Submission, result: dict[str, Any]) -> None:
    submission.ai_policy_observations = result.get("observations") or []
    score = result.get("confidence_score")
    submission.ai_policy_confidence = int(score) if score is not None else None
    submission.ai_policy_summary = str(result.get("summary") or "")[:2000]
    submission.ai_policy_processed = True
    submission.ai_policy_generated_at = timezone.now()
    submission.save(
        update_fields=[
            "ai_policy_observations",
            "ai_policy_confidence",
            "ai_policy_summary",
            "ai_policy_processed",
            "ai_policy_generated_at",
            "updated_at",
        ]
    )

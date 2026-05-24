"""
A5 — Submission Quality Score for compliance / unit reviewers.
"""

from __future__ import annotations

import logging
from typing import Any

from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

SYSTEM = """You are a senior PSC compliance and submissions quality reviewer for the
Public Service Commission of Vanuatu (OPSC).

Score the submission package on a 0–100 scale for how much review work a compliance
or unit officer will likely need before it is ready for Commission processing.

Evaluate four dimensions (each 0–100):
1. completeness — required documents, checklist items, form fields, endorsements
2. clarity — title, narrative, structure, unambiguous ask
3. evidence_quality — supporting documents described, relevance, extracted content if any
4. psc_formatting — adherence to PSC form type expectations, references, classification

Rules:
- Be fair and practical; ministry HR submissions vary in digitization.
- Missing checklist items or documents should lower completeness materially.
- If data is sparse, score conservatively and say what is missing.
- review_effort: "low" (score >= 80), "moderate" (60–79), "high" (< 60)

Output valid JSON only:
{
  "score": 78,
  "explanation": "2–4 sentences for the reviewer",
  "dimensions": {
    "completeness": {"score": 80, "note": "one short sentence"},
    "clarity": {"score": 75, "note": "..."},
    "evidence_quality": {"score": 70, "note": "..."},
    "psc_formatting": {"score": 85, "note": "..."}
  },
  "review_effort": "moderate"
}"""


def _clamp_score(val: Any) -> int:
    try:
        n = int(round(float(val)))
    except (TypeError, ValueError):
        return 0
    return max(0, min(100, n))


def _sanitize_result(data: dict[str, Any]) -> dict[str, Any]:
    dims_in = data.get("dimensions") or {}
    dims_out = {}
    for key in ("completeness", "clarity", "evidence_quality", "psc_formatting"):
        block = dims_in.get(key) if isinstance(dims_in, dict) else {}
        if not isinstance(block, dict):
            block = {}
        dims_out[key] = {
            "score": _clamp_score(block.get("score")),
            "note": str(block.get("note") or "").strip()[:500],
        }

    score = _clamp_score(data.get("score"))
    if not data.get("score") and dims_out:
        score = _clamp_score(
            sum(d["score"] for d in dims_out.values()) / len(dims_out)
        )

    effort = str(data.get("review_effort") or "").lower()
    if effort not in ("low", "moderate", "high"):
        effort = "low" if score >= 80 else "moderate" if score >= 60 else "high"

    return {
        "score": score,
        "explanation": str(data.get("explanation") or "").strip()[:2000],
        "dimensions": dims_out,
        "review_effort": effort,
    }


def preliminary_quality_score(submission) -> int | None:
    """
    Instant checklist-based estimate (no API). Shown while Haiku scoring runs.
    """
    if submission.current_stage == "draft":
        return None

    from ..models import SubmissionChecklistItem

    items = SubmissionChecklistItem.objects.filter(submission=submission)
    if items.exists():
        total = items.count()
        present = items.filter(is_present=True).count()
        score = int(40 + 55 * (present / max(total, 1)))
    else:
        score = 72

    if submission.ai_package_processed and not submission.ai_package_ready:
        score -= 12
    critical = sum(
        1 for g in (submission.ai_package_gaps or [])
        if g.get("severity") == "critical"
    )
    score -= min(25, critical * 8)
    return max(0, min(100, score))


def score_submission_from_context(context: str) -> tuple[dict[str, Any] | None, str | None]:
    """Return (result_dict, error_message)."""
    if not ai_enabled():
        return None, "ANTHROPIC_API_KEY is not configured."

    tier = FEATURE_MODEL_TIER.get("A5_quality_score", "haiku")
    data, err = complete_json_with_error(
        system=SYSTEM,
        user=f"Submission package to score:\n\n{context}",
        tier=tier,
        max_tokens=2048,
    )
    if not data or not isinstance(data, dict):
        return None, err or "Empty AI response."

    return _sanitize_result(data), None

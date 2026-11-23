"""
A4 — Duplicate Submission Detector.

Given a new ministry paper and a short list of earlier papers about the same officer (built by
``duplicate_check.shortlist``), say for each earlier paper whether it looks like the same
claim sent twice or a genuinely separate matter. A repeat is often genuine (an allowance for a
different period, for example), so the answer is advice to the Secretary, never a block.
"""

from __future__ import annotations

import logging
from typing import Any

from ..duplicate_check import DIFFERENT_MATTER, DIFFERENT_PERIOD, SAME_CLAIM, UNCLEAR, VERDICTS
from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

SYSTEM = """You are a senior reviewer at the Public Service Commission of Vanuatu (OPSC).

A ministry has just submitted a NEW paper. Below it are EARLIER papers from the same ministry,
of the same form type, that appear to concern the same officer. Decide, for each earlier paper,
whether the new paper is the same claim sent twice, or a genuinely separate matter.

Repeats are often genuine: for example an acting or extra-responsibility allowance for work
done in a different period, or a second allowance for a different role. Compare the periods
and dates, amounts, positions or posts, the reason given and the documents listed. Each paper may include extracts of its uploaded letters (OCR text,
so names and dates can be slightly garbled): the cover letter often states the officer, post and
period when the form does not. Do not
treat a similar title or the same officer alone as a duplicate.

Verdict per earlier paper:
- "same_claim": the same matter and the same period or facts: probably submitted twice.
- "different_period": the same kind of claim but for a clearly different period or occasion.
- "different_matter": the same officer but a different subject or post.
- "unclear": not enough information in the two papers to tell.

Output valid JSON only:
{
  "confidence": 0,
  "cases": [
    {"reference": "SUB-2026-0001", "verdict": "different_period",
     "reason": "Acting allowance for Mar-May 2026; this paper covers Jun-Aug 2026.",
     "overlap": "No overlap in dates."}
  ],
  "recommendation": "One or two sentences for the Secretary."
}

Rules:
- Use only references that appear in the EARLIER papers. Never invent one.
- confidence: 0-100, how sure you are that the NEW paper repeats an earlier one.
- reason: one sentence naming the facts you compared (dates, amounts, post). Be specific.
- overlap: say if the dates or amounts overlap, otherwise "".
- If the papers do not state periods or dates, say so and use "unclear" rather than guessing."""


def _sanitize_result(data: dict[str, Any], allowed_refs: set[str] | None = None) -> dict[str, Any]:
    try:
        confidence = max(0, min(100, int(data.get("confidence", 0))))
    except (TypeError, ValueError):
        confidence = 0

    cases = data.get("cases", data.get("similar_cases", []))
    if not isinstance(cases, list):
        cases = []
    cleaned = []
    for item in cases:
        if not isinstance(item, dict):
            continue
        ref = str(item.get("reference", "")).strip()[:50]
        if allowed_refs is not None and ref not in allowed_refs:
            continue  # never keep a reference the model made up
        verdict = str(item.get("verdict", UNCLEAR)).strip().lower()
        if verdict not in VERDICTS:
            verdict = UNCLEAR
        cleaned.append({
            "reference": ref,
            "verdict": verdict,
            "similarity_reason": str(item.get("reason", item.get("similarity_reason", ""))).strip()[:500],
            "overlap": str(item.get("overlap", "")).strip()[:300],
        })

    is_dup = any(c["verdict"] == SAME_CLAIM for c in cleaned) and confidence >= 60
    return {
        "is_duplicate": is_dup,
        "confidence": confidence,
        "similar_cases": cleaned[:6],
        "recommendation": str(data.get("recommendation", "")).strip()[:2000],
    }


def detect_duplicates(
    submission_context: str,
    existing_cases_context: str,
    allowed_refs: set[str] | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """Return (result_dict, error_message)."""
    if not ai_enabled():
        return None, "GEMINI_API_KEY is not configured."

    tier = FEATURE_MODEL_TIER.get("A4_duplicate_detector", "sonnet")
    user_prompt = (
        f"NEW paper:\n\n{submission_context}\n\n"
        f"EARLIER papers about the same officer:\n\n{existing_cases_context or 'None'}"
    )
    data, err = complete_json_with_error(
        system=SYSTEM,
        user=user_prompt,
        tier=tier,
        max_tokens=2048,
    )
    if not data or not isinstance(data, dict):
        return None, err or "Empty AI response."

    return _sanitize_result(data, allowed_refs), None

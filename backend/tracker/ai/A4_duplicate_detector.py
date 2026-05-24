"""
A4 — Duplicate Submission Detector.
Detects semantic similarity between a new submission and existing ones.
"""

from __future__ import annotations

import logging
from typing import Any

from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

SYSTEM = """You are a PSC senior reviewer checking for duplicate cases at the
Public Service Commission of Vanuatu (OPSC).

Your task is to assess whether a new submission is a duplicate or near-duplicate
of existing submissions in the system.

Consider semantic similarity: same officer, same allegation type, same ministry
action, same timeframe, or substantially identical subject matter — even if
worded differently.

Output valid JSON only:
{
  "is_duplicate": false,
  "confidence": 0,
  "similar_cases": [
    {"reference": "PSC-2025-0001", "similarity_reason": "Same officer, same misconduct allegation"}
  ],
  "recommendation": "Proceed as new submission — no significant overlap found."
}

Rules:
- confidence: 0–100 (100 = certain duplicate)
- is_duplicate: true only when confidence >= 70
- similar_cases: list up to 5 most similar cases with reasons
- If no similar cases, return empty list and is_duplicate: false"""


def _sanitize_result(data: dict[str, Any]) -> dict[str, Any]:
    try:
        confidence = max(0, min(100, int(data.get("confidence", 0))))
    except (TypeError, ValueError):
        confidence = 0

    similar = data.get("similar_cases", [])
    if not isinstance(similar, list):
        similar = []
    sanitized_similar = []
    for item in similar[:5]:
        if isinstance(item, dict):
            sanitized_similar.append({
                "reference": str(item.get("reference", ""))[:50],
                "similarity_reason": str(item.get("similarity_reason", ""))[:500],
            })

    is_dup = bool(data.get("is_duplicate", False))
    if confidence < 70:
        is_dup = False

    return {
        "is_duplicate": is_dup,
        "confidence": confidence,
        "similar_cases": sanitized_similar,
        "recommendation": str(data.get("recommendation", "")).strip()[:2000],
    }


def detect_duplicates(
    submission_context: str,
    existing_cases_context: str,
) -> tuple[dict[str, Any] | None, str | None]:
    """Return (result_dict, error_message)."""
    if not ai_enabled():
        return None, "ANTHROPIC_API_KEY is not configured."

    tier = FEATURE_MODEL_TIER.get("A4_duplicate_detector", "sonnet")
    user_prompt = (
        f"New submission to check:\n\n{submission_context}\n\n"
        f"Existing submissions in the same ministry (last 50):\n\n{existing_cases_context or 'None'}"
    )
    data, err = complete_json_with_error(
        system=SYSTEM,
        user=user_prompt,
        tier=tier,
        max_tokens=2048,
    )
    if not data or not isinstance(data, dict):
        return None, err or "Empty AI response."

    return _sanitize_result(data), None

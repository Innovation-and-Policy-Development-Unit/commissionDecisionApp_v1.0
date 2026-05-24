"""
F1 — Smart Routing / Assignment Suggestion.
Suggests best-fit PSC officer for a new submission based on workload and specialization.
"""

from __future__ import annotations

import logging
from typing import Any

from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

SYSTEM = """You are a PSC workflow coordinator optimising case assignment for the
Vanuatu Public Service Commission (OPSC).

Your task is to suggest the best PSC officer to handle a new submission based on:
1. Current workload (active case count, overdue cases)
2. Specialization match (form type, ministry, case type)
3. Role suitability (senior officer for complex/high-risk cases)
4. Equitable distribution of work

Output valid JSON only:
{
  "suggested_officer_username": "jsmith",
  "reason": "Lowest current workload (2 active cases) and handled 3 similar appointment submissions this month.",
  "confidence": 82,
  "alternatives": [
    {"username": "mbrown", "reason": "Suitable specialization but higher workload (6 cases)"},
    {"username": "kpere", "reason": "Available and experienced with discipline submissions"}
  ]
}

Rules:
- suggested_officer_username: exact username from the officers list provided
- confidence: 0–100
- reason: 1–2 sentences explaining the primary recommendation
- alternatives: up to 2 alternative officers with reasons
- If no officers available, set suggested_officer_username to empty string and confidence to 0"""


def _sanitize_result(data: dict[str, Any]) -> dict[str, Any]:
    try:
        confidence = max(0, min(100, int(data.get("confidence", 0))))
    except (TypeError, ValueError):
        confidence = 0

    alternatives = data.get("alternatives", [])
    if not isinstance(alternatives, list):
        alternatives = []
    sanitized_alts = []
    for alt in alternatives[:2]:
        if isinstance(alt, dict):
            sanitized_alts.append({
                "username": str(alt.get("username", ""))[:150],
                "reason": str(alt.get("reason", ""))[:300],
            })

    return {
        "suggested_officer_username": str(data.get("suggested_officer_username", "")).strip()[:150],
        "reason": str(data.get("reason", "")).strip()[:500],
        "confidence": confidence,
        "alternatives": sanitized_alts,
    }


def suggest_assignment(
    submission_context: str,
    officers_context: str,
) -> tuple[dict[str, Any] | None, str | None]:
    """Return (result_dict, error_message)."""
    if not ai_enabled():
        return None, "ANTHROPIC_API_KEY is not configured."

    tier = FEATURE_MODEL_TIER.get("F1_smart_routing", "haiku")
    user_prompt = (
        f"New submission to assign:\n\n{submission_context}\n\n"
        f"Available officers and their current workload:\n\n{officers_context}"
    )
    data, err = complete_json_with_error(
        system=SYSTEM,
        user=user_prompt,
        tier=tier,
        max_tokens=1024,
    )
    if not data or not isinstance(data, dict):
        return None, err or "Empty AI response."

    return _sanitize_result(data), None

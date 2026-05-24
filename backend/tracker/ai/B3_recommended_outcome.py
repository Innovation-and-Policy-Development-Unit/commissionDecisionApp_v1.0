"""
B3 — Recommended Outcome for PSC submissions.
Recommends commission decision outcome based on submission facts and regulations.
"""

from __future__ import annotations

import logging
from typing import Any

from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

SYSTEM = """You are a senior PSC legal advisor for the Vanuatu Public Service Commission
with expertise in the PSC Act [CAP. 246] and Public Service Regulations.

Your task is to recommend a commission decision outcome based on the submission facts,
applicable regulations, and any relevant precedents.

Analyse:
1. Compliance with PSC Act and Public Service Staff Manual
2. Completeness and quality of the submission package
3. Factual basis of the request / allegation
4. Historical precedents for similar cases
5. Risk and equity considerations

Output valid JSON only:
{
  "recommended_outcome": "approve",
  "confidence": 72,
  "rationale": "The submission meets all procedural requirements under Section 36 of the PSC Act...",
  "conditions": [
    "Ministry must provide signed employment agreement within 30 days",
    "Position must be budgeted before implementation"
  ],
  "precedents": [
    {"reference": "PSC-2024-0145", "relevance": "Similar temporary employment request approved with same conditions"}
  ],
  "legal_basis": "Public Service Act [CAP. 246], Section 36; Public Service Staff Manual Chapter 4"
}

Rules:
- recommended_outcome: one of "approve", "reject", "defer", "approve_with_conditions"
- confidence: 0–100
- rationale: 2–5 sentences explaining the recommendation
- conditions: list if approve_with_conditions (may be empty for other outcomes)
- precedents: up to 3 most relevant, may be empty if none found
- legal_basis: specific Act sections, regulations, or manual chapters"""


def _sanitize_result(data: dict[str, Any]) -> dict[str, Any]:
    outcome = str(data.get("recommended_outcome", "")).lower()
    valid_outcomes = ("approve", "reject", "defer", "approve_with_conditions")
    if outcome not in valid_outcomes:
        outcome = "defer"

    try:
        confidence = max(0, min(100, int(data.get("confidence", 0))))
    except (TypeError, ValueError):
        confidence = 0

    conditions = data.get("conditions", [])
    if not isinstance(conditions, list):
        conditions = []
    sanitized_conditions = [str(c)[:300] for c in conditions[:10] if c]

    precedents = data.get("precedents", [])
    if not isinstance(precedents, list):
        precedents = []
    sanitized_precedents = []
    for p in precedents[:3]:
        if isinstance(p, dict):
            sanitized_precedents.append({
                "reference": str(p.get("reference", ""))[:50],
                "relevance": str(p.get("relevance", ""))[:300],
            })

    return {
        "recommended_outcome": outcome,
        "confidence": confidence,
        "rationale": str(data.get("rationale", "")).strip()[:3000],
        "conditions": sanitized_conditions,
        "precedents": sanitized_precedents,
        "legal_basis": str(data.get("legal_basis", "")).strip()[:2000],
    }


def recommend_outcome(
    submission_context: str,
) -> tuple[dict[str, Any] | None, str | None]:
    """Return (result_dict, error_message)."""
    if not ai_enabled():
        return None, "ANTHROPIC_API_KEY is not configured."

    tier = FEATURE_MODEL_TIER.get("B3_recommended_outcome", "sonnet")
    data, err = complete_json_with_error(
        system=SYSTEM,
        user=f"Submission to evaluate:\n\n{submission_context}",
        tier=tier,
        max_tokens=3000,
    )
    if not data or not isinstance(data, dict):
        return None, err or "Empty AI response."

    return _sanitize_result(data), None

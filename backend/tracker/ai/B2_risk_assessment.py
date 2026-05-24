"""
B2 — Risk Assessment for PSC submissions.
Assesses discipline, misconduct, appointment risk.
"""

from __future__ import annotations

import logging
from typing import Any

from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

SYSTEM = """You are a PSC risk analyst for the Vanuatu Public Service Commission (OPSC).

Your task is to assess the risk level of a PSC submission, covering:
- Discipline risk: severity of alleged misconduct, strength of evidence
- Appointment risk: compliance with PSC Act / Public Service Regulations
- Procedural risk: missing documents, improper endorsements, SLA breaches
- Reputational risk: seniority of officer, public interest, media sensitivity

Output valid JSON only:
{
  "risk_score": 45,
  "risk_level": "medium",
  "factors": [
    {"factor": "Senior officer involved", "impact": "Increases reputational exposure", "weight": 25},
    {"factor": "Complete documentation", "impact": "Reduces procedural risk", "weight": -10}
  ],
  "mitigation_suggestions": [
    "Request additional supporting evidence from ministry before scheduling",
    "Verify position description is current and approved"
  ],
  "recommendation": "Proceed with standard assessment but flag for senior reviewer."
}

Rules:
- risk_score: 0–100 (higher = more risk)
- risk_level: "low" (0–30), "medium" (31–60), "high" (61–80), "critical" (81–100)
- factors: up to 8, each with factor, impact, weight (negative = reduces risk)
- mitigation_suggestions: 2–5 practical suggestions
- recommendation: one actionable sentence for the case officer"""


def _sanitize_result(data: dict[str, Any]) -> dict[str, Any]:
    try:
        score = max(0, min(100, int(data.get("risk_score", 0))))
    except (TypeError, ValueError):
        score = 0

    level = str(data.get("risk_level", "")).lower()
    if level not in ("low", "medium", "high", "critical"):
        if score <= 30:
            level = "low"
        elif score <= 60:
            level = "medium"
        elif score <= 80:
            level = "high"
        else:
            level = "critical"

    factors = data.get("factors", [])
    if not isinstance(factors, list):
        factors = []
    sanitized_factors = []
    for f in factors[:8]:
        if isinstance(f, dict):
            try:
                weight = int(f.get("weight", 0))
            except (TypeError, ValueError):
                weight = 0
            sanitized_factors.append({
                "factor": str(f.get("factor", ""))[:200],
                "impact": str(f.get("impact", ""))[:300],
                "weight": weight,
            })

    mitigation = data.get("mitigation_suggestions", [])
    if not isinstance(mitigation, list):
        mitigation = []
    sanitized_mitigation = [str(m)[:300] for m in mitigation[:5] if m]

    return {
        "risk_score": score,
        "risk_level": level,
        "factors": sanitized_factors,
        "mitigation_suggestions": sanitized_mitigation,
        "recommendation": str(data.get("recommendation", "")).strip()[:2000],
    }


def assess_risk(
    submission_context: str,
) -> tuple[dict[str, Any] | None, str | None]:
    """Return (result_dict, error_message)."""
    if not ai_enabled():
        return None, "ANTHROPIC_API_KEY is not configured."

    tier = FEATURE_MODEL_TIER.get("B2_risk_assessment", "sonnet")
    data, err = complete_json_with_error(
        system=SYSTEM,
        user=f"Submission to assess:\n\n{submission_context}",
        tier=tier,
        max_tokens=2048,
    )
    if not data or not isinstance(data, dict):
        return None, err or "Empty AI response."

    return _sanitize_result(data), None

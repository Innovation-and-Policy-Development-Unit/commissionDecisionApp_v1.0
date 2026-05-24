"""
A2 — Classify submission documents on upload (filename + optional extracted text).
"""

from __future__ import annotations

import re
from typing import Any

from ..models import DocumentClassificationType
from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

VALID_TYPES = {c.value for c in DocumentClassificationType}

SYSTEM = """You classify documents uploaded to the Vanuatu Public Service Commission submission portal.

Choose exactly one document_type from this list:
- appointment_letter
- medical_certificate
- psc_form
- position_description
- dg_endorsement
- organisational_chart
- legislation_policy
- financial_costing
- correspondence
- supporting_evidence
- minutes_report
- other
- unclassified (only if truly unclear)

Use filename, user description, and extracted text when provided.

Output valid JSON only:
{
  "document_type": "appointment_letter",
  "confidence": 85,
  "note": "Optional short reason (max 12 words)"
}"""


def _filename_hint(original_name: str) -> tuple[str, int] | None:
    n = (original_name or "").lower()
    rules = [
        (r"medical|doctor|sick|fitness|health", DocumentClassificationType.MEDICAL_CERTIFICATE, 70),
        (r"appointment|offer.?letter|posting", DocumentClassificationType.APPOINTMENT_LETTER, 72),
        (r"position.?desc|job.?desc|jd\b|p\.?d\.", DocumentClassificationType.POSITION_DESCRIPTION, 75),
        (r"endorse|dg.?letter|head.?of.?agency", DocumentClassificationType.DG_ENDORSEMENT, 74),
        (r"org.?chart|organisation|organizational", DocumentClassificationType.ORGANISATIONAL_CHART, 70),
        (r"psc.?[0-9]|form.?3|form.?2|form.?37", DocumentClassificationType.PSC_FORM, 78),
        (r"act\.|regulation|policy|circular|legislation", DocumentClassificationType.LEGISLATION_POLICY, 68),
        (r"cost|budget|financial|salary|funding", DocumentClassificationType.FINANCIAL_COSTING, 68),
        (r"minute|transcript|report", DocumentClassificationType.MINUTES_REPORT, 65),
        (r"memo|letter|correspondence|email", DocumentClassificationType.CORRESPONDENCE, 60),
    ]
    for pattern, dtype, conf in rules:
        if re.search(pattern, n):
            return dtype, conf
    return None


def classify_document_from_signals(
    *,
    original_name: str,
    description: str = "",
    extracted_text: str = "",
    extracted_facts: dict | None = None,
) -> dict[str, Any]:
    """
    Return {document_type, confidence (0-100), note}.
    Uses Haiku when available; filename rules as fallback.
    """
    hint = _filename_hint(original_name)
    text_snip = (extracted_text or "")[:4000]
    if extracted_facts and isinstance(extracted_facts, dict):
        summary = extracted_facts.get("document_summary") or ""
        if summary:
            text_snip = f"{summary}\n\n{text_snip}"[:5000]

    user_parts = [
        f"Filename: {original_name}",
        f"User description: {description or '—'}",
    ]
    if text_snip.strip():
        user_parts.append(f"Extracted text (snippet):\n{text_snip[:3500]}")

    if not ai_enabled():
        if hint:
            dtype, conf = hint
            return {"document_type": dtype, "confidence": conf, "note": "Classified from filename (AI off)."}
        return {
            "document_type": DocumentClassificationType.OTHER,
            "confidence": 40,
            "note": "AI unavailable; default type.",
        }

    tier = FEATURE_MODEL_TIER.get("A2_document_classification", "haiku")
    data, err = complete_json_with_error(
        system=SYSTEM,
        user="\n".join(user_parts),
        tier=tier,
        max_tokens=256,
    )
    if not data or not isinstance(data, dict):
        if hint:
            dtype, conf = hint
            return {"document_type": dtype, "confidence": conf, "note": err or "Filename fallback."}
        return {
            "document_type": DocumentClassificationType.UNCLASSIFIED,
            "confidence": 30,
            "note": err or "Classification failed.",
        }

    dtype = str(data.get("document_type") or "").lower().strip()
    if dtype not in VALID_TYPES:
        dtype = hint[0] if hint else DocumentClassificationType.OTHER

    try:
        confidence = int(round(float(data.get("confidence", 0))))
    except (TypeError, ValueError):
        confidence = hint[1] if hint else 50
    confidence = max(0, min(100, confidence))

    note = str(data.get("note") or "").strip()[:255]
    return {"document_type": dtype, "confidence": confidence, "note": note}

"""
Bislama ↔ English for ministry communications (Haiku).
Extends deadline reminders and returned-for-clarification remarks.
"""

from __future__ import annotations

from typing import Any

from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

SYSTEM = """You help PSC Secretariat communicate with Vanuatu ministries in English and Bislama.

Output valid JSON only:
{
  "english": "formal English text",
  "bislama": "Bislama translation (respectful, clear for ministry HR officers)",
  "notes": "optional brief note for secretariat (max 20 words)"
}

Keep legal/formal tone in English. Bislama should be understandable to public servants, not slang-heavy."""


def translate_ministry_comms(*, english_text: str, context: str = "") -> dict[str, Any]:
    if not english_text.strip():
        return {"english": "", "bislama": "", "notes": ""}
    if not ai_enabled():
        return {
            "english": english_text,
            "bislama": "",
            "notes": "ANTHROPIC_API_KEY not configured — Bislama not generated.",
        }

    tier = FEATURE_MODEL_TIER.get("F2_deadline_notifications", "haiku")
    data, err = complete_json_with_error(
        system=SYSTEM,
        user=f"Context:\n{context}\n\nEnglish source:\n{english_text}",
        tier=tier,
        max_tokens=2048,
    )
    if not data:
        return {
            "english": english_text,
            "bislama": "",
            "notes": err or "Translation failed.",
        }
    return {
        "english": str(data.get("english") or english_text).strip(),
        "bislama": str(data.get("bislama") or "").strip(),
        "notes": str(data.get("notes") or "").strip()[:200],
    }


def enrich_deadline_draft_bilingual(*, subject: str, body: str, case_context: str) -> dict[str, str]:
    """Add Bislama companion lines for deadline email drafts."""
    result = translate_ministry_comms(
        english_text=f"Subject: {subject}\n\n{body}",
        context=f"Deadline reminder email.\n{case_context}",
    )
    return {
        "subject_bi": result.get("bislama", "").split("\n")[0][:500] if result.get("bislama") else "",
        "body_bi": result.get("bislama", ""),
        "body_en": result.get("english", body),
    }

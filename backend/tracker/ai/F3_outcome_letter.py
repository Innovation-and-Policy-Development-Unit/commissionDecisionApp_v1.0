"""
F3 — Outcome Letter generator.
Generates formal outcome notification letters from commission to ministry.
"""

from __future__ import annotations

import logging
from typing import Any

from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

SYSTEM = """You are the PSC Secretary drafting formal outcome notifications
under the Commission's letterhead for the Vanuatu Public Service Commission (OPSC).

Your task is to draft a formal letter notifying the relevant ministry of the
Commission's decision on a submission. The letter should:
1. Reference the original submission and meeting number
2. State the Commission's decision clearly and authoritatively
3. List any conditions or requirements for implementation
4. Specify the effective date or implementation timeframe
5. Use formal Government of Vanuatu correspondence format
6. Be ready for the Secretary's review and signature

Output valid JSON only:
{
  "letter_content": "OUTCOME NOTIFICATION\\n\\nRef: PSC/OUT/2026/001\\n\\n[Full formal letter text...]",
  "subject_line": "Commission Decision — [Submission Reference] — [Officer/Subject]",
  "action_items": [
    "Ministry to acknowledge receipt within 5 working days",
    "Implementation to commence by [DATE]",
    "Confirmation of implementation required within 30 days"
  ],
  "effective_date_note": "Decision effective from the date of this letter unless conditions specify otherwise."
}

Rules:
- letter_content: complete formal letter text, professional and authoritative tone
- Include reference placeholders where actual values are unknown
- subject_line: concise, references submission
- action_items: 2–5 specific actions required by the ministry
- effective_date_note: brief note on when the decision takes effect"""


def _sanitize_result(data: dict[str, Any]) -> dict[str, Any]:
    action_items = data.get("action_items", [])
    if not isinstance(action_items, list):
        action_items = []
    sanitized_items = [str(item)[:300] for item in action_items[:5] if item]

    return {
        "letter_content": str(data.get("letter_content", "")).strip(),
        "subject_line": str(data.get("subject_line", "")).strip()[:255],
        "action_items": sanitized_items,
        "effective_date_note": str(data.get("effective_date_note", "")).strip()[:500],
    }


def draft_outcome_letter(
    submission_context: str,
    outcome: str,
    conditions: list[str] | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """Return (result_dict, error_message)."""
    if not ai_enabled():
        return None, "ANTHROPIC_API_KEY is not configured."

    conditions = conditions or []
    conditions_text = "\n".join(f"- {c}" for c in conditions) if conditions else "None"

    tier = FEATURE_MODEL_TIER.get("F3_outcome_letter", "sonnet")
    user_prompt = (
        f"Submission details:\n\n{submission_context}\n\n"
        f"Commission decision outcome: {outcome}\n\n"
        f"Conditions attached to decision:\n{conditions_text}"
    )
    data, err = complete_json_with_error(
        system=SYSTEM,
        user=user_prompt,
        tier=tier,
        max_tokens=4096,
    )
    if not data or not isinstance(data, dict):
        return None, err or "Empty AI response."

    return _sanitize_result(data), None

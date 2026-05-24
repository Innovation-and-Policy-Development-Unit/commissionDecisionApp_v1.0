"""
B5 — Notice of Allegation letter drafter.
Drafts formal Notice of Allegation letters for discipline submissions.
"""

from __future__ import annotations

import logging
from typing import Any

from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

SYSTEM = """You are a PSC legal drafter for formal notices under the
Public Service Act [CAP. 246] and Public Service Regulations.

Your task is to draft a formal Notice of Allegation letter that:
1. Clearly identifies the officer and their post
2. States the specific allegations with factual basis
3. References the relevant sections of the Public Service Act / Staff Manual
4. Invites the officer to respond in writing within the specified timeframe
5. Uses formal, professional language appropriate for official PSC correspondence
6. Follows standard Government of Vanuatu correspondence format

Output valid JSON only:
{
  "letter_content": "NOTICE OF ALLEGATION\\n\\nRef: PSC/DISC/2026/001\\n\\n[Full formal letter text...]",
  "subject_line": "Notice of Allegation — [Officer Name] — [Post Title]",
  "key_points": [
    "Allegation 1: Misconduct under Section 47(1)(a) of the PSC Act",
    "Response deadline: 14 days from receipt",
    "Right to be heard confirmed"
  ],
  "response_deadline_days": 14
}

Rules:
- letter_content: complete, formal letter text ready for review and signature
- Include reference number placeholder if not provided
- Include date placeholder [DATE] if actual date not known
- subject_line: concise and professional
- key_points: 3–6 bullet points summarising the notice
- response_deadline_days: integer, default 14"""


def _sanitize_result(data: dict[str, Any]) -> dict[str, Any]:
    key_points = data.get("key_points", [])
    if not isinstance(key_points, list):
        key_points = []
    sanitized_points = [str(p)[:300] for p in key_points[:6] if p]

    try:
        deadline_days = int(data.get("response_deadline_days", 14))
        deadline_days = max(7, min(60, deadline_days))
    except (TypeError, ValueError):
        deadline_days = 14

    return {
        "letter_content": str(data.get("letter_content", "")).strip(),
        "subject_line": str(data.get("subject_line", "")).strip()[:255],
        "key_points": sanitized_points,
        "response_deadline_days": deadline_days,
    }


def draft_notice_of_allegation(
    submission_context: str,
    response_deadline_days: int = 14,
) -> tuple[dict[str, Any] | None, str | None]:
    """Return (result_dict, error_message)."""
    if not ai_enabled():
        return None, "ANTHROPIC_API_KEY is not configured."

    tier = FEATURE_MODEL_TIER.get("B5_draft_notice", "sonnet")
    user_prompt = (
        f"Submission details:\n\n{submission_context}\n\n"
        f"Officer response deadline: {response_deadline_days} days from receipt of notice."
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

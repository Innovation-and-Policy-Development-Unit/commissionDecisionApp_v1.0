"""Claude formatter for structured minute intake (English notes → PSC-style blocks)."""

from __future__ import annotations

from typing import Any

from .claude_client import complete_json_with_error
from .feature_registry import get_model_tier

FORMAT_SYSTEM = (
    "You are a Vanuatu Public Service Commission Secretariat minute-writer. "
    "The minute-taker has recorded plain English notes during the sitting. "
    "Your job is to turn those notes into formal Commission minute wording only. "
    "Do not invent facts, names, or outcomes that are not implied by the notes. "
    "Use formal English suitable for the official minutes register."
)


def build_format_user_prompt(
    *,
    meeting_info: str,
    agenda_title: str,
    agenda_description: str,
    submission_ref: str,
    category_display: str,
    discussion_notes: str,
    decision_text: str,
    action_officer: str,
) -> str:
    return f"""Meeting:
{meeting_info}

Agenda item:
- Category: {category_display}
- Reference: {submission_ref or "N/A"}
- Title: {agenda_title}
- Agenda description (from approved agenda): {agenda_description or "Not provided."}

Minute-taker's raw notes (plain English — format only, do not add new substance):
Discussion notes:
{discussion_notes or "(none)"}

Decision notes:
{decision_text or "(none)"}

Action officer named: {action_officer or "(none)"}

Return valid JSON only with this schema:
{{
  "discussion": "2–4 sentences formal discussion paragraph for the minutes",
  "decision": "Formal resolution wording (e.g. APPROVED / NOT APPROVED / DEFERRED …)",
  "decision_type": "approved|rejected|deferred|returned|tabled|noted|other",
  "action_items": [
    {{"action": "string", "responsible": "string", "deadline": "string or null"}}
  ]
}}

If action_officer is provided, include at least one action_items entry with that responsible party when an action is implied.
Use decision_type "noted" when the item was noted only without a formal approval.
"""


def format_minute_intake_item(
    *,
    meeting_info: str,
    agenda_title: str,
    agenda_description: str,
    submission_ref: str,
    category_display: str,
    discussion_notes: str,
    decision_text: str,
    action_officer: str,
) -> tuple[dict[str, Any] | None, str | None]:
    """Returns (formatted dict, error_message)."""
    user = build_format_user_prompt(
        meeting_info=meeting_info,
        agenda_title=agenda_title,
        agenda_description=agenda_description,
        submission_ref=submission_ref,
        category_display=category_display,
        discussion_notes=discussion_notes,
        decision_text=decision_text,
        action_officer=action_officer,
    )
    return complete_json_with_error(
        system=FORMAT_SYSTEM,
        user=user,
        tier=get_model_tier("minute_intake_format"),
        max_tokens=4096,
    )

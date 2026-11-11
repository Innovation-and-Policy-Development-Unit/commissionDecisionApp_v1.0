"""Claude formatter for structured minute intake (English notes → PSC-style blocks)."""

from __future__ import annotations

from typing import Any

from .claude_client import complete_json_with_error
from .feature_registry import get_model_tier

FORMAT_SYSTEM = (
    "You are a Vanuatu Public Service Commission Secretariat minute-writer. "
    "The minute-taker has recorded the outcome of each agenda item during the sitting, "
    "sometimes with plain English notes and sometimes only by selecting the decision. "
    "Your job is to turn that record into formal Commission minute wording. "
    "Do not invent facts, names, or outcomes. Never attribute views, questions or remarks "
    "to members unless the minute-taker's notes record them. "
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
    selected_decision: str = "",
    selected_decision_label: str = "",
    submission_summary: str = "",
) -> str:
    if selected_decision:
        decision_rule = (
            f'The minute-taker selected the decision "{selected_decision_label or selected_decision}". '
            f'That is the outcome: "decision_type" must be "{selected_decision}" and the "decision" '
            "wording must state it. Use the decision notes only for conditions, dates or detail."
        )
    else:
        decision_rule = "No decision was selected from the list; take the outcome from the decision notes."
    return f"""Meeting:
{meeting_info}

Agenda item:
- Category: {category_display}
- Reference: {submission_ref or "N/A"}
- Title: {agenda_title}
- Agenda description (from approved agenda): {agenda_description or "Not provided."}

Summary of the submission before the Commission (from the paper itself):
{submission_summary or "Not available."}

Decision selected by the minute-taker: {selected_decision_label or "(none selected)"}

Minute-taker's raw notes (plain English):
Discussion notes:
{discussion_notes or "(none)"}

Decision notes:
{decision_text or "(none)"}

How to write this item:
- {decision_rule}
- "discussion": start from the submission summary to state what the Commission had before it
  and what it was asked to decide. Then fold in the minute-taker's discussion notes, if any.
- If there are no discussion notes, write only what the submission was about and that the
  Commission considered it. Do not describe any debate, questions or views.
- Do not add facts that are in neither the summary nor the notes.

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
    selected_decision: str = "",
    selected_decision_label: str = "",
    submission_summary: str = "",
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
        selected_decision=selected_decision,
        selected_decision_label=selected_decision_label,
        submission_summary=submission_summary,
    )
    return complete_json_with_error(
        system=FORMAT_SYSTEM,
        user=user,
        tier=get_model_tier("minute_intake_format"),
        max_tokens=4096,
    )

"""
D2 — Submission Status Chatbot.

Ministry HR and other authorised users ask natural-language status questions;
answers use live submission data (Haiku) in plain English.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime

from .claude_client import ai_enabled, complete_chat_with_error
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

# PSC-2026-00042 or PSC-2026-42
_REF_PATTERN = re.compile(
    r"\bPSC[-/]?(\d{4})[-/]?(\d{1,5})\b",
    re.IGNORECASE,
)
_MY_CASES_PATTERN = re.compile(
    r"\b(my|our)\s+(case|cases|submission|submissions|matter|matters|status)\b",
    re.IGNORECASE,
)
_MAX_HISTORY = 12


def _normalise_ref(year: str, seq: str) -> str:
    return f"PSC-{year}-{int(seq):05d}"


def extract_reference_numbers(message: str) -> list[str]:
    refs = []
    seen = set()
    for m in _REF_PATTERN.finditer(message or ""):
        ref = _normalise_ref(m.group(1), m.group(2))
        if ref not in seen:
            seen.add(ref)
            refs.append(ref)
    return refs


def _submission_queryset(user):
    from tracker.views import _submission_queryset_for

    return _submission_queryset_for(user)


def _format_dt(dt) -> str:
    if not dt:
        return "—"
    if isinstance(dt, datetime):
        return dt.strftime("%d %b %Y %H:%M")
    return str(dt)


def _build_submission_block(sub) -> str:
    from tracker.models import SubmissionChecklistItem, WorkflowEvent

    lines = [
        f"Reference: {sub.reference_number}",
        f"Title: {sub.title}",
        f"Form type: {sub.form_type_code or '—'}",
        f"Ministry: {sub.ministry.name if sub.ministry_id else '—'}",
        f"Department: {sub.department.name if sub.department_id else '—'}",
        f"Current stage: {sub.get_current_stage_display()} (code: {sub.current_stage})",
        f"Received: {_format_dt(sub.received_at)}",
        f"Assessment deadline: {_format_dt(sub.assessment_deadline_at)}",
        f"Assessment overdue: {'Yes' if sub.is_assessment_overdue else 'No'}",
        f"Closing deadline: {_format_dt(sub.closing_deadline_at)}",
        f"Assigned PSC officer: {sub.assigned_to.get_full_name() or sub.assigned_to.username if sub.assigned_to_id else 'Not yet assigned'}",
        f"Notes on file: {sub.notes[:500] if sub.notes else '—'}",
    ]
    if sub.cms_case_reference or sub.cms_case_id:
        lines.append(f"Linked CMS case: {sub.cms_case_reference or sub.cms_case_id}")

    missing = list(
        SubmissionChecklistItem.objects.filter(submission=sub, is_present=False)
        .select_related("document")[:8]
    )
    if missing:
        lines.append("Missing checklist items:")
        for item in missing:
            label = item.document.name if item.document_id else "Checklist item"
            lines.append(f"  - {label}")

    events = list(
        WorkflowEvent.objects.filter(submission=sub)
        .select_related("actor")
        .order_by("-created_at")[:5]
    )
    if events:
        lines.append("Recent workflow history (newest first):")
        for ev in reversed(events):
            actor = ev.actor_label or (
                (ev.actor.get_full_name() or ev.actor.username) if ev.actor_id else "System"
            )
            lines.append(
                f"  - {_format_dt(ev.created_at)}: {ev.get_previous_stage_display()} → "
                f"{ev.get_new_stage_display()} (by {actor})"
                + (f" — {ev.remarks[:200]}" if ev.remarks else "")
            )

    next_hint = _plain_next_step_hint(sub)
    if next_hint:
        lines.append(f"What happens next (guidance): {next_hint}")

    return "\n".join(lines)


def _plain_next_step_hint(sub) -> str:
    stage = sub.current_stage
    hints = {
        "draft": "Complete and submit the package to PSC when ready.",
        "submitted": "PSC Secretariat will register and route the submission.",
        "secretary_review": "Awaiting Secretary review and routing to the responsible unit.",
        "manager_checklist_review": "PSC manager is verifying the submission checklist.",
        "under_assessment": "PSC is assessing the matter; respond promptly if clarification is requested.",
        "forwarded_to_commission": "Scheduled or pending inclusion on a Commission sitting agenda.",
        "commission_sitting": "The Commission is considering this matter at a sitting.",
        "returned_for_clarification": "Your ministry should provide the requested information and resubmit.",
        "deferred_back_to_hr": "Returned to ministry HR for further action or resubmission.",
        "approved": "Decision approved — follow any outcome letter or instructions from PSC.",
        "rejected": "Decision not approved — review the Commission outcome and next steps with PSC.",
        "matters_arising": "Follow-up matter from a previous Commission decision.",
    }
    return hints.get(stage, "Contact the PSC Secretariat if you need clarification on this stage.")


def _list_ministry_submissions_summary(user, limit: int = 8) -> str:
    qs = (
        _submission_queryset(user)
        .exclude(current_stage__in=("approved", "rejected"))
        .order_by("-updated_at")[:limit]
    )
    rows = list(qs)
    if not rows:
        return (
            "\nNo active submissions visible for your account. "
            "Check the reference number or ask your ministry HR contact.\n"
        )
    lines = [f"\nActive submissions you can see (up to {limit}, newest activity first):"]
    for sub in rows:
        lines.append(
            f"  - {sub.reference_number}: {sub.title[:60]} — "
            f"{sub.get_current_stage_display()}"
            + (" (OVERDUE assessment)" if sub.is_assessment_overdue else "")
        )
    lines.append("Ask about any reference, e.g. “What is the status of PSC-2026-00042?”\n")
    return "\n".join(lines)


def build_status_context(user, message: str) -> str:
    blocks = []
    refs = extract_reference_numbers(message)
    qs = _submission_queryset(user)

    for ref in refs[:3]:
        sub = qs.filter(reference_number__iexact=ref).first()
        if sub:
            blocks.append(
                "=== Authorised case data ===\n" + _build_submission_block(sub)
            )
        else:
            blocks.append(
                f"=== Reference {ref} ===\n"
                "Not found or not visible to this user. "
                "Do not invent status — suggest checking the reference or contacting PSC Secretariat.\n"
            )

    if _MY_CASES_PATTERN.search(message or "") and not refs:
        blocks.append(_list_ministry_submissions_summary(user))

    if not blocks:
        return (
            "\nNo case reference detected in the question. "
            "If the user asks about a specific matter, they should include the PSC reference "
            "(e.g. PSC-2026-00042). You may list active cases if they ask about 'my submissions'.\n"
        )

    return "\n\n".join(blocks)


def _user_context_block(user) -> str:
    from tracker.models import Profile

    profile = Profile.objects.filter(user=user).select_related("ministry", "department").first()
    if not profile:
        return f"User: {user.username}"
    parts = [
        f"User: {user.get_full_name() or user.username}",
        f"Role: {profile.get_role_display()}",
    ]
    if profile.ministry_id:
        parts.append(f"Ministry: {profile.ministry.name}")
    if profile.department_id:
        parts.append(f"Department: {profile.department.name}")
    return "\n".join(parts)


def build_status_chat_system_prompt(user, user_message: str) -> str:
    ctx = build_status_context(user, user_message)
    return f"""You are the PSC Submission Status Assistant for the Vanuatu Public Service Commission.

Your only job is to help ministry HR officers, department staff, and other authorised users understand 
where their PSC submission is in the process — in clear, friendly plain English.

Rules:
- Answer using ONLY the live case data below. Never invent references, dates, decisions, or officer names.
- If data is missing, say what the user can do next (check SCDMS, email Secretariat, verify reference).
- Keep answers short: 2–5 sentences for a single case, or a brief bullet list for multiple cases.
- Explain the current stage in everyday language, what is outstanding, and realistic next steps.
- Mention assessment deadlines or overdue status when relevant.
- Do not provide legal advice or binding Commission decisions beyond what the data states.
- If the user writes in Bislama, you may acknowledge it but respond primarily in English.

{_user_context_block(user)}

Live case data for this message:
{ctx}
"""


def status_chat_tier() -> str:
    return FEATURE_MODEL_TIER.get("D2_status_chatbot", "haiku")


def generate_status_chat_reply(
    *,
    user,
    history: list[dict[str, str]],
    user_message: str,
) -> tuple[str | None, str | None]:
    if not ai_enabled():
        return None, "Status assistant is disabled (ANTHROPIC_API_KEY not configured)."

    system = build_status_chat_system_prompt(user, user_message)
    messages = []
    for item in history[-_MAX_HISTORY:]:
        role = item.get("role")
        content = (item.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message.strip()})

    tier = status_chat_tier()
    return complete_chat_with_error(
        system=system,
        messages=messages,
        tier=tier if tier in ("haiku", "sonnet") else "haiku",
        max_tokens=2048,
    )

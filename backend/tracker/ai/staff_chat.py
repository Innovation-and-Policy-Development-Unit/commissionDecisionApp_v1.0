"""
Staff Chatbot (feature D1 + light D2): PSC regulations/procedures Q&A and submission status.

Uses Claude Sonnet with a static knowledge base file and optional live submission lookup.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from django.conf import settings

from .claude_client import ai_enabled, complete_chat_with_error
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

_REF_PATTERN = re.compile(r"\b(PSC-\d{4}-\d+)\b", re.IGNORECASE)
_MAX_HISTORY = 20
_KB_CACHE: str | None = None


def _knowledge_path() -> Path:
    bundled = Path(__file__).resolve().parent / "psc_staff_knowledge.md"
    if bundled.is_file():
        return bundled
    base = Path(settings.BASE_DIR).resolve()
    return base.parent / "docs" / "psc_staff_knowledge.md"


def load_knowledge_base() -> str:
    global _KB_CACHE
    if _KB_CACHE is not None:
        return _KB_CACHE
    path = _knowledge_path()
    try:
        _KB_CACHE = path.read_text(encoding="utf-8")[:24000]
    except OSError:
        logger.warning("Staff chat knowledge file missing: %s", path)
        _KB_CACHE = (
            "PSC Vanuatu — use general public service principles. "
            "Confirm procedures with the PSC Secretariat when uncertain."
        )
    return _KB_CACHE


def _user_context_block(user) -> str:
    from tracker.models import Profile

    profile = Profile.objects.filter(user=user).select_related("ministry", "department").first()
    if not profile:
        return f"Signed-in user: {user.username}"
    lines = [
        f"Signed-in user: {user.get_full_name() or user.username}",
        f"Role: {profile.get_role_display()} ({profile.role})",
    ]
    if profile.ministry_id:
        lines.append(f"Ministry: {profile.ministry.name}")
    if profile.department_id:
        lines.append(f"Department: {profile.department.name}")
    return "\n".join(lines)


def _submission_context_for_message(message: str, user) -> str:
    match = _REF_PATTERN.search(message or "")
    if not match:
        return ""
    ref = match.group(1).upper()
    from tracker.models import Submission

    from tracker.views import _submission_queryset_for  # lazy — avoids import cycles

    sub = (
        _submission_queryset_for(user)
        .filter(reference_number__iexact=ref)
        .select_related("ministry", "department", "form_category")
        .first()
    )
    if not sub:
        return (
            f"\nSubmission lookup: No accessible submission found for reference {ref}. "
            "Tell the user you cannot see that case (wrong reference or no permission).\n"
        )
    return (
        f"\nLive submission context for {sub.reference_number} (authorised for this user):\n"
        f"- Title: {sub.title}\n"
        f"- Form: {sub.form_type_code or '—'}\n"
        f"- Ministry: {sub.ministry.name if sub.ministry_id else '—'}\n"
        f"- Current stage: {sub.get_current_stage_display()} ({sub.current_stage})\n"
        f"- Received: {sub.received_at}\n"
        f"- Assessment deadline: {sub.assessment_deadline_at or '—'}\n"
        f"- CMS case: {sub.cms_case_reference or sub.cms_case_id or '—'}\n"
    )


def build_staff_chat_system_prompt(user, user_message: str) -> str:
    kb = load_knowledge_base()
    ctx = _user_context_block(user)
    sub_ctx = _submission_context_for_message(user_message, user)
    return f"""You are the PSC Staff Assistant inside the Submission & Commission Decision Management System (SCDMS) for the Office of the Public Service Commission, Vanuatu.

Your role:
- Answer questions about PSC procedures, forms, workflow stages, and how to use SCDMS.
- Help staff understand what happens next in a process (checklists, assessment, commission sittings).
- When live submission data is provided below, answer status questions in plain English.

Rules:
- Be concise, professional, and practical. Use bullet lists when helpful.
- If you are not certain, say so and recommend confirming with the relevant unit (Secretariat, ODU, Compliance, etc.).
- Never claim binding legal authority. This is guidance only, not legal advice.
- Do not fabricate case details, dates, or decisions.
- Prefer Vanuatu English; acknowledge Bislama terms if the user uses them.

{ctx}
{sub_ctx}

Reference knowledge base:
{kb}
"""


def staff_chat_tier() -> str:
    return FEATURE_MODEL_TIER.get("staff_chatbot", "sonnet")


def generate_staff_chat_reply(
    *,
    user,
    history: list[dict[str, str]],
    user_message: str,
) -> tuple[str | None, str | None]:
    """Returns (assistant_reply, error_message)."""
    if not ai_enabled():
        return None, "AI assistant is disabled (ANTHROPIC_API_KEY not configured)."

    system = build_staff_chat_system_prompt(user, user_message)
    messages = []
    for item in history[-_MAX_HISTORY:]:
        role = item.get("role")
        content = (item.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message.strip()})

    tier = staff_chat_tier()
    return complete_chat_with_error(
        system=system,
        messages=messages,
        tier=tier if tier in ("haiku", "sonnet") else "sonnet",
        max_tokens=4096,
    )

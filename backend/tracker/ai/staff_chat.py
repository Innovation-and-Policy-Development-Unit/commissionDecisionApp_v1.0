"""
Staff Chatbot (D1 + D2): PSC procedures Q&A and submission status in one assistant.

Status lookups use live SCDMS data (see status_chat.build_status_context).
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from django.conf import settings

from .claude_client import ai_enabled, complete_chat_with_error
from .feature_registry import FEATURE_MODEL_TIER
from .status_chat import (
    _MY_CASES_PATTERN,
    build_status_context,
    extract_reference_numbers,
)

logger = logging.getLogger("scdms.app")

_MAX_HISTORY = 20
_KB_CACHE: str | None = None

_STATUS_KEYWORDS = re.compile(
    r"\b(status|where is my|what happened to|overdue|track(?:ing)? my)\b",
    re.IGNORECASE,
)


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


def is_status_focused_message(message: str) -> bool:
    """Use Haiku for case-status queries; Sonnet for procedure / policy questions."""
    if extract_reference_numbers(message):
        return True
    if _MY_CASES_PATTERN.search(message or ""):
        return True
    return bool(_STATUS_KEYWORDS.search(message or ""))


def tier_for_message(message: str) -> str:
    if is_status_focused_message(message):
        return FEATURE_MODEL_TIER.get("D2_status_chatbot", "haiku")
    return FEATURE_MODEL_TIER.get("staff_chatbot", "sonnet")


def build_staff_chat_system_prompt(user, user_message: str) -> str:
    kb = load_knowledge_base()
    ctx = _user_context_block(user)
    sub_ctx = build_status_context(user, user_message)
    status_note = ""
    if is_status_focused_message(user_message):
        status_note = (
            "\nThe user is asking about submission/case STATUS. "
            "Answer in plain English for a ministry HR officer when applicable: "
            "current stage, what is outstanding, deadlines, and sensible next steps. "
            "Use only the live case data below — never invent details.\n"
        )
    return f"""You are the PSC Staff Assistant inside the Submission & Commission Decision Management System (SCDMS) for the Office of the Public Service Commission, Vanuatu.

Your role:
- Answer questions about PSC procedures, forms, workflow stages, and how to use SCDMS.
- Help staff understand what happens next in a process (checklists, assessment, commission sittings).
- Answer submission STATUS questions (e.g. "What is the status of PSC-2026-00042?") using live data when provided.
{status_note}
Rules:
- Be concise, professional, and practical. Use bullet lists when helpful.
- If you are not certain, say so and recommend confirming with the relevant unit (Secretariat, ODU, Compliance, etc.).
- Never claim binding legal authority. This is guidance only, not legal advice.
- Do not fabricate case details, dates, or decisions.
- Prefer Vanuatu English; acknowledge Bislama terms if the user uses them.

{ctx}

Live submission / case data (when applicable):
{sub_ctx}

Reference knowledge base:
{kb}
"""


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

    tier = tier_for_message(user_message)
    max_tokens = 2048 if tier == "haiku" else 4096
    return complete_chat_with_error(
        system=system,
        messages=messages,
        tier=tier if tier in ("haiku", "sonnet") else "sonnet",
        max_tokens=max_tokens,
    )

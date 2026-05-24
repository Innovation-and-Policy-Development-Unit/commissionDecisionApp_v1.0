"""
C2 — Commission sitting briefing pack narrative (Sonnet).
"""

from __future__ import annotations

from typing import Any

from .claude_client import ai_enabled, complete_text_with_error
from .feature_registry import FEATURE_MODEL_TIER

SYSTEM = """You are preparing a Commission sitting briefing pack for the PSC Secretary,
Public Service Commission of Vanuatu.

Write clear, actionable prose in Markdown (no code fences). Structure:

## Executive overview
2–4 sentences on sitting readiness.

## Agenda readiness
Bullet list: items ready for deliberation, grouped by theme if helpful.

## Deferred and tabled matters
Bullets for deferred/tabled items and why they matter.

## Overdue assessments and risks
Bullets for overdue assessments and low-quality submissions (score under 60).
Be specific with reference numbers.

## Secretariat actions before the sitting
Numbered list of concrete prep steps (5–8 items max).

Tone: professional, concise, Vanuatu public service context. Do not invent references."""


def generate_briefing_narrative(*, meeting_context: str, pack_data: dict[str, Any]) -> tuple[str, str | None]:
    if not ai_enabled():
        return _fallback_narrative(pack_data), None

    import json

    tier = FEATURE_MODEL_TIER.get("C2_meeting_briefing_pack", "sonnet")
    user = (
        f"Meeting context:\n{meeting_context}\n\n"
        f"Structured data (JSON):\n{json.dumps(pack_data, ensure_ascii=False, default=str)[:12000]}"
    )
    text, err = complete_text_with_error(system=SYSTEM, user=user, tier=tier, max_tokens=4096)
    if text and text.strip():
        return text.strip(), None
    return _fallback_narrative(pack_data), err


def _fallback_narrative(pack_data: dict[str, Any]) -> str:
    stats = pack_data.get("stats") or {}
    lines = [
        "## Executive overview",
        f"This sitting has {stats.get('agenda_count', 0)} agenda item(s) and "
        f"{stats.get('queued_count', 0)} queued submission(s).",
        "",
        "## Secretariat actions before the sitting",
        "- Confirm agenda order and Chairman approval.",
        "- Review flagged overdue assessments.",
    ]
    return "\n".join(lines)

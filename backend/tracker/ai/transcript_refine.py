"""Claude pass to clean Whisper ASR for Vanuatu Commission sittings (English + Bislama)."""

from __future__ import annotations

from .claude_client import complete_text_with_error
from .feature_registry import get_model_tier

REFINE_SYSTEM = (
    "You assist the Public Service Commission Secretariat in Vanuatu. "
    "Commission sittings mix English and Bislama. Automatic speech recognition "
    "often produces garbled English-like text. Infer intended meaning; do not "
    "treat nonsense phonetic strings literally. Output only the cleaned transcript "
    "body (no markdown fences, no preamble)."
)


def build_refine_user_prompt(*, meeting_info: str, agenda_block: str, whisper_text: str) -> str:
    return f"""Meeting information:
{meeting_info}

Agenda items:
{agenda_block}

Whisper machine transcript (first pass — fix mangled Bislama/English):
---
{whisper_text[:48000]}
---

Produce a single cleaned verbatim-style transcript in formal English suitable for secretariat review.
- Preserve submission references and names when clear.
- Where meaning is uncertain, mark the phrase with [VERIFY].
- Keep short Bislama phrases in quotes when they carry legal meaning.
- Do not draft formal minutes sections — transcript only."""


def refine_transcript_text(
    *,
    meeting_info: str,
    agenda_block: str,
    whisper_text: str,
) -> tuple[str | None, str | None]:
    """Returns (refined_text, error_message)."""
    user = build_refine_user_prompt(
        meeting_info=meeting_info,
        agenda_block=agenda_block,
        whisper_text=whisper_text,
    )
    return complete_text_with_error(
        system=REFINE_SYSTEM,
        user=user,
        tier=get_model_tier("transcript_refine"),
        max_tokens=16384,
    )

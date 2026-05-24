"""Agenda item one-liner when adding submission to meeting (Haiku)."""

from __future__ import annotations

from .claude_client import ai_enabled, complete_text_with_error
from .feature_registry import get_model_tier


def generate_agenda_blurb(*, submission, meeting) -> tuple[str, str | None]:
    from ..tasks import build_submission_brief_context

    brief_ctx = build_submission_brief_context(submission)[:6000]
    quality = submission.ai_quality_score
    quality_line = f"AI quality score: {quality}/100" if quality is not None else "Quality score: not yet computed"

    if not ai_enabled():
        return (
            f"{submission.reference_number}: {submission.title}. "
            f"Ministry matter for {meeting.reference_number}. {quality_line}.",
            None,
        )

    tier = get_model_tier("agenda_blurb")
    text, err = complete_text_with_error(
        system=(
            "Write a 2–3 sentence agenda blurb for a PSC Commission sitting pack. "
            "Professional English, suitable for Commissioners. No bullet points. "
            "Mention ministry, form type if known, and readiness. "
            "Prefix with [AI draft — verify]."
        ),
        user=(
            f"Meeting: {meeting.reference_number} — {meeting.title} on {meeting.date}\n"
            f"{quality_line}\n\nSubmission:\n{brief_ctx}"
        ),
        tier=tier,
        max_tokens=400,
    )
    if text and text.strip():
        body = text.strip()
        if "[AI draft" not in body[:30].lower():
            body = "[AI draft — verify] " + body
        return body, None
    return (
        f"[AI draft — verify] {submission.reference_number}: {submission.title}.",
        err,
    )

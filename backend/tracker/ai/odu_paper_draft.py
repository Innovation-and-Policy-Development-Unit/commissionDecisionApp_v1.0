"""AI first draft of ODU's Commission paper for a restructure (Sonnet).

The Commission reads ODU's paper, not the ministry's request. This drafts the narrative
sections from what the ministry sent, ODU's own checklist answers, and the text of the
three analyses ODU attached. It only ever produces *suggestions*, stored on the paper's
``ai_draft`` and never written into the paper itself: the officer reads each one and
chooses what to use.

Two rules keep it honest: the costing table is copied from the ministry's own figures
(never generated), and a section the AI has nothing to go on is left empty and named as
a gap, not invented. In particular a summary of an analysis is drafted only from that
analysis's own text.
"""

from __future__ import annotations

import json

from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import get_model_tier

TEXT_FIELDS = (
    "subject", "background", "issues", "discussions", "odu_assessment",
    "dsspac_summary", "grt_summary", "finance_summary",
)

_ANALYSIS_TEXT_CHARS = 7000

SYSTEM = (
    "You draft sections of a Public Service Commission board paper for the Organisation "
    "Development Unit (ODU) about a ministry's proposed restructure. Write in formal, plain "
    "English for Commissioners. Use ONLY the material given: never invent figures, names, "
    "dates, positions or conclusions. If the material does not support a section, return an "
    "empty string for it and add a short note to 'gaps' saying what is missing. A summary of "
    "the DSSPAC, GRT or Finance analysis may be written only from that analysis's own text; "
    "if its text is not provided, leave that summary empty. Return JSON with the string keys "
    "subject, background, issues, discussions, odu_assessment, dsspac_summary, grt_summary, "
    "finance_summary, and 'gaps' (a list of short strings). 'issues' is what the Commission is "
    "asked to decide, starting 'Whether or not'. 'odu_assessment' states ODU's own assessment "
    "from its checklist answers, not the ministry's claims."
)


def ministry_costing_rows(submission) -> list:
    """The ministry's costing table, copied as entered (no AI involved)."""
    try:
        rows = submission.restructure_data.costing_rows
    except Exception:
        return []
    return [dict(r) for r in rows] if isinstance(rows, list) else []


def _checklist_lines(submission) -> list[str]:
    try:
        cl = submission.odu_checklist
    except Exception:
        return []
    lines = []
    for field in cl._meta.fields:
        if field.name in ("id", "submission", "status", "created_at", "updated_at"):
            continue
        val = getattr(cl, field.name)
        if val not in (None, "", []):
            lines.append(f"  {field.name}: {val}")
    return lines


def _analysis_text(paper) -> dict[str, str]:
    from ..models import SubmissionDocument
    from ..odu_paper_gate import ANALYSES

    out = {}
    for doc_name, field, _label in ANALYSES:
        doc = (
            SubmissionDocument.objects.filter(
                submission=paper.submission, required_document__name=doc_name,
                archived_at__isnull=True,
            ).order_by("-uploaded_at").first()
        )
        text = (doc.extracted_text or "").strip() if doc else ""
        out[field] = text[:_ANALYSIS_TEXT_CHARS]
    return out


def build_context(paper) -> str:
    from ..tasks import build_submission_brief_context

    submission = paper.submission
    parts = ["MINISTRY SUBMISSION", build_submission_brief_context(submission)[:12000]]
    checklist = _checklist_lines(submission)
    if checklist:
        parts += ["", "ODU CHECKLIST ANSWERS", *checklist]
    for field, text in _analysis_text(paper).items():
        label = field.replace("_summary", "").upper()
        parts += ["", f"{label} ANALYSIS TEXT", text or "(no text available - leave the summary empty)"]
    return "\n".join(parts)


def draft_paper(paper) -> tuple[dict | None, str | None]:
    """Returns (suggestions, error). Suggestions include the deterministic costing rows."""
    costing = ministry_costing_rows(paper.submission)
    if not ai_enabled():
        return None, "AI is not enabled."
    data, err = complete_json_with_error(
        system=SYSTEM, user=build_context(paper),
        tier=get_model_tier("odu_paper_draft"), max_tokens=6000,
    )
    if err or not isinstance(data, dict):
        return None, err or "The AI returned no draft."
    suggestions = {k: str(data.get(k) or "").strip() for k in TEXT_FIELDS}
    # A summary with no analysis text behind it is not allowed through.
    for field, text in _analysis_text(paper).items():
        if not text:
            suggestions[field] = ""
    gaps = data.get("gaps")
    suggestions["gaps"] = [str(g) for g in gaps][:12] if isinstance(gaps, list) else []
    suggestions["costing_rows"] = costing
    return suggestions, None

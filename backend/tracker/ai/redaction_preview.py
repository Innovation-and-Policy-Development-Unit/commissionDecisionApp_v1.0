"""E3 — Suggest redaction spans before download/share (Sonnet; human approves)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .annotation_assist import suggest_annotations


def suggest_redaction_spans(
    *,
    file_path: Path,
    original_name: str,
    extracted_text: str = "",
) -> tuple[dict[str, Any] | None, str | None]:
    """Reuse vision path; filter for sensitive content categories."""
    base, err = suggest_annotations(
        file_path=file_path,
        original_name=original_name,
        extracted_text=extracted_text,
        submission_context="Identify witness names, medical details, personal phone numbers, and national ID numbers for redaction.",
    )
    if not base:
        return None, err

    spans = []
    for s in base.get("suggestions") or []:
        spans.append({
            "page_number": s.get("page_number", 1),
            "reason": s.get("note", ""),
            "quote": s.get("quote", ""),
            "category": "sensitive_personal",
        })

    return {
        "disclaimer": "AI draft — human must approve redactions before sharing externally.",
        "spans": spans,
        "processed": True,
    }, None

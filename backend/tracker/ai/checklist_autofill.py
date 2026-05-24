"""
A1 — AI checklist autofill.

Given a submission's uploaded documents (OCR text) and its required-document
checklist, ask Claude Haiku which items are likely present and why.
Returns a suggestions dict  {str(item_id): {is_present: bool, notes: str}}
without writing anything to the database — the officer confirms each item.
"""

from __future__ import annotations

import logging
from typing import Any

from .claude_client import ai_enabled, complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

SYSTEM = """You are a document analyst for the Vanuatu Public Service Commission.

You are given:
1. A list of required checklist documents (each with an ID, name, and optional description).
2. Extracted text from all documents uploaded to this submission package.

Your task: for each checklist item, decide whether it is likely present in the uploaded documents.

Rules:
- Base your decision ONLY on the extracted text provided. Do not invent content.
- "present" means you can reasonably infer the document exists in the uploaded files.
- "missing" means there is no evidence the document was uploaded.
- Keep notes concise (1 sentence max) — cite the file name or key phrase if found.
- If no documents have been uploaded, mark all items as missing.

Output valid JSON only:
{
  "suggestions": {
    "<item_id>": {
      "is_present": true,
      "notes": "Found in 'cover_letter.pdf' — mentions appointment to Grade 10 position."
    }
  }
}"""


def _build_context(submission, items: list) -> str:
    from ..models import SubmissionDocument

    lines: list[str] = [
        f"Submission: {submission.reference_number} — {submission.title}",
        f"Form type: {submission.form_type_code or '—'}",
        "",
        "Required checklist items:",
    ]
    for item in items:
        name = item.document.name if item.document_id else "Unknown"
        desc = item.document.description if item.document_id and item.document.description else ""
        lines.append(f"  ID={item.id}: {name}" + (f" — {desc}" if desc else ""))

    docs = SubmissionDocument.objects.filter(submission=submission).order_by("uploaded_at")
    if not docs.exists():
        lines += ["", "Uploaded documents: none"]
    else:
        lines += ["", "Uploaded documents (with extracted text):"]
        for doc in docs:
            lines.append(f"\n--- {doc.original_name} ---")
            if doc.extracted_text:
                # Cap per-document text to keep tokens reasonable
                text = doc.extracted_text[:3000]
                lines.append(text)
                if len(doc.extracted_text) > 3000:
                    lines.append("[... text truncated ...]")
            elif doc.extracted_facts and isinstance(doc.extracted_facts, dict):
                summary = doc.extracted_facts.get("document_summary") or ""
                if summary:
                    lines.append(f"Summary: {summary}")
                else:
                    lines.append("(no extracted text available)")
            else:
                lines.append("(no extracted text available)")

    return "\n".join(lines)


def _fallback_suggestions(items: list) -> dict[str, dict]:
    """Rule-based fallback: mark item present if a doc description matches its name."""
    from ..models import SubmissionDocument

    if not items:
        return {}

    submission = items[0].submission
    doc_descs = set(
        SubmissionDocument.objects.filter(submission=submission)
        .values_list("description", flat=True)
    )
    doc_descs_lower = {d.lower() for d in doc_descs if d}

    suggestions: dict[str, dict] = {}
    for item in items:
        name = (item.document.name if item.document_id else "").lower()
        present = any(name in desc or desc in name for desc in doc_descs_lower)
        suggestions[str(item.id)] = {
            "is_present": present,
            "notes": "Matched by document description." if present else "No matching document found.",
        }
    return suggestions


def suggest_checklist_items(
    submission,
    items: list,
) -> tuple[dict[str, Any], str | None]:
    """Return (suggestions_dict, error_message).

    suggestions_dict: {str(item_id): {"is_present": bool, "notes": str}}
    """
    if not items:
        return {}, None

    context = _build_context(submission, items)

    if not ai_enabled():
        suggestions = _fallback_suggestions(items)
        return suggestions, None

    tier = FEATURE_MODEL_TIER.get("A1_auto_fill_checklist", "haiku")
    data, err = complete_json_with_error(
        system=SYSTEM,
        user=(
            "Analyse the following submission package and suggest which checklist items are present.\n\n"
            f"{context}"
        ),
        tier=tier,
        max_tokens=1024,
    )

    if not data or not isinstance(data, dict):
        logger.warning("CHECKLIST_AUTOFILL | AI failed (%s), using rule-based fallback", err)
        return _fallback_suggestions(items), err

    raw_suggestions = data.get("suggestions") or {}
    if not isinstance(raw_suggestions, dict):
        return _fallback_suggestions(items), "AI returned unexpected format."

    # Validate and normalise each suggestion
    valid_ids = {str(item.id) for item in items}
    suggestions: dict[str, dict] = {}
    for sid, val in raw_suggestions.items():
        if sid not in valid_ids:
            continue
        if not isinstance(val, dict):
            continue
        suggestions[sid] = {
            "is_present": bool(val.get("is_present", False)),
            "notes": str(val.get("notes") or "")[:500],
        }

    # Fill in any items the AI missed
    for item in items:
        if str(item.id) not in suggestions:
            suggestions[str(item.id)] = {
                "is_present": False,
                "notes": "AI did not evaluate this item.",
            }

    logger.info(
        "CHECKLIST_AUTOFILL | submission=%s items=%d present=%d",
        submission.reference_number,
        len(items),
        sum(1 for s in suggestions.values() if s["is_present"]),
    )
    return suggestions, None

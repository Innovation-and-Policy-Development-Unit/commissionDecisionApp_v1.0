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


# ── Dynamic (PSCFormField-based) checklist field-value extraction ─────────────
# Same idea as suggest_checklist_items() above, but for the generic
# checklist_form_type system (SubmissionChecklistResponse.data), and
# extracting actual field *values* from document text rather than just a
# present/missing judgement — e.g. pulling "Highest Qualification" out of an
# uploaded CV, not just confirming the CV exists. Only ever called for fields
# still empty after the deterministic prefill (submission_checklist_prefill.py)
# — anything the system can already state as fact never goes through the AI.

FIELD_VALUE_SYSTEM = """You are a document analyst for the Vanuatu Public Service Commission.

You are given:
1. A list of checklist fields that are still blank, each with a key, label, and type
   (checkbox = yes/no, text/textarea = free text, date = a calendar date).
2. Extracted text from all documents uploaded to this submission package.

Your task: for each blank field, extract its value from the document text if — and
only if — the text clearly supports it.

Rules:
- Base every answer ONLY on the extracted text provided. Never invent or infer
  content that isn't actually stated in a document.
- If the documents don't clearly answer a field, omit that field entirely from
  your output — do not guess.
- For checkbox fields, only answer true/false when the text gives clear evidence
  either way.
- For text/textarea fields, extract a concise value in your own words if the
  source is verbose — quote directly if it's already concise.
- For date fields, use YYYY-MM-DD format.
- "notes" must cite which document the value came from (1 short sentence).

Output valid JSON only:
{
  "suggestions": {
    "<field_key>": {
      "value": "...",
      "notes": "Found in 'cv.pdf' — states a Diploma in Accounting."
    }
  }
}"""


def _build_field_context(submission, fields: list[dict]) -> str:
    from ..models import SubmissionDocument

    lines: list[str] = [
        f"Submission: {submission.reference_number} — {submission.title}",
        f"Form type: {submission.form_type_code or '—'}",
        "",
        "Blank checklist fields:",
    ]
    for f in fields:
        help_text = f" — {f['help_text']}" if f.get("help_text") else ""
        lines.append(f"  key={f['field_key']} ({f['field_type']}): {f['label']}{help_text}")

    docs = SubmissionDocument.objects.filter(submission=submission).order_by("uploaded_at")
    if not docs.exists():
        lines += ["", "Uploaded documents: none"]
    else:
        lines += ["", "Uploaded documents (with extracted text):"]
        for doc in docs:
            lines.append(f"\n--- {doc.original_name} ---")
            if doc.extracted_text:
                text = doc.extracted_text[:3000]
                lines.append(text)
                if len(doc.extracted_text) > 3000:
                    lines.append("[... text truncated ...]")
            elif doc.extracted_facts and isinstance(doc.extracted_facts, dict):
                summary = doc.extracted_facts.get("document_summary") or ""
                lines.append(f"Summary: {summary}" if summary else "(no extracted text available)")
            else:
                lines.append("(no extracted text available)")

    return "\n".join(lines)


def suggest_checklist_field_values(
    submission,
    fields: list[dict],
) -> tuple[dict[str, Any], str | None]:
    """Return (suggestions_dict, error_message) for a dynamic checklist's
    still-blank fields.

    fields: [{"field_key": ..., "label": ..., "field_type": ..., "help_text": ...}, ...]
    suggestions_dict: {field_key: {"value": Any, "notes": str}}
    """
    if not fields or not ai_enabled():
        return {}, None

    from ..models import SubmissionDocument

    if not SubmissionDocument.objects.filter(submission=submission).exists():
        return {}, None

    context = _build_field_context(submission, fields)
    tier = FEATURE_MODEL_TIER.get("A1_auto_fill_checklist", "haiku")
    data, err = complete_json_with_error(
        system=FIELD_VALUE_SYSTEM,
        user=(
            "Extract values for the following blank checklist fields from the "
            f"submission's uploaded documents.\n\n{context}"
        ),
        tier=tier,
        max_tokens=1024,
    )

    if not data or not isinstance(data, dict):
        logger.warning("CHECKLIST_AUTOFILL | dynamic field-value AI failed (%s)", err)
        return {}, err

    raw = data.get("suggestions") or {}
    if not isinstance(raw, dict):
        return {}, "AI returned unexpected format."

    valid_keys = {f["field_key"] for f in fields}
    checkbox_keys = {f["field_key"] for f in fields if f["field_type"] == "checkbox"}
    suggestions: dict[str, dict] = {}
    for key, val in raw.items():
        if key not in valid_keys or not isinstance(val, dict):
            continue
        value = val.get("value")
        if value in (None, ""):
            continue
        if key in checkbox_keys:
            value = bool(value) if isinstance(value, bool) else str(value).strip().lower() in ("true", "yes", "1")
        suggestions[key] = {"value": value, "notes": str(val.get("notes") or "")[:500]}

    logger.info(
        "CHECKLIST_AUTOFILL | dynamic submission=%s fields=%d suggested=%d",
        submission.reference_number, len(fields), len(suggestions),
    )
    return suggestions, None

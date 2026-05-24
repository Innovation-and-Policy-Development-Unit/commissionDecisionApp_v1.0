"""Annotation assist — suggest PDF review comments for annotator (Sonnet + vision)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .claude_client import ai_enabled, complete_json_with_error
from .document_extraction import image_file_base64, pdf_page_images_base64
from .feature_registry import FEATURE_MODEL_TIER

SYSTEM = """You suggest review annotations for a PSC submission PDF.

Output valid JSON only:
{
  "disclaimer": "AI draft — verify before applying highlights.",
  "suggestions": [
    {
      "page_number": 1,
      "kind": "highlight",
      "note": "short comment for reviewer",
      "quote": "exact short phrase from page if visible"
    }
  ]
}

Suggest 3–8 items focusing on missing endorsements, dates, names, or policy gaps."""


def suggest_annotations(
    *,
    file_path: Path,
    original_name: str,
    extracted_text: str = "",
    submission_context: str = "",
) -> tuple[dict[str, Any] | None, str | None]:
    if not ai_enabled():
        return None, "ANTHROPIC_API_KEY is not configured."

    images: list[tuple[str, str]] = []
    lower = original_name.lower()
    if lower.endswith(".pdf"):
        images = pdf_page_images_base64(file_path, max_pages=3)
    elif lower.endswith((".png", ".jpg", ".jpeg", ".webp")):
        images = image_file_base64(file_path)

    tier = FEATURE_MODEL_TIER.get("annotation_assist", "sonnet")
    user_text = f"Document: {original_name}\n{submission_context}\n\nExtracted text:\n{(extracted_text or '')[:4000]}"

    if images:
        from .claude_client import complete_json_with_images

        data, err = complete_json_with_images(
            system=SYSTEM,
            user_text=user_text,
            images=images,
            tier=tier,
            max_tokens=2048,
        )
    else:
        data, err = complete_json_with_error(
            system=SYSTEM,
            user=user_text,
            tier=tier,
            max_tokens=2048,
        )

    if not data:
        return None, err or "No suggestions."

    suggestions = data.get("suggestions") if isinstance(data.get("suggestions"), list) else []
    clean = []
    for s in suggestions[:12]:
        if not isinstance(s, dict):
            continue
        clean.append({
            "page_number": max(1, int(s.get("page_number") or 1)),
            "kind": str(s.get("kind") or "highlight")[:32],
            "note": str(s.get("note") or "").strip()[:500],
            "quote": str(s.get("quote") or "").strip()[:300],
        })
    return {
        "disclaimer": str(data.get("disclaimer") or "AI draft — verify before applying highlights."),
        "suggestions": clean,
        "processed": True,
    }, None

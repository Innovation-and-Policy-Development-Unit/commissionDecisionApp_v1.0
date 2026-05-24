"""
E1 — OCR and key-facts extraction from scanned images and non-searchable PDFs.
Uses local text extraction when possible, then Claude Sonnet (vision) for scans.
"""

from __future__ import annotations

import base64
import io
import logging
from pathlib import Path

from django.conf import settings

from .claude_client import complete_json_with_error
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

OCR_SYSTEM = """You are a document analyst for the Vanuatu Public Service Commission.
Extract text and structured key facts from the provided document image(s) or text.
Preserve Bislama phrases in quotes when present; summarise in professional English.

Output valid JSON only:
{
  "extracted_text": "full readable text of the document",
  "document_summary": "2-3 sentence summary",
  "key_facts": {
    "names": ["person or organisation names"],
    "dates": ["dates with context"],
    "positions": ["job titles / roles mentioned"],
    "references": ["file refs, legislation, circular numbers"],
    "statements": ["material quotes or decisions stated"]
  }
}"""

MIN_TEXT_CHARS_FOR_SKIP_VISION = 120
MAX_VISION_PAGES = 5
MAX_IMAGE_BYTES = 4_500_000


def _tier() -> str:
    return FEATURE_MODEL_TIER.get("E1_ocr_extraction", "sonnet")


def _is_extractable(name: str) -> bool:
    lower = (name or "").lower()
    return lower.endswith((".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"))


def extract_pdf_text(path: Path) -> str:
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        parts = []
        for page in reader.pages[:30]:
            parts.append(page.extract_text() or "")
        return "\n".join(parts).strip()
    except Exception as exc:
        logger.debug("PDF text extract failed: %s", exc)
        return ""


def pdf_page_images_base64(path: Path, max_pages: int = MAX_VISION_PAGES) -> list[tuple[str, str]]:
    """Return [(media_type, base64), ...] for PDF pages via PyMuPDF."""
    images: list[tuple[str, str]] = []
    try:
        import fitz

        doc = fitz.open(str(path))
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
            img_bytes = pix.tobytes("jpeg")
            if len(img_bytes) > MAX_IMAGE_BYTES:
                continue
            images.append(("image/jpeg", base64.standard_b64encode(img_bytes).decode("ascii")))
        doc.close()
    except Exception as exc:
        logger.warning("PDF rasterize failed: %s", exc)
    return images


def image_file_base64(path: Path) -> list[tuple[str, str]]:
    suffix = path.suffix.lower()
    media = "image/jpeg"
    if suffix == ".png":
        media = "image/png"
    elif suffix in (".webp",):
        media = "image/webp"
    raw = path.read_bytes()
    if len(raw) > MAX_IMAGE_BYTES:
        from PIL import Image

        img = Image.open(io.BytesIO(raw))
        img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        raw = buf.getvalue()
    return [(media, base64.standard_b64encode(raw).decode("ascii"))]


def run_document_extraction(*, file_path: Path, original_name: str, description: str = "") -> tuple[dict | None, str | None]:
    """
    Run extraction pipeline. Returns (result_dict, error_message).
  result_dict keys: extracted_text, document_summary, key_facts
    """
    if not _is_extractable(original_name):
        return None, "File type not supported for OCR (use PDF or image)."

    path = Path(file_path)
    if not path.is_file():
        return None, "File not found on disk."

    plain = ""
    images: list[tuple[str, str]] = []

    lower = original_name.lower()
    if lower.endswith(".pdf"):
        plain = extract_pdf_text(path)
        if len(plain) < MIN_TEXT_CHARS_FOR_SKIP_VISION:
            images = pdf_page_images_base64(path)
    elif lower.endswith((".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff")):
        images = image_file_base64(path)
    else:
        return None, "Unsupported format."

    user_intro = (
        f"Document filename: {original_name}\n"
        f"Description: {description or '—'}\n"
    )

    if len(plain) >= MIN_TEXT_CHARS_FOR_SKIP_VISION and not images:
        from .claude_client import complete_json_with_error as cj

        data, err = cj(
            system=OCR_SYSTEM,
            user=f"{user_intro}\n\nExtracted text from PDF:\n{plain[:80000]}",
            tier=_tier(),
            max_tokens=8192,
        )
        if err:
            return None, err
        return _normalize_result(data), None

    if images:
        from .claude_client import complete_json_with_images

        data, err = complete_json_with_images(
            system=OCR_SYSTEM,
            user_text=f"{user_intro}\n\nRead the attached page image(s) and extract all text and key facts.",
            images=images,
            tier=_tier(),
            max_tokens=8192,
        )
        if err:
            return None, err
        return _normalize_result(data), None

    if plain:
        from .claude_client import complete_json_with_error as cj

        data, err = cj(
            system=OCR_SYSTEM,
            user=f"{user_intro}\n\nPartial PDF text:\n{plain}",
            tier=_tier(),
            max_tokens=8192,
        )
        if err:
            return None, err
        return _normalize_result(data), None

    return None, "No text or images could be extracted from this file."


def _normalize_result(data: dict | None) -> dict | None:
    if not data or not isinstance(data, dict):
        return None
    facts = data.get("key_facts")
    if not isinstance(facts, dict):
        facts = {}
    for key in ("names", "dates", "positions", "references", "statements"):
        val = facts.get(key)
        if not isinstance(val, list):
            facts[key] = []
    data["key_facts"] = facts
    if not data.get("extracted_text") and data.get("document_summary"):
        data["extracted_text"] = data["document_summary"]
    return data

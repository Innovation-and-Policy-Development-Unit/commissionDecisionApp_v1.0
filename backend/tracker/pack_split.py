"""Split one combined scan (a single PDF holding several required documents) into
separate documents, each matched to a required-document slot and given a short summary.

The AI proposes where each document starts and ends when it is available; without
it, a keyword match against the required-document names does the same job less well.
Either way the ministry sees the pieces, can fix a wrong one, and nothing is deleted:
the original scan stays on the submission.
"""

from __future__ import annotations

import io
import logging
import re
from pathlib import Path

from django.core.files.base import ContentFile
from django.utils import timezone

logger = logging.getLogger("scdms.app")

MIN_PAGE_TEXT = 40          # below this, a page is treated as a scan and OCR'd
EXCERPT_CHARS = 350         # per page, sent to the AI
MAX_AI_PAGES = 400


def page_texts(path: Path) -> list[str]:
    """Text of every page: embedded text first, Tesseract for scanned pages."""
    import fitz

    texts: list[str] = []
    doc = fitz.open(str(path))
    try:
        for page in doc:
            text = (page.get_text() or "").strip()
            if len(text) < MIN_PAGE_TEXT:
                text = _ocr_page(page) or text
            texts.append(text)
    finally:
        doc.close()
    return texts


def _ocr_page(page) -> str:
    try:
        import fitz
        import pytesseract
        from PIL import Image

        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        return (pytesseract.image_to_string(Image.open(io.BytesIO(pix.tobytes("png")))) or "").strip()
    except Exception as exc:  # noqa: BLE001
        logger.info("PACK_OCR_PAGE_FAIL | %s", exc)
        return ""


def _tokens(name: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]{4,}", (name or "").lower())}


def _one_line(text: str, limit: int = 220) -> str:
    return re.sub(r"\s+", " ", text or "").strip()[:limit]


def _segments_by_keywords(texts: list[str], slots: list[dict]) -> list[dict]:
    """No-AI fallback: a page starts a new document when it matches a different
    required document than the one before; unmatched pages continue the previous one."""
    from .ai.document_classification import _content_hint

    def best_slot(text: str):
        low = (text or "").lower()
        best, best_score = None, 0
        for slot in slots:
            words = _tokens(slot["name"])
            if not words:
                continue
            score = sum(1 for w in words if w in low) / len(words)
            if score > best_score:
                best, best_score = slot, score
        return (best, best_score) if best_score >= 0.5 else (None, 0)

    segments: list[dict] = []
    current = None
    for i, text in enumerate(texts, start=1):
        slot, _ = best_slot(text)
        key = slot["id"] if slot else None
        if current is None or (key is not None and key != current["required_document_id"]):
            if slot is None:
                hint = _content_hint(text)
                label = hint[0].replace("_", " ").title() if hint else None
            else:
                label = slot["name"]
            current = {
                "start_page": i, "end_page": i, "required_document_id": key,
                "name": label or "Document", "summary": _one_line(text),
            }
            segments.append(current)
        else:
            current["end_page"] = i
            if not current["summary"]:
                current["summary"] = _one_line(text)
    return segments


def _segments_by_ai(texts: list[str], slots: list[dict]) -> list[dict] | None:
    from .ai.claude_client import ai_enabled, complete_json_with_error
    from .ai.feature_registry import FEATURE_MODEL_TIER

    if not ai_enabled() or len(texts) > MAX_AI_PAGES:
        return None
    slot_lines = "\n".join(f'- id {s["id"]}: {s["name"]}' for s in slots) or "- (none listed)"
    pages = "\n".join(f"[Page {i}] {_one_line(t, EXCERPT_CHARS) or '(blank or unreadable)'}" for i, t in enumerate(texts, 1))
    system = (
        "You split one scanned PDF, made by a Vanuatu ministry, into the separate documents it contains. "
        "Documents appear in order; every page belongs to exactly one document. "
        "Match each document to one of the required documents when it clearly is one (use its id), "
        "otherwise use null. Give each a short plain name and a one or two sentence summary of what it says. "
        'Output JSON: {"documents":[{"start_page":1,"end_page":2,"required_document_id":12,'
        '"name":"Medical certificate","summary":"..."}]}'
    )
    user = f"Required documents:\n{slot_lines}\n\nPages ({len(texts)} total):\n{pages}"
    data, err = complete_json_with_error(
        system=system, user=user, tier=FEATURE_MODEL_TIER.get("A2_document_classification", "haiku"),
        max_tokens=4096,
    )
    if err or not isinstance(data, dict) or not isinstance(data.get("documents"), list):
        logger.info("PACK_SPLIT_AI_FALLBACK | %s", err or "unexpected shape")
        return None
    return data["documents"]


def _normalise(raw: list[dict], page_count: int, slots: list[dict]) -> list[dict]:
    """Make the proposed segments cover pages 1..N contiguously, in order, once each."""
    valid_ids = {s["id"] for s in slots}
    cleaned = []
    for seg in raw:
        try:
            start, end = int(seg["start_page"]), int(seg["end_page"])
        except (KeyError, TypeError, ValueError):
            continue
        if start < 1 or end < start:
            continue
        rid = seg.get("required_document_id")
        cleaned.append({
            "start_page": start, "end_page": min(end, page_count),
            "required_document_id": rid if rid in valid_ids else None,
            "name": _one_line(str(seg.get("name") or "Document"), 120) or "Document",
            "summary": _one_line(str(seg.get("summary") or ""), 500),
        })
    cleaned.sort(key=lambda s: s["start_page"])
    out: list[dict] = []
    next_page = 1
    for seg in cleaned:
        if seg["end_page"] < next_page:
            continue
        if seg["start_page"] > next_page:      # gap: give those pages their own document
            out.append({"start_page": next_page, "end_page": seg["start_page"] - 1,
                        "required_document_id": None, "name": "Unmatched pages", "summary": ""})
        seg["start_page"] = max(seg["start_page"], next_page)
        out.append(seg)
        next_page = seg["end_page"] + 1
    if next_page <= page_count:
        out.append({"start_page": next_page, "end_page": page_count,
                    "required_document_id": None, "name": "Unmatched pages", "summary": ""})
    return out


def _required_slots(submission) -> list[dict]:
    from .models import SubmissionChecklistItem
    from .submission_checklist import ensure_submission_checklist_items

    ensure_submission_checklist_items(submission)
    items = SubmissionChecklistItem.objects.filter(
        submission=submission, document__item_type="document",
    ).select_related("document")
    return [{"id": i.document_id, "name": i.document.name} for i in items]


def _safe_name(name: str) -> str:
    return re.sub(r"[^\w .,()&'-]+", "_", name).strip()[:100] or "Document"


def split_pack(pack) -> int:
    """Split the combined-scan document `pack` into separate documents. Returns how many."""
    from pypdf import PdfReader, PdfWriter

    from .models import DocumentOcrStatus, RequiredDocument, SubmissionChecklistItem, SubmissionDocument
    from .tasks import queue_document_classification

    submission = pack.submission
    path = Path(pack.file.path)
    texts = page_texts(path)
    if not texts:
        raise ValueError("The PDF has no readable pages.")
    slots = _required_slots(submission)

    raw = _segments_by_ai(texts, slots)
    segments = _normalise(raw, len(texts), slots) if raw else _segments_by_keywords(texts, slots)
    segments = _normalise(segments, len(texts), slots)

    reader = PdfReader(str(path))
    created = 0
    for seg in segments:
        writer = PdfWriter()
        for n in range(seg["start_page"] - 1, seg["end_page"]):
            writer.add_page(reader.pages[n])
        buf = io.BytesIO()
        writer.write(buf)
        pages = (f'{seg["start_page"]}' if seg["start_page"] == seg["end_page"]
                 else f'{seg["start_page"]}-{seg["end_page"]}')
        text = "\n".join(texts[seg["start_page"] - 1:seg["end_page"]])
        required = RequiredDocument.objects.filter(pk=seg["required_document_id"]).first() \
            if seg["required_document_id"] else None
        doc = SubmissionDocument(
            submission=submission, required_document=required, uploaded_by=pack.uploaded_by,
            original_name=f'{_safe_name(seg["name"])}.pdf', description=seg["name"][:255],
            ai_summary=seg["summary"], pack_source=pack, page_range=pages,
            ocr_status=DocumentOcrStatus.COMPLETED, extracted_text=text,
            ocr_processed_at=timezone.now(),
        )
        doc.file.save(f'{_safe_name(seg["name"])}.pdf', ContentFile(buf.getvalue()), save=False)
        doc.save()
        created += 1
        if required:
            item, _ = SubmissionChecklistItem.objects.get_or_create(submission=submission, document=required)
            item.is_present = True
            item.checked_by = pack.uploaded_by
            item.checked_at = timezone.now()
            item.save(update_fields=["is_present", "checked_by", "checked_at"])
        queue_document_classification(doc.id)
    return created

"""
A7 — Advisory check: does an uploaded paper show a signature on a Director-General /
Head of Agency approval block?

The DG approves a ministry paper on paper, outside SCDMS, and HR uploads the signed
copy. Nothing in the system can prove who signed, so this is only a hint for HR (before
they submit) and for the Secretary reading the brief: a vision model looks at the pages
for a signature-like mark on a DG approval block. It never blocks a submission and never
claims the signature is genuine.
"""

from __future__ import annotations

import base64
import logging
import re
from datetime import timezone as dt_timezone
from datetime import datetime
from pathlib import Path
from typing import Any

from ..models import Submission, SubmissionDocument
from .claude_client import ai_enabled, complete_json_with_images
from .document_extraction import MAX_IMAGE_BYTES, image_file_base64
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

FACTS_KEY = "dg_signature_check"
VERDICTS = ("seen", "not_seen", "unclear")
MAX_DOCS_PER_RUN = 3
MAX_PAGES = 3
_IMAGE_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff")

# A required-document slot for the DG's signed letter / approval, e.g. "DG's Endorsement
# Letter" or "Director-General's Endorsement Letter" (seeded for most form types).
_DG_NAME_RE = re.compile(r"\bdg\b|director.?general|head.?of.?agency", re.I)
_APPROVAL_WORD_RE = re.compile(r"endors|approv", re.I)
# Words that mark a page as carrying a DG approval block ...
_DG_BLOCK_RE = re.compile(
    r"director.?general|head.?of.?agency|\bdg\b|endorsed by|approved by|\bapproval\b", re.I,
)
# ... and, stricter, a whole document as worth a vision call at all (plain "approval"
# appears in almost every paper, so it is not enough on its own).
_DG_DOC_RE = re.compile(r"director.?general|head.?of.?agency|\bdg\b", re.I)

SYSTEM = """You help the Vanuatu Public Service Commission check scanned ministry papers.

Decide whether the pages show a handwritten signature, initials or signature stamp on a
Director-General / Head of Agency approval, endorsement or signature block (wording such as
"Approved by", "Endorsed by", "Director General", "DG", "Head of Agency").

You cannot tell who the signer is or whether a signature is genuine; only report what is
visible.

Output valid JSON only:
{
  "verdict": "seen" | "not_seen" | "unclear",
  "where": "short location, e.g. 'page 3, bottom, Director General block'",
  "note": "one short sentence"
}

- seen: a signature-like mark is visibly in, or directly beside, a DG / Head of Agency block.
- not_seen: a DG block is present but blank, or the pages have no such block or mark at all.
- unclear: the pages are too faint, cut off or low quality to tell."""


def is_dg_slot(required_document) -> bool:
    """True for a required-document slot that holds the DG's signed letter/approval."""
    name = getattr(required_document, "name", "") or ""
    return bool(_DG_NAME_RE.search(name) and _APPROVAL_WORD_RE.search(name))


def mentions_dg_block(text: str) -> bool:
    return bool(_DG_DOC_RE.search((text or "")[:20000]))


def _pages_to_check(path: Path) -> list[int]:
    """Pages worth sending: the ones whose own text mentions a DG approval block (the
    last few if there are many), else the cover page and the last two — approval
    blocks sit on a cover form or at the end of a letter. At most MAX_PAGES, which is
    what keeps one check to a single small model call."""
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        count = len(reader.pages)
        hits = [
            i for i in range(min(count, 30))
            if _DG_BLOCK_RE.search(reader.pages[i].extract_text() or "")
        ]
    except Exception:
        count, hits = 0, []
    if hits:
        return hits[-MAX_PAGES:]
    if not count:
        return [0]
    return sorted({0, *range(max(1, count - 2), count)})[:MAX_PAGES]


def _page_images(path: Path, original_name: str) -> list[tuple[str, str]]:
    lower = (original_name or "").lower()
    if lower.endswith(_IMAGE_SUFFIXES):
        return image_file_base64(path)
    if not lower.endswith(".pdf"):
        return []
    images: list[tuple[str, str]] = []
    try:
        import fitz

        doc = fitz.open(str(path))
        for i in _pages_to_check(path):
            if i >= len(doc):
                continue
            pix = doc[i].get_pixmap(matrix=fitz.Matrix(1.3, 1.3), alpha=False)
            data = pix.tobytes("jpeg")
            if len(data) > MAX_IMAGE_BYTES:
                continue
            images.append(("image/jpeg", base64.standard_b64encode(data).decode("ascii")))
        doc.close()
    except Exception as exc:
        logger.warning("DG_SIGNATURE_RASTERIZE_FAIL | %s", exc)
    return images


def check_document(path: Path, original_name: str) -> dict[str, str] | None:
    """Return {verdict, where, note}, or None when the pages couldn't be read or the
    model didn't answer."""
    images = _page_images(path, original_name)
    if not images:
        return None
    data, err = complete_json_with_images(
        system=SYSTEM,
        user_text=f"Document filename: {original_name}\nLook at the attached page images.",
        images=images,
        tier=FEATURE_MODEL_TIER.get("A7_dg_signature_hint", "sonnet"),
        max_tokens=512,
    )
    if err or not isinstance(data, dict):
        logger.info("DG_SIGNATURE_CHECK_SKIP | %s | %s", original_name, err)
        return None
    verdict = str(data.get("verdict") or "").strip().lower()
    if verdict not in VERDICTS:
        return None
    return {
        "verdict": verdict,
        "where": str(data.get("where") or "")[:200],
        "note": str(data.get("note") or "")[:300],
    }


def _ministry_paper(submission: Submission) -> bool:
    return not (submission.is_internal or submission.is_attachment or submission.secretary_only)


def check_and_store_document(doc: SubmissionDocument) -> bool:
    """Check one uploaded file (unless it was already checked) and keep the verdict in
    its extracted_facts. Returns True when a result was stored."""
    if not ai_enabled() or not _ministry_paper(doc.submission):
        return False
    name = doc.file.name if doc.file else ""
    if not name.lower().endswith((".pdf", *_IMAGE_SUFFIXES)):
        return False
    facts = doc.extracted_facts if isinstance(doc.extracted_facts, dict) else {}
    prior = facts.get(FACTS_KEY)
    if isinstance(prior, dict) and prior.get("file") == name:
        return False

    from ..media_access import materialize_file_field

    try:
        with materialize_file_field(doc.file) as path:
            result = check_document(path, doc.original_name or name)
    except Exception as exc:
        logger.warning("DG_SIGNATURE_CHECK_FAIL | doc=%s | %s", doc.id, exc)
        return False
    if not result:
        return False
    doc.extracted_facts = {
        **facts,
        FACTS_KEY: {
            **result,
            "file": name,
            "checked_at": datetime.now(dt_timezone.utc).isoformat(),
        },
    }
    doc.save(update_fields=["extracted_facts"])
    return True


def ensure_dg_signature_checks(submission: Submission) -> None:
    """Check the uploads that can carry the DG's signature and haven't been checked yet.

    Cheap by design: when the DG's signed letter was uploaded into its own checklist
    slot, only that file is checked. Otherwise only files whose OCR text mentions a DG
    approval block are (already-extracted text, so no extra model call to decide)."""
    if not ai_enabled() or not _ministry_paper(submission):
        return
    docs = list(
        SubmissionDocument.objects.filter(submission=submission)
        .select_related("required_document").order_by("uploaded_at")
    )
    targets = [d for d in docs if d.required_document_id and is_dg_slot(d.required_document)]
    if not targets:
        targets = [d for d in docs if mentions_dg_block(d.extracted_text)]
    for doc in targets[:MAX_DOCS_PER_RUN]:
        check_and_store_document(doc)


def dg_signature_gap(submission: Submission) -> dict[str, str] | None:
    """The package-check gap for the DG signature, from results already stored.
    Always a warning or info — the DG's approval is on paper, so this only nudges."""
    checks: list[tuple[str, str]] = []
    for doc in SubmissionDocument.objects.filter(submission=submission):
        facts = doc.extracted_facts if isinstance(doc.extracted_facts, dict) else {}
        check = facts.get(FACTS_KEY)
        if isinstance(check, dict) and check.get("verdict") in VERDICTS:
            checks.append((doc.original_name or "uploaded file", check["verdict"]))

    if any(verdict == "seen" for _, verdict in checks):
        return None
    unclear = [name for name, verdict in checks if verdict == "unclear"]
    if unclear:
        return {
            "severity": "info",
            "category": "endorsement",
            "message": (
                f"Could not tell whether '{unclear[0]}' carries your Director-General's "
                "signature — check the signed copy is attached and legible."
            ),
        }
    if checks:
        return {
            "severity": "warning",
            "category": "endorsement",
            "message": (
                "No Director-General signature was found on the uploaded papers — attach the "
                "paper signed by your Director-General."
            ),
        }
    return {
        "severity": "info",
        "category": "endorsement",
        "message": (
            "The Director-General's signature could not be checked automatically — make sure "
            "the paper signed by your Director-General is attached."
        ),
    }


def signature_hint_line(doc: SubmissionDocument) -> str | None:
    """One line for the AI brief context, or None if this document wasn't checked."""
    facts = doc.extracted_facts if isinstance(doc.extracted_facts, dict) else {}
    check = facts.get(FACTS_KEY)
    if not isinstance(check, dict) or check.get("verdict") not in VERDICTS:
        return None
    line = f"  DG signature (AI hint, unverified): {check['verdict'].replace('_', ' ')}"
    if check.get("where"):
        line += f" — {check['where']}"
    return line

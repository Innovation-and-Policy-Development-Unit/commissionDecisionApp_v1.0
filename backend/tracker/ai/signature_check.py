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
MAX_DOCS_PER_RUN = 6
MAX_PAGES = 6
_IMAGE_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff")

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


def _page_images(path: Path, original_name: str) -> list[tuple[str, str]]:
    """Pages to look at: every page of a short PDF, else the first two and last four
    (approval blocks sit at the front of a cover form or the end of a letter)."""
    lower = (original_name or "").lower()
    if lower.endswith(_IMAGE_SUFFIXES):
        return image_file_base64(path)
    if not lower.endswith(".pdf"):
        return []
    images: list[tuple[str, str]] = []
    try:
        import fitz

        doc = fitz.open(str(path))
        count = len(doc)
        indexes = list(range(count)) if count <= MAX_PAGES else [0, 1, *range(count - 4, count)]
        for i in indexes:
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


def ensure_dg_signature_checks(submission: Submission) -> None:
    """Check this submission's uploaded papers that haven't been checked yet, and
    store each result in the document's extracted_facts. Ministry-origin only, at
    most MAX_DOCS_PER_RUN documents per run, and a no-op when AI is off."""
    if not ai_enabled():
        return
    if submission.is_internal or submission.is_attachment or submission.secretary_only:
        return

    from ..media_access import materialize_file_field

    attempted = 0
    for doc in SubmissionDocument.objects.filter(submission=submission).order_by("uploaded_at"):
        if attempted >= MAX_DOCS_PER_RUN:
            break
        name = doc.file.name if doc.file else ""
        if not name.lower().endswith((".pdf", *_IMAGE_SUFFIXES)):
            continue
        facts = doc.extracted_facts if isinstance(doc.extracted_facts, dict) else {}
        prior = facts.get(FACTS_KEY)
        if isinstance(prior, dict) and prior.get("file") == name:
            continue
        attempted += 1
        try:
            with materialize_file_field(doc.file) as path:
                result = check_document(path, doc.original_name or name)
        except Exception as exc:
            logger.warning("DG_SIGNATURE_CHECK_FAIL | doc=%s | %s", doc.id, exc)
            continue
        if not result:
            continue
        doc.extracted_facts = {
            **facts,
            FACTS_KEY: {
                **result,
                "file": name,
                "checked_at": datetime.now(dt_timezone.utc).isoformat(),
            },
        }
        doc.save(update_fields=["extracted_facts"])


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

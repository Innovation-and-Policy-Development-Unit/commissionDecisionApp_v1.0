"""
Advisory check of the scanned, signed minutes: who appears to have signed?

After the signed scan is uploaded, a vision model looks at only the pages that
matter — page 1 (meeting number and date) and the last few pages (closing
prayer, the "checked by" and "verified as true minutes by" signature tables and
the page footer) — never the pages of decisions. The result is compared with who
*should* have signed (the Chairman, each member recorded present, and the
Secretary) and stored on the minutes so the page can show a table of who signed
without anybody opening the scan.

Like the DG signature check this is a hint: it reports what is visible, cannot
tell whose hand a signature is or whether it is genuine, and the Secretary
confirms each row. It never blocks anything.
"""

from __future__ import annotations

import base64
import logging
import re
import tempfile
from datetime import date, datetime
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from django.utils import timezone

from .claude_client import ai_enabled, complete_json_with_images
from .document_extraction import MAX_IMAGE_BYTES, image_file_base64
from .feature_registry import FEATURE_MODEL_TIER

logger = logging.getLogger("scdms.app")

VERDICTS = ("seen", "not_seen", "unclear")
TAIL_PAGES = 3
_IMAGE_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff")
_TITLE_WORDS = {"commissioner", "chairman", "chairperson", "member", "hon", "mr", "mrs", "ms", "dr", "acting", "secretary", "psc"}

SYSTEM = """You help the Vanuatu Public Service Commission check a scanned, signed copy of its meeting minutes.

You are shown page 1 and the last pages of the scan. Read ONLY what is visible and report it as JSON.

1. header: the meeting number and date printed in the "Meeting Name" line on page 1
   (e.g. "Public Service Commission Meeting No. 23 of Friday 02nd October 2026").
2. footer: the page label printed in the bottom-right corner of the LAST page (e.g. "96 of 96").
3. rows: every row of the signature tables ("Minutes checked by" and "Verified as true
   meeting minutes by"): the position (Chairman, Member, Acting Secretary - PSC ...), the
   printed name, whether a handwritten signature or initials are visible in the Signature
   cell, and the date written beside it. A table can continue on the next page.
   signature = "seen" when there is clearly ink in the Signature cell, "not_seen" when the
   cell is blank, "unclear" when you cannot tell (faint, cut off, blurred).
4. stamp_seen: whether an official stamp/seal is visible near the signatures.

You cannot tell whose signature it is or whether it is genuine; only report what is visible.
Never invent names or dates: use null when something is not readable.

Output valid JSON only:
{
  "header": {"meeting_number": "23" | null, "meeting_date": "YYYY-MM-DD" | null},
  "footer": {"last_page_label": "96 of 96" | null},
  "rows": [
    {"section": "checked_by" | "verified_by", "position": "Chairman", "name": "Meto Kaltuepunu Nganga",
     "signature": "seen" | "not_seen" | "unclear", "date": "05/11/2026" | null}
  ],
  "stamp_seen": true | false | null,
  "note": "one short sentence about anything odd, or empty"
}"""


# ── Who should have signed ───────────────────────────────────────────────────

def expected_signers(content: dict) -> list[dict[str, str]]:
    """Chairman, present members and the Secretary, from the recorded attendance."""
    attendance = (content or {}).get("attendance") or {}
    out: list[dict[str, str]] = []
    secretary = None
    for person in attendance.get("in_attendance") or []:
        if "secretary" in (person.get("role") or "").lower():
            secretary = {"role": person.get("role") or "Secretary - PSC", "name": person.get("name", "")}
            break
    if secretary:
        out.append(secretary)
    members = [m for m in attendance.get("members") or [] if m.get("status") == "present"]
    out += [{"role": "Chairman", "name": m["name"]} for m in members if (m.get("role") or "").lower() == "chairman"]
    out += [{"role": "Member", "name": m["name"]} for m in members if (m.get("role") or "").lower() != "chairman"]
    return out


def _tokens(name: str) -> set[str]:
    words = re.findall(r"[a-z]+", (name or "").lower())
    return {w for w in words if w not in _TITLE_WORDS}


def name_similarity(a: str, b: str) -> float:
    """Order-insensitive, forgiving name match ("Edward Jimmy" ~ "Jimmy Edward")."""
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    if inter and (ta <= tb or tb <= ta):
        return 1.0
    jaccard = inter / len(ta | tb)
    fuzzy = SequenceMatcher(None, " ".join(sorted(ta)), " ".join(sorted(tb))).ratio()
    return max(jaccard, fuzzy)


MATCH_THRESHOLD = 0.6


def combine(expected: list[dict], scanned: list[dict]) -> list[dict[str, Any]]:
    """One row per expected signer (matched to the scan, else not seen), then any
    extra rows that only appear on the scan. Row ids are stable within a result."""
    rows: list[dict[str, Any]] = []
    unused = list(range(len(scanned)))

    def make(role, name, expected_flag, scan_row, note=""):
        n = len(rows) + 1
        return {
            "id": f"r{n}",
            "role": role,
            "name": name,
            "expected": expected_flag,
            "scan_name": (scan_row or {}).get("name", "") if scan_row else "",
            "verdict": (scan_row or {}).get("verdict", "not_seen"),
            "date_text": (scan_row or {}).get("date", "") if scan_row else "",
            "note": note,
            "confirmed_by": "",
            "confirmed_at": "",
        }

    for person in expected:
        best, best_score = None, 0.0
        for i in unused:
            score = name_similarity(person["name"], scanned[i]["name"])
            if score > best_score:
                best, best_score = i, score
        if best is not None and best_score >= MATCH_THRESHOLD:
            unused.remove(best)
            rows.append(make(person["role"], person["name"], True, scanned[best]))
        else:
            rows.append(make(person["role"], person["name"], True, None, "No row with this name found on the scan."))
    for i in unused:
        rows.append(make(scanned[i]["position"] or "Signer", scanned[i]["name"], False, scanned[i], "Appears on the scan only."))
    return rows


def summarise(rows: list[dict]) -> dict[str, Any]:
    """Counts. A row counts as signed when the scan shows it or the Secretary confirmed it."""
    expected = [r for r in rows if r.get("expected")] or rows
    signed = [r for r in expected if r["verdict"] == "seen" or r.get("confirmed_by")]
    missing = [r["name"] or r["role"] for r in expected if r not in signed]
    return {"expected": len(expected), "signed": len(signed), "missing": missing}


# ── Reading the scan ─────────────────────────────────────────────────────────

def page_images(path: Path, original_name: str) -> tuple[list[tuple[str, str]], list[int], int]:
    """(images, page numbers used, total pages). Page 1 plus the last pages."""
    if original_name.lower().endswith(_IMAGE_SUFFIXES):
        return image_file_base64(path), [1], 1
    import fitz

    doc = fitz.open(str(path))
    try:
        total = len(doc)
        wanted = sorted({0, *range(max(0, total - TAIL_PAGES), total)})
        images, used = [], []
        for i in wanted:
            data = doc[i].get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).tobytes("jpeg")
            if len(data) > MAX_IMAGE_BYTES:
                data = doc[i].get_pixmap(matrix=fitz.Matrix(1.1, 1.1), alpha=False).tobytes("jpeg")
            if len(data) > MAX_IMAGE_BYTES:
                continue
            images.append(("image/jpeg", base64.standard_b64encode(data).decode("ascii")))
            used.append(i + 1)
        return images, used, total
    finally:
        doc.close()


def _parse_date(text: Any) -> date | None:
    try:
        return datetime.strptime(str(text)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _clean_scan(data: dict) -> tuple[list[dict], dict, dict, Any, str]:
    rows = []
    for r in (data.get("rows") or [])[:40]:
        if not isinstance(r, dict) or not str(r.get("name") or "").strip():
            continue
        verdict = str(r.get("signature") or "").strip().lower()
        rows.append({
            "name": str(r["name"]).strip()[:150],
            "position": str(r.get("position") or "").strip()[:80],
            "verdict": verdict if verdict in VERDICTS else "unclear",
            "date": str(r.get("date") or "").strip()[:20],
        })
    header = data.get("header") if isinstance(data.get("header"), dict) else {}
    footer = data.get("footer") if isinstance(data.get("footer"), dict) else {}
    stamp = data.get("stamp_seen") if isinstance(data.get("stamp_seen"), bool) else None
    return rows, header, footer, stamp, str(data.get("note") or "").strip()[:300]


def evaluate(minutes, path: Path, original_name: str) -> tuple[dict | None, str | None]:
    """Run the vision check. Returns (result, error)."""
    images, used, total = page_images(path, original_name)
    if not images:
        return None, "Could not read any page of the scan."
    meeting = minutes.meeting
    expected = expected_signers(minutes.content or {})
    hint = ", ".join(f'{p["role"]}: {p["name"]}' for p in expected) or "not recorded"
    user_text = (
        f"The scan has {total} page(s); the attached images are pages {', '.join(map(str, used))}.\n"
        f"The sitting is {meeting.reference_number} dated {meeting.date}"
        + (f", PSC meeting number {meeting.psc_meeting_number}" if meeting.psc_meeting_number else "")
        + f".\nPeople expected to sign (for your information only; report what is actually on the page): {hint}."
    )
    data, err = complete_json_with_images(
        system=SYSTEM, user_text=user_text, images=images,
        tier=FEATURE_MODEL_TIER.get("minutes_signature_check", "sonnet"), max_tokens=2048,
    )
    if err or not isinstance(data, dict):
        return None, err or "Empty AI response."

    scanned, header, footer, stamp, note = _clean_scan(data)
    rows = combine(expected, scanned)

    number = str(header.get("meeting_number") or "").strip()
    seen_date = _parse_date(header.get("meeting_date"))
    matches = None
    if number and meeting.psc_meeting_number:
        matches = number.lstrip("0") == meeting.psc_meeting_number.strip().lstrip("0")
    if matches is not False and seen_date is not None:
        matches = (seen_date == meeting.date) if matches is None else matches and seen_date == meeting.date

    label = str(footer.get("last_page_label") or "").strip()[:20]
    hit = re.search(r"(\d+)\s*of\s*(\d+)", label, re.I)
    complete = None
    if hit:
        complete = int(hit.group(2)) == total and int(hit.group(1)) == total

    return {
        "status": "done",
        "checked_at": timezone.now().isoformat(),
        "page_count": total,
        "pages_read": used,
        "header": {"meeting_number": number, "meeting_date": str(seen_date or ""), "matches_sitting": matches},
        "footer": {"last_page_label": label, "complete": complete},
        "stamp_seen": stamp,
        "rows": rows,
        "summary": summarise(rows),
        "note": note,
    }, None


def run_signature_check(minutes_id: int) -> tuple[bool, str | None, bool]:
    """Load the stored scan, check it, store the result on the minutes.
    Returns (ok, error, retryable)."""
    from ..models import AIGenerationLog, Minutes
    from .claude_client import is_retryable_ai_error
    from .reliability import FEATURE_MINUTES_SIGNATURES, log_ai_call, timed_call

    minutes = Minutes.objects.select_related("meeting").filter(pk=minutes_id).first()
    if minutes is None or not minutes.signed_document:
        return False, "No signed scan on record.", False
    if not ai_enabled():
        Minutes.objects.filter(pk=minutes_id).update(
            signature_check={"status": "unavailable", "note": "AI is not configured."})
        return False, "AI is not configured.", False

    name = minutes.signed_document.name
    storage = minutes.signed_document.storage
    suffix = Path(name).suffix or ".pdf"
    try:
        with tempfile.TemporaryDirectory() as tmp:
            local = Path(tmp) / f"scan{suffix}"
            with storage.open(name, "rb") as src:
                local.write_bytes(src.read())
            with timed_call() as elapsed:
                result, err = evaluate(minutes, local, Path(name).name)
    except Exception as exc:  # unreadable/corrupt scan — report, don't crash the worker
        logger.exception("MINUTES_SIGNATURE_CHECK_FAIL | minutes=%s", minutes_id)
        result, err = None, f"Could not read the scan: {exc}"
        elapsed = lambda: 0  # noqa: E731

    log_ai_call(
        feature=FEATURE_MINUTES_SIGNATURES,
        status=AIGenerationLog.Status.SUCCESS if result else AIGenerationLog.Status.FAILED,
        error_detail=err or "", latency_ms=elapsed(),
    )
    if result is None:
        retryable = is_retryable_ai_error(err or "")
        if not retryable:
            Minutes.objects.filter(pk=minutes_id).update(signature_check={"status": "failed", "note": (err or "")[:300]})
        return False, err, retryable
    Minutes.objects.filter(pk=minutes_id).update(signature_check=result)
    return True, None, False

"""Context for the minutes PDF, laid out like the Commission's own signed minutes.

Page 1 (portrait) is the bilingual letterhead and the meeting details table:
meeting name, date / time / venue, attendees, absent, apologies, opening prayer.
The decisions follow on landscape pages as a four-column table (Agenda,
Decision No., Discussion of Recommendation(s), Decision with the Action Officer
line). The last page carries the closing prayer, meeting end time and the
signature table: checked by the Secretary, verified as a true record by the
Chairman and each Member, with room to sign and date.
"""

from __future__ import annotations

import base64
import re
from datetime import date, datetime
from pathlib import Path

from django.utils.html import format_html
from django.utils.safestring import mark_safe

from .action_officer import officer_text_for_block
from .minute_attendance import attendance_for_print

EMBLEM_PATH = Path(__file__).parent / "static" / "tracker" / "vanuatu-emblem.png"
BLANK_MEMBER_ROWS = 4  # when attendance was never recorded


def ordinal(n: int) -> str:
    if 10 <= n % 100 <= 20:
        return "th"
    return {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")


def _as_date(value):
    if isinstance(value, str):
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return value if isinstance(value, date) else None


def long_date(value) -> str:
    """Friday 02nd October 2026 — the Commission's own style."""
    d = _as_date(value)
    if d is None:
        return value if isinstance(value, str) else ""
    return f"{d:%A} {d.day:02d}{ordinal(d.day)} {d:%B %Y}"


def long_date_html(value) -> str:
    """Same, with the ordinal raised (02<sup>nd</sup>) as in the printed minutes."""
    d = _as_date(value)
    if d is None:
        return long_date(value)
    return format_html("{} {}<sup>{}</sup> {}", f"{d:%A}", f"{d.day:02d}", ordinal(d.day), f"{d:%B %Y}")


def time_ampm(value) -> str:
    """09:36 am from "09:36" or a time object."""
    if hasattr(value, "strftime"):
        return value.strftime("%I:%M %p").lower()
    text = str(value or "").strip()[:5]
    try:
        return datetime.strptime(text, "%H:%M").strftime("%I:%M %p").lower()
    except ValueError:
        return text


def emblem_data_uri() -> str:
    try:
        return "data:image/png;base64," + base64.b64encode(EMBLEM_PATH.read_bytes()).decode("ascii")
    except OSError:
        return ""


def meeting_name(meeting) -> str:
    number = (getattr(meeting, "psc_meeting_number", "") or "").strip()
    if number:
        return f"Public Service Commission Meeting No. {number} of {long_date(meeting.date)}"
    return meeting.title


def meeting_name_html(meeting):
    number = (getattr(meeting, "psc_meeting_number", "") or "").strip()
    if number:
        return format_html("Public Service Commission Meeting No. {} of {}", number, long_date_html(meeting.date))
    return meeting.title


def _rows(content: dict) -> list[dict]:
    rows: list[dict] = []
    if (content.get("opening") or "").strip():
        rows.append({"agenda": "Opening", "discussion": content["opening"]})
    if (content.get("confirmation_previous_minutes") or "").strip():
        rows.append({"agenda": "Confirmation of previous minutes", "decision": content["confirmation_previous_minutes"]})

    for index, item in enumerate(content.get("agenda_items") or [], start=1):
        if not isinstance(item, dict):
            continue
        label = f"{index:02d}. {item.get('title') or ''}".strip()
        if item.get("restricted"):
            rows.append({
                "agenda": label,
                "note": "This agenda item relates to another OPSC unit and has been omitted from this copy.",
            })
            continue
        decision = (item.get("decision") or "").strip()
        officer = officer_text_for_block(item)
        # The Action Officer line is the last line of the Decision cell, as in the
        # signed minutes. Skip it when the decision text already carries it.
        show_officer = officer and "action officer" not in decision.lower()
        rows.append({
            "agenda": label,
            "ref": item.get("submission_ref") or "",
            "decision_number": item.get("decision_number") or "",
            "discussion": item.get("discussion") or "",
            "decision": decision,
            "officer": officer if show_officer else "",
            "action_items": [a for a in (item.get("action_items") or []) if isinstance(a, dict) and a.get("action")],
        })

    if (content.get("any_other_business") or "").strip():
        rows.append({"agenda": "Any other business", "decision": content["any_other_business"]})
    return rows


def _signers(attendance: dict | None) -> dict:
    """Who checks and who verifies the minutes, from the recorded attendance."""
    secretary = {"position": "Secretary - PSC", "name": ""}
    chairman = {"name": ""}
    members: list[dict] = []
    if attendance:
        for person in attendance.get("in_attendance") or []:
            if "secretary" in (person.get("role") or "").lower():
                secretary = {"position": person.get("role") or secretary["position"], "name": person.get("name", "")}
                break
        for person in attendance.get("present") or []:
            if (person.get("role") or "").lower() == "chairman":
                chairman = {"name": person["name"]}
            else:
                members.append({"name": person["name"]})
    if not attendance or not members:
        members = members or [{"name": ""} for _ in range(BLANK_MEMBER_ROWS)]
    return {"secretary": secretary, "chairman": chairman, "members": members}


def print_layout(minutes, content: dict) -> dict:
    """JSON for the on-screen view: exactly what the PDF prints, so they cannot drift."""
    meeting = minutes.meeting
    attendance = attendance_for_print((content or {}).get("attendance"))
    start = (attendance or {}).get("start_time") or meeting.time
    end = (attendance or {}).get("end_time")
    return {
        "meeting_name": meeting_name(meeting),
        "date_long": long_date(meeting.date),
        "time_text": time_ampm(start),
        "end_time_text": time_ampm(end) if end else "",
        "venue": meeting.venue,
        "attendance": attendance,
        "rows": _rows(content or {}),
        "signers": _signers(attendance),
        "closing": ((content or {}).get("closing") or "").strip(),
        "next_meeting_date": ((content or {}).get("next_meeting_date") or "").strip(),
    }


def build_context(minutes, content: dict, *, status_label: str, signature_data_uri) -> dict:
    meeting = minutes.meeting
    attendance = attendance_for_print(content.get("attendance"))
    start = (attendance or {}).get("start_time") or meeting.time
    return {
        "meeting": meeting,
        "minutes": minutes,
        "content": content,
        "meeting_name": meeting_name(meeting),
        "meeting_name_html": meeting_name_html(meeting),
        "date_long": long_date(meeting.date),
        "date_long_html": long_date_html(meeting.date),
        "time_text": time_ampm(start),
        "end_time_text": time_ampm((attendance or {}).get("end_time")) if (attendance or {}).get("end_time") else "",
        "attendance": attendance,
        "rows": _rows(content),
        "signers": _signers(attendance),
        "status_label": status_label,
        "unsigned": minutes.status != "signed",
        "signature_data_uri": signature_data_uri,
        "emblem_data_uri": emblem_data_uri(),
        "next_meeting_date": (content.get("next_meeting_date") or "").strip(),
        "closing": (content.get("closing") or "").strip(),
    }

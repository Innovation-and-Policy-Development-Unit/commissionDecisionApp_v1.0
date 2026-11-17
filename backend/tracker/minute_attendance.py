"""Attendance for a sitting's minutes: who was present, absent or sent apologies.

Captured on the Minute intake screen (stored on ``Meeting.minute_attendance``),
copied into ``Minutes.content["attendance"]`` when the intake is applied, and
printed in the minutes header. Pre-filled from the Commission roster so the
minute-taker only has to flip the exceptions.
"""

from __future__ import annotations

import re
from typing import Any

from django.conf import settings
from django.contrib.auth.models import User

from .models import Role

STATUSES = ("present", "absent", "apology")
MAX_PEOPLE = 40
_TIME_RE = re.compile(r"^([01]?\d|2[0-3]):[0-5]\d$")

ROSTER_ROLES = (Role.CHAIRPERSON, Role.PSC_COMMISSIONER, Role.COMMISSION_MEMBER)
ROLE_LABELS = {Role.CHAIRPERSON: "Chairman"}  # everyone else on the roster is a "Commissioner"


def _name(user: User) -> str:
    return (user.get_full_name() or user.username).strip()


def default_attendance(meeting) -> dict[str, Any]:
    """Roster of Commission members, everyone marked present, Chairman first."""
    users = (
        User.objects.filter(is_active=True, psc_profile__role__in=ROSTER_ROLES)
        .select_related("psc_profile")
        .order_by("last_name", "first_name", "username")
    )
    members = [
        {
            "user_id": u.id,
            "name": _name(u),
            "role": ROLE_LABELS.get(u.psc_profile.role, "Commissioner"),
            "status": "present",
            "arrived": "",
            "left": "",
        }
        for u in users
    ]
    members.sort(key=lambda m: m["role"] != "Chairman")
    return {
        "start_time": meeting.time.strftime("%H:%M") if getattr(meeting.time, "strftime", None) else str(meeting.time or "")[:5],
        "opening_prayer_by": "",
        "closing_prayer_by": "",
        "end_time": "",
        "members": members,
        "in_attendance": [],
    }


def secretariat_suggestions() -> list[dict[str, str]]:
    """One-click 'in attendance' suggestions: the Secretary / Acting Secretary."""
    users = User.objects.filter(is_active=True, psc_profile__role=Role.PSC_SECRETARY).select_related("psc_profile")
    return [{"name": _name(u), "role": "Secretary - PSC"} for u in users]


def get_attendance(meeting) -> tuple[dict[str, Any], bool]:
    """(attendance, saved). ``saved`` is False while it is still the roster default."""
    saved = meeting.minute_attendance
    if isinstance(saved, dict) and saved.get("members") is not None:
        return saved, True
    return default_attendance(meeting), False


def _text(value: Any, limit: int) -> str:
    return str(value or "").strip()[:limit]


def _time(value: Any, field: str) -> str:
    value = _text(value, 5)
    if value and not _TIME_RE.match(value):
        raise ValueError(f"{field} must be a time like 09:36.")
    return value


def clean_attendance(data: Any) -> dict[str, Any]:
    """Validate and normalise attendance from the client. Raises ValueError."""
    if not isinstance(data, dict):
        raise ValueError("Attendance must be an object.")
    members_in = data.get("members") or []
    others_in = data.get("in_attendance") or []
    if not isinstance(members_in, list) or not isinstance(others_in, list):
        raise ValueError("Attendance lists are invalid.")
    if len(members_in) > MAX_PEOPLE or len(others_in) > MAX_PEOPLE:
        raise ValueError("Too many people listed.")

    members = []
    for m in members_in:
        if not isinstance(m, dict):
            raise ValueError("Attendance entry is invalid.")
        status = m.get("status")
        if status not in STATUSES:
            raise ValueError("Each member must be present, absent or an apology.")
        name = _text(m.get("name"), 150)
        if not name:
            raise ValueError("Each member needs a name.")
        user_id = m.get("user_id")
        members.append({
            "user_id": user_id if isinstance(user_id, int) else None,
            "name": name,
            "role": _text(m.get("role"), 80),
            "status": status,
            "arrived": _time(m.get("arrived"), "Arrival time") if status == "present" else "",
            "left": _time(m.get("left"), "Departure time") if status == "present" else "",
        })

    others = []
    for o in others_in:
        if not isinstance(o, dict):
            raise ValueError("Attendance entry is invalid.")
        name = _text(o.get("name"), 150)
        if name:
            others.append({"name": name, "role": _text(o.get("role"), 120)})

    return {
        "start_time": _time(data.get("start_time"), "Start time"),
        "opening_prayer_by": _text(data.get("opening_prayer_by"), 150),
        "closing_prayer_by": _text(data.get("closing_prayer_by"), 150),
        "end_time": _time(data.get("end_time"), "End time"),
        "members": members,
        "in_attendance": others,
    }


def quorum_info(attendance: dict[str, Any]) -> dict[str, Any]:
    """Present vs needed. Needed is ``settings.COMMISSION_QUORUM`` if set, else a
    simple majority of the roster — a prompt to confirm quorum, not a legal ruling."""
    members = attendance.get("members") or []
    total = len(members)
    present = sum(1 for m in members if m.get("status") == "present")
    configured = getattr(settings, "COMMISSION_QUORUM", None)
    needed = int(configured) if configured else (total // 2 + 1 if total else 0)
    return {"present": present, "total": total, "needed": needed, "met": total == 0 or present >= needed}


def attendance_for_print(attendance: dict[str, Any] | None) -> dict[str, Any] | None:
    """Group attendance for the minutes header; None when none was recorded."""
    if not attendance or attendance.get("members") is None:
        return None

    def label(m):
        bits = []
        if m.get("arrived"):
            bits.append(f"arrived {m['arrived']}")
        if m.get("left"):
            bits.append(f"left {m['left']}")
        return {"name": m["name"], "role": m.get("role", ""), "note": ", ".join(bits)}

    members = attendance["members"]
    return {
        "start_time": attendance.get("start_time", ""),
        "opening_prayer_by": attendance.get("opening_prayer_by", ""),
        "closing_prayer_by": attendance.get("closing_prayer_by", ""),
        "end_time": attendance.get("end_time", ""),
        "present": [label(m) for m in members if m["status"] == "present"],
        "absent": [label(m) for m in members if m["status"] == "absent"],
        "apologies": [label(m) for m in members if m["status"] == "apology"],
        "in_attendance": attendance.get("in_attendance", []),
    }

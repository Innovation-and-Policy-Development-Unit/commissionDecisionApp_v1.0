"""The Commission's agenda as one document, built once and used everywhere.

The on-screen Agenda page, the PDF download and the PDF emailed to Commissioners all come from
`build_agenda_document`, so they cannot drift apart. The layout follows the Commission's own
agenda: one bordered table, three title lines, then

    1  Adoption of Agenda
    2  MINUTE (confirmation of endorsement of the previous sitting's minutes)
    3  MATTERS ARISING (grouped by the sitting they were first tabled at)
       HEADING IN CAPITALS (not numbered)
    4  first submission, 5 ... numbered on from there

Each submission's number (`AgendaItem.agenda_no`) is stored. It is renumbered automatically while the
agenda is being built and frozen when the agenda is circulated, so what the Commissioners were sent,
the minutes and later Matters Arising references always agree.
"""
from __future__ import annotations

import html as _html
import re
import threading
from datetime import date

from .models import AgendaItem, AgendaSection, AgendaStatus, Meeting, Role

SPECIAL_CATEGORIES = ("preliminaries", "matters_arising")
FIRST_ITEM_NO = 4
OTHER_HEADING = "OTHER BUSINESS"
_guard = threading.local()

_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# ── names and dates ─────────────────────────────────────────────────────────

def meeting_no(meeting) -> str:
    """The Commission's own sitting number; falls back to the digits of the system reference."""
    own = (getattr(meeting, "psc_meeting_number", "") or "").strip()
    if own:
        return own
    m = re.search(r"(\d+)$", meeting.reference_number or "")
    return str(int(m.group(1))) if m else (meeting.reference_number or "")


def _suffix(n: int) -> str:
    return "th" if 10 < n % 100 < 14 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")


def ordinal_long(d: date) -> str:
    """'Friday 07th August 2026', the form the Commission's agendas use."""
    return f"{_DAYS[d.weekday()]} {d.day:02d}{_suffix(d.day)} {_MONTHS[d.month - 1]} {d.year}"


def meeting_label(meeting) -> str:
    return f"PSC Meeting No. {meeting_no(meeting)} of {ordinal_long(meeting.date)}"


def time_label(meeting) -> str:
    t = meeting.time
    if not t:
        return ""
    hour = t.hour if hasattr(t, "hour") else int(str(t).split(":")[0])
    minute = t.minute if hasattr(t, "minute") else int(str(t).split(":")[1])
    return f"{hour % 12 or 12}.{minute:02d} {'PM' if hour >= 12 else 'AM'}"


def title_lines(meeting) -> list[str]:
    d = meeting.date
    lines = [f"AGENDA OF PSC MEETING No. {meeting_no(meeting)} OF {_DAYS[d.weekday()].upper()} {d.day} {_MONTHS[d.month - 1].upper()} {d.year}"]
    venue = (meeting.venue or "").strip()
    if venue:
        lines.append((venue if venue.upper().startswith("AT ") else f"AT THE {venue}").upper() + ",")
    tl = time_label(meeting)
    if tl:
        lines.append(f"TIME {tl}.")
    return lines


# ── order and numbering ─────────────────────────────────────────────────────

def _heading_key(h: str) -> str:
    return re.sub(r"\s+", " ", (h or "").strip()).lower()


def ordered_blocks(meeting) -> list[dict]:
    """Numbered items in printed order, grouped under their headings.

    Sections are taken in the administrator's display order. Neighbouring sections that share a heading
    are merged under it. Items whose section no longer exists go under OTHER BUSINESS at the end."""
    sections = [s for s in AgendaSection.objects.order_by("display_order", "id") if s.code not in SPECIAL_CATEGORIES]
    items = list(
        AgendaItem.objects.filter(meeting=meeting).exclude(category__in=SPECIAL_CATEGORIES)
        .select_related("submission", "submission__ministry")
    )
    by_code: dict[str, list] = {}
    for it in items:
        by_code.setdefault(it.category or "other", []).append(it)

    blocks: list[dict] = []
    seen = set()
    for s in sections:
        its = by_code.get(s.code, [])
        seen.add(s.code)
        if not its:
            continue
        heading = (s.agenda_heading or s.label or s.code).strip().upper()
        if blocks and _heading_key(blocks[-1]["heading"]) == _heading_key(heading):
            blocks[-1]["items"].extend(its); blocks[-1]["codes"].append(s.code)
        else:
            blocks.append({"heading": heading, "codes": [s.code], "items": list(its)})
    stray = [it for code, its in by_code.items() if code not in seen for it in its]
    if stray:
        if blocks and _heading_key(blocks[-1]["heading"]) == _heading_key(OTHER_HEADING):
            blocks[-1]["items"].extend(stray)
        else:
            blocks.append({"heading": OTHER_HEADING, "codes": ["other"], "items": stray})
    for b in blocks:  # inside a heading: section order was kept above; within a section by sequence
        order = {code: i for i, code in enumerate(b["codes"])}
        b["items"].sort(key=lambda it: (it.is_flying, order.get(it.category or "other", 99), it.sequence, it.id))
    return blocks


def renumber_agenda(meeting) -> None:
    """Number the agenda's items. Fully while it is being built; only new items once it is circulated."""
    if getattr(_guard, "busy", False):
        return
    _guard.busy = True
    try:
        meeting = Meeting.objects.get(pk=meeting.pk)
        flat = [it for b in ordered_blocks(meeting) for it in b["items"]]
        if meeting.agenda_status == AgendaStatus.CIRCULATED:
            last = max([it.agenda_no or 0 for it in flat] + [FIRST_ITEM_NO - 1])
            for it in flat:
                if it.agenda_no is None:
                    last += 1
                    AgendaItem.objects.filter(pk=it.pk).update(agenda_no=last)
        else:
            for i, it in enumerate(flat):
                if it.agenda_no != FIRST_ITEM_NO + i:
                    AgendaItem.objects.filter(pk=it.pk).update(agenda_no=FIRST_ITEM_NO + i)
        AgendaItem.objects.filter(meeting=meeting, category__in=SPECIAL_CATEGORIES).exclude(agenda_no=None).update(agenda_no=None)
    finally:
        _guard.busy = False


def ensure_agenda_numbers(meeting) -> None:
    """Fill in any missing numbers (older agendas, or items added by a path that skipped the signal)."""
    if AgendaItem.objects.filter(meeting=meeting, agenda_no__isnull=True).exclude(category__in=SPECIAL_CATEGORIES).exists():
        renumber_agenda(meeting)


# ── Matters Arising, worked out from where the paper was first tabled ───────

def derive_matters_arising(item) -> tuple[str, str]:
    """(sitting label, 'Agenda NN') for a Matters Arising item.

    Taken from the paper's earlier placement when there is one, so the references on the agenda are right
    without anyone typing them. Text typed by the Secretariat is used when nothing can be derived."""
    typed_ref = (item.matters_arising_meeting_ref or "").strip()
    typed_no = (item.matters_arising_agenda_no or "").strip()

    prev_meeting = Meeting.objects.filter(reference_number=typed_ref).first() if typed_ref else None
    qs = AgendaItem.objects.filter(submission_id=item.submission_id, meeting__date__lt=item.meeting.date).exclude(meeting=item.meeting)
    if prev_meeting:
        qs = qs.filter(meeting=prev_meeting)
    prev_item = qs.select_related("meeting").order_by("-meeting__date", "-added_at").first()
    if prev_item and not prev_meeting:
        prev_meeting = prev_item.meeting

    label = meeting_label(prev_meeting) if prev_meeting else (typed_ref or "Previous meetings")
    if prev_item is not None:
        if prev_item.agenda_no is None:
            ensure_agenda_numbers(prev_item.meeting)
            prev_item.refresh_from_db(fields=["agenda_no"])
        if prev_item.agenda_no:
            return label, f"Agenda {prev_item.agenda_no:02d}"
    if typed_no:
        if typed_no.lower().startswith("agenda"):
            return label, typed_no
        return label, f"Agenda {int(typed_no):02d}" if typed_no.isdigit() else f"Agenda {typed_no}"
    return label, ""


# ── the document ────────────────────────────────────────────────────────────

def _signatory() -> dict:
    from django.contrib.auth import get_user_model

    from .models import SystemSetting

    name = (SystemSetting.objects.filter(key="AGENDA_SIGNATORY_NAME").values_list("value", flat=True).first() or "").strip()
    title = (SystemSetting.objects.filter(key="AGENDA_SIGNATORY_TITLE").values_list("value", flat=True).first() or "").strip()
    if not name:
        u = get_user_model().objects.filter(is_active=True, psc_profile__role=Role.CSU_MANAGER).order_by("id").first()
        if u:
            name = (u.get_full_name() or u.username).strip()
            title = title or "Manager CSU"
    return {"name": name, "title": title, "office": "Office of the Public Service Commission"} if name else {}


def build_agenda_document(meeting) -> dict:
    ensure_agenda_numbers(meeting)
    prev = Meeting.objects.filter(date__lt=meeting.date).exclude(pk=meeting.pk).order_by("-date", "-id").first()

    prelim = list(
        AgendaItem.objects.filter(meeting=meeting, category="preliminaries")
        .select_related("submission").order_by("sequence", "id")
    )
    arising = list(
        AgendaItem.objects.filter(meeting=meeting, category="matters_arising")
        .select_related("submission", "meeting").order_by("sequence", "id")
    )

    rows: list[dict] = [
        {"kind": "item", "no": 1, "text": f"Adoption of Agenda {meeting_label(meeting)}", "bold": False},
        {"kind": "item", "no": 2, "text": "MINUTE", "bold": True,
         "lines": (["Confirmation of endorsement of PSC Meeting:", meeting_label(prev)] if prev else ["Confirmation of endorsement of PSC Meeting:"]),
         "sub_items": [{"item_id": p.id, "text": (p.submission.title if p.submission_id else "")} for p in prelim]},
        {"kind": "item", "no": 3, "text": "MATTERS ARISING", "bold": True},
    ]
    last_label = object()
    for it in arising:
        label, agenda_label = derive_matters_arising(it)
        if label != last_label:
            rows.append({"kind": "matter_group", "text": label})
            last_label = label
        title = it.submission.title if it.submission_id else ""
        rows.append({"kind": "matter", "item_id": it.id, "agenda_label": agenda_label, "text": f"{agenda_label} - {title}".strip(" -") if agenda_label else title})
    for b in ordered_blocks(meeting):
        rows.append({"kind": "heading", "text": b["heading"], "codes": b["codes"]})
        for it in b["items"]:
            rows.append({"kind": "item", "no": it.agenda_no, "item_id": it.id, "submission_id": it.submission_id,
                         "reference": it.submission.reference_number if it.submission_id else "",
                         "text": it.submission.title if it.submission_id else "", "bold": False})
    return {
        "meeting_id": meeting.id,
        "agenda_status": meeting.agenda_status,
        "title_lines": title_lines(meeting),
        "rows": rows,
        "signatory": _signatory(),
    }




# ── PDF ─────────────────────────────────────────────────────────────────────

def render_agenda_html(doc: dict) -> str:
    e = _html.escape
    out = []
    out.append("<tr><td class='title'>" + "<br>".join(e(l) for l in doc["title_lines"]) + "</td></tr>")
    for r in doc["rows"]:
        k = r["kind"]
        if k == "item":
            num = f"<span class='no'>{r['no']}.</span>" if r.get("no") else ""
            body = e(r["text"])
            cls = "b" if r.get("bold") else ""
            extra = ""
            for line in r.get("lines", []) or []:
                extra += f"<div class='sub'>{e(line)}</div>"
            for sub in r.get("sub_items", []) or []:
                extra += f"<div class='sub'>{e(sub['text'])}</div>"
            out.append(f"<tr><td><div class='row {cls}'>{num}<span class='tx'>{body}</span></div>{extra}</td></tr>")
        elif k == "matter_group":
            out.append(f"<tr><td class='b'>{e(r['text'])}</td></tr>")
        elif k == "matter":
            out.append(f"<tr><td class='b matter'>{e(r['text'])}</td></tr>")
        elif k == "heading":
            out.append(f"<tr><td class='b head'>{e(r['text'])}</td></tr>")
    sig = doc.get("signatory") or {}
    sig_html = ""
    if sig.get("name"):
        sig_html = ("<div class='sig'><div>" + e(sig["name"]) + "</div><div>" + e(sig.get("title", "")) + "</div><div>" + e(sig.get("office", "")) + "</div></div>")
    css = """
    @page { size: Letter; margin: 22mm 25.4mm 20mm 25.4mm; @bottom-right { content: counter(page); font-size: 10pt; } }
    body { font-family: 'TeX Gyre Adventor', 'Century Gothic', 'URW Gothic', 'Avant Garde', sans-serif; font-size: 11.5pt; color: #000; }
    table { width: 100%; border-collapse: collapse; }
    td { border: 1px solid #000; padding: 3pt 6pt; vertical-align: top; }
    td.title { text-align: center; font-weight: bold; padding: 6pt; }
    .row { padding-left: 24pt; text-indent: -24pt; }
    .row .no { display: inline-block; width: 24pt; text-indent: 0; }
    .row .tx { }
    .b, .b .row { font-weight: bold; }
    .sub { padding-left: 24pt; }
    .head { text-transform: uppercase; }
    .matter { font-weight: bold; }
    .sig { margin-top: 28pt; line-height: 1.35; }
    """
    return f"<html><head><meta charset='utf-8'><style>{css}</style></head><body><table>{''.join(out)}</table>{sig_html}</body></html>"


def render_agenda_pdf(meeting) -> bytes:
    from io import BytesIO

    from weasyprint import HTML

    buf = BytesIO()
    HTML(string=render_agenda_html(build_agenda_document(meeting))).write_pdf(buf)
    return buf.getvalue()

"""Shared helpers for letter generation."""
from __future__ import annotations
from django.utils import timezone


def today_str() -> str:
    return timezone.localdate().strftime("%d %B %Y")


def letterhead(ref: str, to_ministry: str, to_dept: str = "") -> str:
    lines = [
        "PUBLIC SERVICE COMMISSION",
        "Port Vila, Vanuatu",
        f"Date: {today_str()}",
        "",
        f"Reference: {ref}",
        "",
    ]
    if to_ministry or to_dept:
        lines.append(f"TO: {to_ministry}")
        if to_dept:
            lines.append(f"    {to_dept}")
        lines.append("")
    return "\n".join(lines)


def signature_block(secretary_name: str = "") -> str:
    name = secretary_name or "Secretary to the Public Service Commission"
    return (
        "\n\nYours faithfully,\n\n\n"
        "_________________________\n"
        f"{name}\n"
        "Office of the Public Service Commission"
    )


def wrap_html(text: str) -> str:
    escaped = (text
               .replace("&", "&amp;")
               .replace("<", "&lt;")
               .replace(">", "&gt;"))
    return f'<pre style="font-family:serif;white-space:pre-wrap;line-height:1.6">{escaped}</pre>'


def _form_data(submission) -> dict:
    try:
        return submission.dynamic_form_response.data or {}
    except Exception:
        return {}


def _ministry_name(submission) -> str:
    try:
        return submission.ministry.name if submission.ministry_id else ""
    except Exception:
        return ""

"""Sanitization helpers for rich-text workflow remarks.

`remarks_html` (what the manager typed, via the TipTap editor) is
display-only. The decision proof hash, notification emails, and the AI
status-chat context all keep reading `WorkflowEvent.remarks`, a plain-text
string derived from the sanitized HTML — see WorkflowEvent.remarks_html's
help_text in models.py for why.
"""
from __future__ import annotations

import re

import nh3
from django.utils.html import strip_tags

_ALLOWED_TAGS = {
    "p", "br", "strong", "em", "u", "s",
    "ul", "ol", "li",
    "blockquote", "h1", "h2", "h3",
    "code", "pre", "img", "a",
}
_ALLOWED_ATTRIBUTES = {
    "img": {"src", "alt", "data-remarks-image-id"},
    "a": {"href"},
}

_IMAGE_ID_RE = re.compile(r'data-remarks-image-id="(\d+)"')


def sanitize_remarks_html(raw: str) -> str:
    """Strip to an allow-list of formatting/image/link tags."""
    if not raw:
        return ""
    return nh3.clean(raw, tags=_ALLOWED_TAGS, attributes=_ALLOWED_ATTRIBUTES)


_PARA_BREAK_RE = re.compile(r"</(p|h1|h2|h3|blockquote)>", re.IGNORECASE)
_LINE_BREAK_RE = re.compile(r"</li>|<br\s*/?>", re.IGNORECASE)


def html_to_plain_text(html: str) -> str:
    """Derive the plain-text `remarks` value stored/hashed everywhere else.

    strip_tags() alone drops block boundaries (e.g. "<p>Hi</p><p>Bye</p>"
    becomes "HiBye"), so paragraph/heading/quote closings become a blank
    line and list-item/line-break tags become a single newline first.
    """
    if not html:
        return ""
    text = _PARA_BREAK_RE.sub("\n\n", html)
    text = _LINE_BREAK_RE.sub("\n", text)
    text = strip_tags(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n[ \t]*\n+", "\n\n", text).strip()
    return text


def extract_remarks_image_ids(html: str) -> list[int]:
    """Pull every `data-remarks-image-id` referenced in sanitized HTML."""
    if not html:
        return []
    return [int(m) for m in _IMAGE_ID_RE.findall(html)]

"""Real content-type validation for file uploads (P1-06, SCDMS
Pre-Production Readiness Audit — Findings Register).

Every upload endpoint in this codebase either did no type check at all, or
checked the client-supplied ``Content-Type`` header / filename extension —
both are set entirely by the browser/client and trivially spoofed (e.g. a
`curl -F "file=@payload.html;type=application/pdf;filename=x.pdf"`).
This module sniffs the *actual bytes* of the upload with libmagic instead,
the same technique file(1) uses, and validates against an explicit allow-list
per upload kind. It never trusts anything the client claims about the file.

Does not include malware/AV scanning (ClamAV or similar) — that's a
separate, infrastructure-level piece (a new scanning service, virus
definition updates) tracked separately from this content-type fix.
"""
from __future__ import annotations

import magic

# Read only the first chunk — libmagic identifies file types from a small
# header/signature, never needs the whole file, and this keeps validation
# cheap even for a 50MB upload.
_SNIFF_BYTES = 4096

# Per-kind allow-lists of real, sniffed MIME types. Deliberately an
# allow-list (reject anything not explicitly expected), not a blocklist of
# known-bad types — narrower, and doesn't rely on anticipating every
# dangerous type in advance.
ALLOWED_MIME_TYPES = {
    # General submission/board-paper/decision-letter documents: PDF, common
    # office formats, and images (scanned documents are frequently photos).
    # application/zip is included because OOXML (.docx/.xlsx) files are ZIP
    # containers and libmagic frequently reports them as plain zip rather
    # than the specific OOXML MIME type, depending on the magic database
    # version — still excludes the actual attack surface (HTML, scripts,
    # executables), which is what this check exists to catch.
    "document": {
        "application/pdf",
        "image/png", "image/jpeg", "image/gif", "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/zip",
    },
    "pdf": {"application/pdf"},
    "image": {"image/png", "image/jpeg", "image/gif", "image/webp"},
    # Meeting-recording uploads (Logitech GROUP / phone recorder exports).
    "audio_video": {
        "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/x-wav",
        "audio/ogg", "video/mp4", "video/webm", "video/quicktime",
    },
}


class FileValidationError(ValueError):
    """Raised when an uploaded file's real content doesn't match an allowed
    type for the given kind. Message is safe to return to the client."""


def sniff_mime_type(uploaded_file) -> str:
    """The file's real, content-sniffed MIME type — never the client-supplied
    Content-Type header. Leaves the file's read position at 0 afterward so
    the caller can still read/save the full content normally."""
    uploaded_file.seek(0)
    head = uploaded_file.read(_SNIFF_BYTES)
    uploaded_file.seek(0)
    return magic.from_buffer(head, mime=True)


def validate_upload(uploaded_file, *, kind: str) -> str:
    """Raise FileValidationError if `uploaded_file`'s real content isn't an
    allowed type for `kind`. Returns the sniffed MIME type on success (for
    callers that want to log/store it)."""
    allowed = ALLOWED_MIME_TYPES.get(kind)
    if allowed is None:
        raise ValueError(f"Unknown file_validation kind: {kind!r}")
    mime = sniff_mime_type(uploaded_file)
    if mime not in allowed:
        raise FileValidationError(
            f"'{uploaded_file.name}' was rejected: its content doesn't match an "
            f"allowed file type for this upload (detected: {mime})."
        )
    return mime

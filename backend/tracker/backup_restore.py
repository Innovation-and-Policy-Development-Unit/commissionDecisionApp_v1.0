"""Shared validation for restoring a .zip backup (data.json + media/).

The zip is admin-uploaded, untrusted input — same scrutiny as the JSON
fixture already gets (see P0-02, SCDMS Pre-Production Readiness Audit —
Findings Register). Two extraction-specific risks this guards against:

- Zip-slip: a member path like "../../etc/cron.d/x" that would write outside
  the intended extraction root. Every member's resolved path is checked to
  stay inside the root before anything is written; we also never call
  extractall() or otherwise let the zipfile module create symlinks, since we
  write member bytes out ourselves.
- Zip-bomb: a small file that decompresses to an unreasonable size. Total
  uncompressed size and member count are capped before any bytes are read.
"""
from __future__ import annotations

import os
import zipfile

MAX_TOTAL_UNCOMPRESSED_BYTES = 500 * 1024 * 1024  # 500 MB
MAX_MEMBER_COUNT = 5000
FIXTURE_ENTRY_NAME = "data.json"
MEDIA_PREFIX = "media/"


class BackupZipError(ValueError):
    """Raised when a backup .zip fails structural or safety validation."""


def is_zip_content(raw: bytes) -> bool:
    return raw[:4] == b"PK\x03\x04" or raw[:4] == b"PK\x05\x06"


def _safe_relative_path(member_name: str) -> str | None:
    """Return a normalized, root-relative path for a zip member name, or
    None if it's unsafe (absolute, escapes the root, or empty)."""
    if not member_name or member_name.endswith("/"):
        return None
    # Zip members always use "/" regardless of platform.
    normalized = os.path.normpath(member_name).replace("\\", "/")
    if normalized.startswith("/") or normalized.startswith("..") or ":" in normalized:
        return None
    parts = normalized.split("/")
    if any(p in ("", ".", "..") for p in parts):
        return None
    return normalized


def validate_backup_zip(zf: zipfile.ZipFile) -> tuple[bytes, list[tuple[str, str]]]:
    """Validate a backup zip's structure and safety.

    Returns (fixture_bytes, media_members) where media_members is a list of
    (zip_member_name, safe_relative_path_under_media) pairs. Raises
    BackupZipError on any validation failure — nothing is extracted here.
    """
    infos = zf.infolist()
    if len(infos) > MAX_MEMBER_COUNT:
        raise BackupZipError(
            f"Backup contains too many files ({len(infos)} > {MAX_MEMBER_COUNT})."
        )

    total_size = 0
    fixture_info = None
    media_members: list[tuple[str, str]] = []

    for info in infos:
        if info.is_dir():
            continue
        total_size += info.file_size
        if total_size > MAX_TOTAL_UNCOMPRESSED_BYTES:
            raise BackupZipError(
                f"Backup is too large when decompressed (> "
                f"{MAX_TOTAL_UNCOMPRESSED_BYTES // (1024 * 1024)} MB)."
            )

        if info.filename == FIXTURE_ENTRY_NAME:
            fixture_info = info
            continue

        if info.filename.startswith(MEDIA_PREFIX):
            rel = _safe_relative_path(info.filename[len(MEDIA_PREFIX):])
            if rel is None:
                raise BackupZipError(f"Unsafe file path in backup: {info.filename!r}")
            media_members.append((info.filename, rel))
        # Anything else at the root (unexpected entries) is silently ignored
        # rather than rejected — forward-compatible with future additions.

    if fixture_info is None:
        raise BackupZipError("Backup zip is missing data.json.")

    fixture_bytes = zf.read(fixture_info)
    return fixture_bytes, media_members

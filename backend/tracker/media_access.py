"""
Resolve uploaded files to a local path for background tasks (OCR, vision, etc.).

On Render the API persistent disk is not visible to Celery workers; workers fetch
bytes from the API internal endpoint when a local path is missing.
"""
from __future__ import annotations

import logging
import secrets
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from contextlib import contextmanager
from pathlib import Path

from django.conf import settings
from django.core.files.storage import default_storage

logger = logging.getLogger("scdms.app")

_INTERNAL_HEADER = "X-Internal-Media-Token"


def _media_root() -> Path:
    return Path(settings.MEDIA_ROOT).resolve()


@contextmanager
def materialize_file_field(file_field):
    """
    Yield a pathlib.Path to readable file bytes.

    Uses local disk when present; otherwise storage.open(); on Render workers,
    fetches from the API internal media URL when configured.
    """
    if not file_field or not file_field.name:
        raise FileNotFoundError("No file attached.")

    # 1) Local path (dev, or API container with persistent disk)
    try:
        local = Path(file_field.path)
        if local.is_file():
            yield local
            return
    except (ValueError, NotImplementedError):
        pass

    name = file_field.name
    suffix = Path(name).suffix or ".bin"

    # 2) Same-container storage (e.g. storage backend or shared mount)
    if default_storage.exists(name):
        with default_storage.open(name, "rb") as src:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(src.read())
                tmp_path = Path(tmp.name)
        try:
            yield tmp_path
        finally:
            tmp_path.unlink(missing_ok=True)
        return

    # 3) Fetch from API (Render: disk on scdms-api only)
    token = (getattr(settings, "INTERNAL_MEDIA_TOKEN", None) or "").strip()
    base = (getattr(settings, "MEDIA_FETCH_BASE_URL", None) or "").strip().rstrip("/")
    if token and base:
        url = f"{base}/internal/media/{urllib.parse.quote(name, safe='/')}"
        req = urllib.request.Request(url, headers={_INTERNAL_HEADER: token})
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = resp.read()
        except urllib.error.HTTPError as exc:
            logger.warning("MEDIA_FETCH_FAIL | %s | HTTP %s", name, exc.code)
            raise FileNotFoundError("File not found on disk.") from exc
        except OSError as exc:
            logger.warning("MEDIA_FETCH_FAIL | %s | %s", name, exc)
            raise FileNotFoundError("File not found on disk.") from exc

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(data)
            tmp_path = Path(tmp.name)
        try:
            yield tmp_path
        finally:
            tmp_path.unlink(missing_ok=True)
        return

    raise FileNotFoundError("File not found on disk.")


def internal_media_token_ok(provided: str) -> bool:
    expected = (getattr(settings, "INTERNAL_MEDIA_TOKEN", None) or "").strip()
    if not expected or not provided:
        return False
    return secrets.compare_digest(provided, expected)


def safe_media_path(relative: str) -> Path | None:
    """Resolve relative storage name under MEDIA_ROOT; None if path escapes."""
    root = _media_root()
    target = (root / relative).resolve()
    try:
        target.relative_to(root)
    except ValueError:
        return None
    return target

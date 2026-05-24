"""Build browser-loadable URLs for uploaded media (profile pics, signatures, etc.)."""

from __future__ import annotations

from urllib.parse import urlparse

from django.conf import settings


def _media_path(file_field) -> str:
    """Relative /media/... path for nginx or SPA (independent of absolute MEDIA_URL)."""
    name = getattr(file_field, "name", None)
    if name:
        return f"/media/{str(name).lstrip('/')}"

    raw = file_field.url
    if raw.startswith(("http://", "https://")):
        path = urlparse(raw).path or raw
    else:
        path = raw
    if not path.startswith("/"):
        path = f"/{path.lstrip('/')}"
    if not path.startswith("/media/"):
        path = f"/media/{path.lstrip('/')}"
    return path


def public_media_url(file_field, request=None) -> str | None:
    """
    Return a URL the browser can load.

    - With request: same host as the API call (nginx :8080 in Docker, correct on Render).
    - Without request: relative /media/... or absolute MEDIA_URL for split SPA/API deploys.
    """
    if not file_field:
        return None

    path = _media_path(file_field)

    if request is not None:
        return request.build_absolute_uri(path)

    media_url = getattr(settings, "MEDIA_URL", "/media/")
    if media_url.startswith(("http://", "https://")):
        name = getattr(file_field, "name", None) or path.replace("/media/", "", 1)
        return f"{media_url.rstrip('/')}/{str(name).lstrip('/')}"

    return path

"""Build browser-loadable URLs for uploaded media (profile pics, signatures, etc.)."""

from __future__ import annotations

from django.conf import settings


def public_media_url(file_field, request=None) -> str | None:
    """
    Return an absolute URL when the SPA is on a different origin than the API
    (e.g. scdms-web.onrender.com vs scdms-api.onrender.com).
    """
    if not file_field:
        return None

    raw = file_field.url
    if raw.startswith(("http://", "https://")):
        return raw

    if request is not None:
        return request.build_absolute_uri(raw)

    media_url = getattr(settings, "MEDIA_URL", "/media/")
    if media_url.startswith(("http://", "https://")):
        if raw.startswith("/"):
            return f"{media_url.rstrip('/')}{raw}"
        return f"{media_url.rstrip('/')}/{raw.lstrip('/')}"

    if raw.startswith("/"):
        return raw
    return f"/{raw.lstrip('/')}"

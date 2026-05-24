"""Internal endpoints for service-to-service access (not for browsers)."""
from django.conf import settings
from django.http import FileResponse, HttpResponseForbidden, HttpResponseNotFound

from .media_access import _INTERNAL_HEADER, internal_media_token_ok, safe_media_path


def internal_media(request, file_path: str):
    """
    Serve a file from MEDIA_ROOT to trusted workers (Celery on Render).

    Requires header X-Internal-Media-Token matching INTERNAL_MEDIA_TOKEN.
    """
    if not (getattr(settings, "INTERNAL_MEDIA_TOKEN", None) or "").strip():
        return HttpResponseForbidden("Internal media disabled.")
    token = request.headers.get(_INTERNAL_HEADER, "")
    if not internal_media_token_ok(token):
        return HttpResponseForbidden()

    target = safe_media_path(file_path)
    if target is None or not target.is_file():
        return HttpResponseNotFound()

    return FileResponse(target.open("rb"), as_attachment=False, filename=target.name)

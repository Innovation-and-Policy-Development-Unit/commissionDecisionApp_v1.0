"""
tracker/audit.py
─────────────────
Central audit-logging utility.
Call  log_action(request, action, ...)  anywhere in views/serializers.
Never raises — audit failures must not disrupt the application.

NCSS 2030: CSP-1 (Cyber Resilience), CSP-4 (Addressing Cybercrime)
ISO 27001: A.12.4 (Logging and Monitoring), A.16.1 (Incident Management)
"""
import logging

from django.db import transaction
from django.utils import timezone

_security = logging.getLogger("scdms.security")


def _get_ip(request):
    if request is None:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR") or None


def _get_ua(request):
    if request is None:
        return ""
    return (request.META.get("HTTP_USER_AGENT") or "")[:512]


def signing_provenance(request):
    """Auth-method/session/IP captured from the JWT claims set at login —
    stamped onto signature records for legal defensibility. Blank/None on
    tokens issued before this shipped, or on non-JWT auth (e.g. API key)."""
    token = getattr(request, "auth", None)
    auth_method = ""
    trusted_session_id = None
    if token is not None:
        try:
            auth_method = token.get("auth_method") or ""
            trusted_session_id = token.get("trusted_session_id")
        except Exception:
            pass
    return {
        "auth_method": auth_method,
        "trusted_session_id": trusted_session_id,
        "signed_ip": _get_ip(request),
    }


def log_action(
    request,
    action: str,
    *,
    resource_type: str = "",
    resource_id=None,
    resource_label: str = "",
    description: str = "",
    extra_data: dict | None = None,
):
    """
    Create an AuditLog row.  Always safe to call — exceptions are swallowed
    so the caller is never disrupted by a logging failure.
    """
    try:
        from .models import AuditLog          # local import avoids circular deps at module load

        user = getattr(request, "user", None) if request else None
        is_auth = user is not None and getattr(user, "is_authenticated", False)

        entry = AuditLog(
            actor          = user if is_auth else None,
            actor_username = user.username if is_auth else "",
            action         = action,
            resource_type  = resource_type,
            resource_id    = str(resource_id) if resource_id is not None else "",
            resource_label = resource_label,
            description    = description,
            ip_address     = _get_ip(request),
            user_agent     = _get_ua(request),
            timestamp      = timezone.now(),
            extra_data     = extra_data or {},
        )
        # Hash-chain (P1-08, SCDMS Pre-Production Readiness Audit — Findings
        # Register): each row hashes in the previous row's hash, so altering
        # or deleting any row breaks the chain from that point on
        # (verify_audit_log_integrity). select_for_update() on the current
        # last row serializes concurrent writers onto the same chain — two
        # AuditLog rows created at once could otherwise both read the same
        # prev_hash and silently fork it.
        with transaction.atomic():
            prev = AuditLog.objects.select_for_update().order_by("-id").first()
            entry.prev_hash = prev.content_hash if prev else ""
            entry.content_hash = entry.compute_content_hash()
            entry.save()

        _security.info(
            "%s | actor=%s | %s:%s | %s | ip=%s",
            action,
            entry.actor_username or "anonymous",
            resource_type or "—",
            resource_id or "—",
            description or resource_label or "—",
            entry.ip_address or "—",
        )
    except Exception as exc:          # never crash the caller
        _security.error("audit_log failed: %s", exc)

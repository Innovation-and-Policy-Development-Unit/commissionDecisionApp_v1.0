"""Django email backend for Resend (https://resend.com)."""

from __future__ import annotations

import base64
import logging
import os
from email.utils import parseaddr

from django.core.mail import EmailMessage, EmailMultiAlternatives
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger("scdms.app")


def resend_api_key() -> str:
    return (os.getenv("RESEND_API_KEY") or "").strip()


def uses_resend() -> bool:
    if resend_api_key():
        return True
    from django.conf import settings

    backend = (getattr(settings, "EMAIL_BACKEND", None) or "").lower()
    return "resend" in backend


def resend_config_diagnostics() -> dict:
    from .email_templates import get_from_email

    key = resend_api_key()
    return {
        "provider": "resend",
        "api_key_configured": bool(key),
        "api_key_prefix": f"{key[:8]}…" if len(key) > 8 else "",
        "from_email": get_from_email(),
    }


def format_resend_error(exc: Exception) -> str:
    msg = str(exc)
    if hasattr(exc, "message"):
        msg = str(getattr(exc, "message", msg))
    return msg or exc.__class__.__name__


def _resolve_from_email(message: EmailMessage) -> str:
    from_email = (message.from_email or "").strip()
    if from_email:
        return from_email
    return os.getenv("DEFAULT_FROM_EMAIL", "onboarding@resend.dev")


def _collect_recipients(message: EmailMessage) -> list[str]:
    recipients: list[str] = []
    for field in (message.to, message.cc, message.bcc):
        if field:
            recipients.extend(field)
    return [r.strip() for r in recipients if r and r.strip()]


def _extract_bodies(message: EmailMessage) -> tuple[str | None, str | None]:
    html: str | None = None
    text: str | None = None

    if isinstance(message, EmailMultiAlternatives):
        for content, mimetype in message.alternatives:
            if mimetype == "text/html":
                html = content
            elif mimetype == "text/plain" and text is None:
                text = content

    if getattr(message, "content_subtype", None) == "html":
        html = message.body
    else:
        text = message.body or None

    if html and not text:
        _, addr = parseaddr(_resolve_from_email(message))
        text = "View this message in an HTML-capable email client."
    return text, html


def _build_attachments(message: EmailMessage) -> list[dict] | None:
    if not message.attachments:
        return None
    out: list[dict] = []
    for attachment in message.attachments:
        if isinstance(attachment, EmailMessage):
            continue
        filename = attachment[0] or "attachment"
        content = attachment[1]
        mimetype = attachment[2] if len(attachment) > 2 else None
        if hasattr(content, "read"):
            content = content.read()
        if isinstance(content, str):
            content = content.encode("utf-8")
        item: dict = {
            "filename": filename,
            "content": base64.b64encode(content).decode("ascii"),
        }
        if mimetype:
            item["content_type"] = mimetype
        out.append(item)
    return out or None


def send_via_resend(message: EmailMessage) -> dict:
    """Send one Django EmailMessage through Resend. Raises on failure."""
    import resend

    api_key = resend_api_key()
    if not api_key:
        raise ValueError("RESEND_API_KEY is not configured.")

    resend.api_key = api_key

    recipients = _collect_recipients(message)
    if not recipients:
        raise ValueError("No recipients specified.")

    text, html = _extract_bodies(message)
    params: dict = {
        "from": _resolve_from_email(message),
        "to": recipients,
        "subject": message.subject or "(no subject)",
    }
    if html:
        params["html"] = html
    if text:
        params["text"] = text
    if not html and not text:
        params["html"] = "<p></p>"

    attachments = _build_attachments(message)
    if attachments:
        params["attachments"] = attachments

    reply_to = getattr(message, "reply_to", None) or []
    if reply_to:
        params["reply_to"] = list(reply_to)

    return resend.Emails.send(params)


class ResendEmailBackend(BaseEmailBackend):
    """Routes django.core.mail to Resend's HTTP API."""

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        if not resend_api_key():
            if not self.fail_silently:
                raise ValueError("RESEND_API_KEY is not configured.")
            logger.error("RESEND_SEND_SKIP | RESEND_API_KEY missing")
            return 0

        sent = 0
        for message in email_messages:
            try:
                send_via_resend(message)
                sent += 1
            except Exception as exc:
                logger.exception("RESEND_SEND_FAIL | %s", format_resend_error(exc))
                if not self.fail_silently:
                    raise
        return sent

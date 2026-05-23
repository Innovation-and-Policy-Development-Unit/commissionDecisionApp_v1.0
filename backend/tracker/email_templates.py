"""Render and send configurable email templates from the database."""

from __future__ import annotations

import logging
import os
import re
from typing import Any

from django.conf import settings as django_settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)

_PLACEHOLDER_DOUBLE_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")
# Single braces: {firstname} — not part of {{…}}
_PLACEHOLDER_SINGLE_RE = re.compile(r"(?<!\{)\{\s*([a-zA-Z0-9_]+)\s*\}(?!\})")


def get_frontend_base_url() -> str:
    origins = getattr(django_settings, "CORS_ALLOWED_ORIGINS", None) or []
    if origins:
        return str(origins[0]).rstrip("/")
    return os.getenv("FRONTEND_URL", "http://localhost:8080").rstrip("/")


def get_from_email() -> str:
    from .models import SystemSetting

    return (
        os.getenv("DEFAULT_FROM_EMAIL")
        or SystemSetting.get_val("DEFAULT_FROM_EMAIL")
        or django_settings.DEFAULT_FROM_EMAIL
    )


def _stringify_context(context: dict[str, Any]) -> dict[str, str]:
    return {k: "" if v is None else str(v) for k, v in context.items()}


def render_template_string(template: str, context: dict[str, Any]) -> str:
    """
    Replace placeholders with context values. Supports both forms:
      Dear {{firstname}},  and  Dear {firstname},
    Unknown keys become empty strings.
    """
    if not template:
        return ""

    ctx = _stringify_context(context)

    def repl(match: re.Match) -> str:
        return ctx.get(match.group(1), "")

    rendered = _PLACEHOLDER_DOUBLE_RE.sub(repl, template)
    return _PLACEHOLDER_SINGLE_RE.sub(repl, rendered)


def render_template_record(tpl, context: dict[str, Any]):
    """Render subject + bodies from an EmailTemplate instance."""
    subject = render_template_string(tpl.subject_template, context)
    text_body = render_template_string(tpl.body_text_template, context)
    html_body = render_template_string(tpl.body_html_template, context).strip() or None
    return subject, text_body, html_body


def render_email_template(slug: str, context: dict[str, Any]):
    """
    Load an active EmailTemplate by slug and render subject + bodies.
    Returns (subject, text_body, html_body_or_none).
    Raises EmailTemplate.DoesNotExist if missing.
    """
    from .models import EmailTemplate

    tpl = EmailTemplate.objects.get(slug=slug, is_active=True)
    return render_template_record(tpl, context)


def reset_email_template_to_default(slug: str) -> bool:
    """Restore a system template's content from built-in defaults."""
    from .email_template_defaults import DEFAULT_EMAIL_TEMPLATES
    from .models import EmailTemplate

    data = next((d for d in DEFAULT_EMAIL_TEMPLATES if d["slug"] == slug), None)
    if not data:
        return False
    updated = EmailTemplate.objects.filter(slug=slug).update(
        name=data["name"],
        category=data["category"],
        description=data["description"],
        placeholders=data["placeholders"],
        subject_template=data["subject_template"],
        body_text_template=data["body_text_template"],
        body_html_template=data.get("body_html_template", ""),
        is_active=True,
    )
    return updated > 0


def send_templated_email(
    *,
    slug: str,
    to: list[str],
    context: dict[str, Any],
    fail_silently: bool = True,
) -> bool:
    """Render template `slug` and send via configured SMTP backend."""
    if not to:
        return False
    recipients = [e.strip() for e in to if e and e.strip()]
    if not recipients:
        return False

    try:
        subject, text_body, html_body = render_email_template(slug, context)
    except Exception as exc:
        logger.warning("Email template %s unavailable: %s", slug, exc)
        return False

    try:
        send_mail(
            subject,
            text_body,
            get_from_email(),
            recipients,
            fail_silently=fail_silently,
            html_message=html_body,
        )
        return True
    except Exception as exc:
        logger.exception("Failed to send templated email %s to %s: %s", slug, recipients, exc)
        return False


def seed_default_email_templates() -> int:
    """Upsert built-in templates; returns count created/updated."""
    from .email_template_defaults import DEFAULT_EMAIL_TEMPLATES
    from .models import EmailTemplate

    count = 0
    for data in DEFAULT_EMAIL_TEMPLATES:
        _, created = EmailTemplate.objects.update_or_create(
            slug=data["slug"],
            defaults={
                "name": data["name"],
                "category": data["category"],
                "description": data["description"],
                "placeholders": data["placeholders"],
                "subject_template": data["subject_template"],
                "body_text_template": data["body_text_template"],
                "body_html_template": data.get("body_html_template", ""),
                "is_active": True,
                "is_system": True,
            },
        )
        if created:
            count += 1
    return count

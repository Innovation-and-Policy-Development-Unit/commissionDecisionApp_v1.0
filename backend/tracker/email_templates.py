"""Render and send configurable email templates from the database."""

from __future__ import annotations

import logging
import os
import re
import html
from typing import Any

from django.conf import settings as django_settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)

_PLACEHOLDER_DOUBLE_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")
# Single braces: {firstname} — not part of {{…}}
_PLACEHOLDER_SINGLE_RE = re.compile(r"(?<!\{)\{\s*([a-zA-Z0-9_]+)\s*\}(?!\})")


def get_frontend_base_url() -> str:
    """Canonical HTTPS app URL for links in email (always prefer FRONTEND_URL)."""
    explicit = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if explicit:
        return explicit
    origins = getattr(django_settings, "CORS_ALLOWED_ORIGINS", None) or []
    if origins:
        first = origins[0] if isinstance(origins, (list, tuple)) else str(origins).split(",")[0]
        return str(first).strip().rstrip("/")
    return "http://localhost:8080"


def get_from_email() -> str:
    from .models import SystemSetting

    return (
        os.getenv("DEFAULT_FROM_EMAIL")
        or SystemSetting.get_val("DEFAULT_FROM_EMAIL")
        or django_settings.DEFAULT_FROM_EMAIL
    )


def _stringify_context(context: dict[str, Any]) -> dict[str, str]:
    return {k: "" if v is None else str(v) for k, v in context.items()}


def _brand_frame(inner_html: str, context: dict[str, Any]) -> str:
    """
    Wrap template HTML in OPSC-branded shell so all emails share identity.
    """
    if not inner_html:
        inner_html = ""
    # Avoid double wrapping if a template already includes the branded shell.
    if "data-opsc-email-frame" in inner_html:
        return inner_html

    portal_url = html.escape(get_frontend_base_url(), quote=True)

    return (
        '<div data-opsc-email-frame="1" style="margin:0;padding:24px;background:#e6edf8;">'
        '<div style="max-width:680px;margin:0 auto;background:#ffffff;'
        'border:1px solid #cbd5e1;border-radius:14px;overflow:hidden;">'
        '<div style="background:#0f172a;padding:18px 22px;color:#ffffff;'
        'border-bottom:1px solid #dbe3ef;">'
        '<div style="font:700 17px/1.3 Arial,sans-serif;letter-spacing:.2px;">'
        "SCDMS — Office of the Public Service Commission"
        "</div>"
        '<div style="font:500 12px/1.4 Arial,sans-serif;color:#cbd5e1;margin-top:4px;">'
        "Government of the Republic of Vanuatu"
        "</div>"
        "</div>"
        '<div style="padding:22px 24px;color:#0f172a;font:400 15px/1.65 Arial,sans-serif;">'
        f"{inner_html}"
        "</div>"
        '<div style="border-top:1px solid #dbe3ef;padding:12px 24px;'
        'background:#f1f5f9;color:#334155;font:500 12px/1.5 Arial,sans-serif;">'
        "This is an automated message from the Submission &amp; Commission Decision Management System (SCDMS). "
        f'Open portal: <a href="{portal_url}" style="color:#1e40af;text-decoration:none;font-weight:700;">{portal_url}</a>'
        "</div>"
        "</div>"
        "</div>"
    )


def _auto_html_from_text(text_body: str, context: dict[str, Any]) -> str:
    """
    Render a professional default HTML wrapper when a template has no explicit HTML body.
    """
    safe_text = html.escape(text_body or "").replace("\n", "<br>")
    ctx = _stringify_context(context or {})

    action_url = (
        ctx.get("reset_url")
        or ctx.get("submission_url")
        or ctx.get("task_url")
        or ctx.get("login_url")
        or ""
    ).strip()
    action_label = "Open in Commission Decision App"
    if ctx.get("reset_url"):
        action_label = "Reset password"
    elif ctx.get("task_url"):
        action_label = "Open task"
    elif ctx.get("submission_url"):
        action_label = "View submission"
    elif ctx.get("login_url"):
        action_label = "Sign in"

    cta_html = ""
    if action_url:
        safe_action_url = html.escape(action_url, quote=True)
        cta_html = (
            f'<p style="margin:0 0 16px 0;">'
            f'<a href="{safe_action_url}" '
            f'style="display:inline-block;background:#2563eb;color:#ffffff;'
            f'text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">'
            f"{html.escape(action_label)}</a></p>"
            f'<p style="margin:0 0 16px 0;color:#64748b;font-size:13px;word-break:break-all;">'
            f'<a href="{safe_action_url}" style="color:#2563eb;">{safe_action_url}</a></p>'
        )

    return _brand_frame(
        f'<div style="margin:0 0 16px 0;">{safe_text}</div>{cta_html}',
        context,
    )


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
    html_body = render_template_string(tpl.body_html_template, context).strip()
    if not html_body:
        html_body = _auto_html_from_text(text_body, context)
    else:
        html_body = _brand_frame(html_body, context)
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
        from django.core.mail import EmailMultiAlternatives

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=get_from_email(),
            to=recipients,
        )
        if html_body:
            msg.attach_alternative(html_body, "text/html")
        msg.extra_headers = {
            "Auto-Submitted": "auto-generated",
            "X-Auto-Response-Suppress": "All",
        }
        msg.send(fail_silently=fail_silently)
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

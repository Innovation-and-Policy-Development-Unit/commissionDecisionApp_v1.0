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


# ── Icon badge + tone system ───────────────────────────────────────────────
# Small Feather-style line icons (stroke-based, 24x24 viewBox), reused across
# templates so every notification gets a badge matching what actually happened.

# Email clients (Gmail in particular) strip inline <svg> from received HTML
# mail as a security measure, so a line-icon badge silently renders as an
# empty circle. Plain-text emoji glyphs are just Unicode text — they survive
# every sanitizer and render natively everywhere, so the badge uses those.
ICONS: dict[str, str] = {
    "lock": "\U0001F512",  # 🔒
    "unlock": "\U0001F513",  # 🔓
    "shield-alert": "⚠️",  # ⚠️
    "user-plus": "\U0001F195",  # 🆕
    "user-check": "✅",  # ✅
    "megaphone": "\U0001F4E3",  # 📣
    "calendar": "\U0001F4C5",  # 📅
    "calendar-x": "\U0001F5D3️",  # 🗓️
    "edit-3": "✍️",  # ✍️
    "send": "\U0001F4E8",  # 📨
    "check-circle": "✅",  # ✅
    "x-circle": "❌",  # ❌
    "message-square": "\U0001F4AC",  # 💬
    "refresh-cw": "\U0001F504",  # 🔄
    "arrow-right-circle": "➡️",  # ➡️
    "corner-down-left": "↩️",  # ↩️
    "clock": "⏰",  # ⏰
    "clipboard-list": "\U0001F4CB",  # 📋
    "clipboard-check": "\U0001F4CB",  # 📋
    "sun": "☀️",  # ☀️
    "bell": "\U0001F514",  # 🔔
}

# tone → (flat fallback colour for Outlook, gradient start, gradient end)
TONES: dict[str, tuple[str, str, str]] = {
    "indigo": ("#4f46e5", "#6366f1", "#4338ca"),
    "success": ("#16a34a", "#22c55e", "#15803d"),
    "danger": ("#dc2626", "#f87171", "#b91c1c"),
    "amber": ("#d97706", "#fbbf24", "#b45309"),
}

# slug → (icon key, tone key, on-page heading)
SLUG_META: dict[str, tuple[str, str, str]] = {
    "new_user_welcome": ("user-plus", "indigo", "Welcome to SCDMS"),
    "password_reset": ("lock", "indigo", "Forgot your password?"),
    "account_locked_user": ("lock", "danger", "Your account was locked"),
    "account_locked_admin": ("shield-alert", "danger", "Security alert: account lockout"),
    "account_unlocked_user": ("unlock", "success", "Your account is unlocked"),
    "agenda_circulated": ("megaphone", "indigo", "Agenda circulated"),
    "meeting_scheduled": ("calendar", "indigo", "Meeting scheduled"),
    "meeting_postponed": ("calendar-x", "amber", "Meeting postponed"),
    "minutes_signed": ("edit-3", "success", "Minutes signed"),
    "submission_submitted": ("send", "indigo", "Submission sent to PSC"),
    "submission_received_confirmation": ("check-circle", "success", "We've received your submission"),
    "submission_returned_clarification": ("message-square", "amber", "Clarification needed"),
    "submission_resubmitted": ("refresh-cw", "indigo", "Submission resubmitted"),
    "submission_forwarded_commission": ("arrow-right-circle", "indigo", "Forwarded to the Commission"),
    "submission_deferred_back_hr": ("corner-down-left", "amber", "Deferred back to your ministry"),
    "submission_pending_dg_endorsement": ("clock", "amber", "Awaiting DG endorsement"),
    "submission_returned_to_hr": ("corner-down-left", "amber", "Returned for changes"),
    "submission_approved": ("check-circle", "success", "Submission approved"),
    "submission_rejected": ("x-circle", "danger", "Submission not approved"),
    "submission_stage_changed": ("refresh-cw", "indigo", "Submission status updated"),
    "submission_assigned_officer": ("user-check", "indigo", "A submission was allocated to you"),
    "submission_ready_for_manager": ("clipboard-check", "indigo", "Ready for your review"),
    "task_assigned": ("clipboard-list", "indigo", "A task was assigned to you"),
    "task_due_soon": ("clock", "amber", "Task due soon"),
    "subtask_due_soon": ("clock", "amber", "Subtask due soon"),
    "daily_brief_staff": ("sun", "indigo", "Your daily brief"),
    "daily_brief_manager": ("sun", "indigo", "Your daily brief"),
}

_DEFAULT_META = ("bell", "indigo", "SCDMS notification")

# Shared CTA button style — used by every default template body and by the
# auto-generated fallback below, so all emails get the same pill button.
BTN_STYLE = (
    "display:inline-block;background-color:#4f46e5;color:#ffffff;"
    "text-decoration:none;padding:13px 26px;border-radius:999px;"
    "font:700 14px/1 Arial,sans-serif;letter-spacing:.2px;"
)


def _icon_badge_html(icon_key: str, tone_key: str) -> str:
    solid, grad_from, grad_to = TONES.get(tone_key, TONES["indigo"])
    emoji = ICONS.get(icon_key, ICONS["bell"])
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>'
        f'<td class="opsc-badge" width="64" height="64" align="center" valign="middle" style="'
        f"width:64px;height:64px;border-radius:50%;background-color:{solid};"
        f"background-image:linear-gradient(135deg,{grad_from},{grad_to});"
        'font-size:28px;line-height:64px;text-align:center;mso-line-height-rule:exactly;">'
        f"{emoji}"
        "</td></tr></table>"
    )


def _brand_frame(inner_html: str, context: dict[str, Any], *, slug: str | None = None) -> str:
    """
    Wrap template HTML in the OPSC-branded shell so all emails share one
    smooth, elegant identity: soft lavender background, a white rounded
    card, a tone-coded animated icon badge for the notification type, and a
    minimal footer.
    """
    if not inner_html:
        inner_html = ""
    # Avoid double wrapping if a template already includes the branded shell.
    if "data-opsc-email-frame" in inner_html:
        return inner_html

    portal_url = html.escape(get_frontend_base_url(), quote=True)
    icon_key, tone_key, heading = SLUG_META.get(slug or "", _DEFAULT_META)
    icon_badge = _icon_badge_html(icon_key, tone_key)

    return (
        "<!DOCTYPE html>"
        '<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<meta name="color-scheme" content="light only">'
        "<title>SCDMS</title>"
        "<style>"
        "@keyframes opscPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}"
        ".opsc-badge{animation:opscPulse 2.4s ease-in-out infinite}"
        "</style></head>"
        '<body data-opsc-email-frame="1" style="margin:0;padding:0;background-color:#e8ecfb;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="background-color:#e8ecfb;">'
        '<tr><td align="center" style="padding:40px 16px;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">'
        "<tr><td>"
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="'
        "background-color:#ffffff;border-radius:22px;overflow:hidden;"
        'box-shadow:0 12px 32px -10px rgba(79,70,229,.25);">'
        '<tr><td style="padding:40px 36px 38px 36px;">'
        f"{icon_badge}"
        '<div style="font:700 25px/1.3 \'Segoe UI\',Arial,sans-serif;color:#312e81;margin:22px 0 14px 0;">'
        f"{html.escape(heading)}</div>"
        '<div style="color:#1e293b;font:400 15px/1.65 Arial,sans-serif;">'
        f"{inner_html}</div>"
        "</td></tr>"
        "</table>"
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;">'
        '<tr><td align="center" style="font:700 13px/1.5 Arial,sans-serif;color:#4338ca;letter-spacing:.3px;">SCDMS</td></tr>'
        '<tr><td align="center" style="padding-top:4px;font:400 12px/1.7 Arial,sans-serif;color:#64748b;">'
        "Office of the Public Service Commission<br>"
        "Government of the Republic of Vanuatu"
        "</td></tr>"
        '<tr><td align="center" style="padding-top:8px;font:400 12px/1.6 Arial,sans-serif;">'
        f'<a href="{portal_url}" style="color:#4f46e5;text-decoration:none;font-weight:700;">{portal_url}</a>'
        "</td></tr>"
        '<tr><td align="center" style="padding-top:16px;font:400 11px/1.6 Arial,sans-serif;color:#94a3b8;">'
        "This is an automated message from the Submission &amp; Commission Decision Management System (SCDMS)."
        "</td></tr>"
        "</table>"
        "</td></tr>"
        "</table>"
        "</td></tr>"
        "</table>"
        "</body></html>"
    )


def auto_html_from_text(text_body: str, context: dict[str, Any], *, slug: str | None = None) -> str:
    """
    Render a professional default HTML wrapper when a template has no explicit HTML body.
    """
    ctx = _stringify_context(context or {})

    action_url = (
        ctx.get("reset_url")
        or ctx.get("submission_url")
        or ctx.get("task_url")
        or ctx.get("login_url")
        or ""
    ).strip()

    # The plain-text body usually ends with a "Label: {{url}}" line (e.g.
    # "View submission: https://..."); once we add a real button + fallback
    # link below, repeating that raw URL a third time inside the paragraph
    # just reads as clutter, so drop that trailing line from the HTML copy.
    body_for_html = text_body or ""
    if action_url:
        lines = body_for_html.rstrip().split("\n")
        if lines and action_url in lines[-1] and len(lines[-1]) < len(action_url) + 40:
            body_for_html = "\n".join(lines[:-1]).rstrip()
    safe_text = html.escape(body_for_html).replace("\n", "<br>")
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
            f'<a href="{safe_action_url}" style="{BTN_STYLE}">'
            f"{html.escape(action_label)}</a></p>"
            f'<p style="margin:0 0 16px 0;color:#64748b;font-size:13px;word-break:break-all;">'
            f'<a href="{safe_action_url}" style="color:#4f46e5;">{safe_action_url}</a></p>'
        )

    return _brand_frame(
        f'<div style="margin:0 0 16px 0;">{safe_text}</div>{cta_html}',
        context,
        slug=slug,
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
        html_body = auto_html_from_text(text_body, context, slug=tpl.slug)
    else:
        html_body = _brand_frame(html_body, context, slug=tpl.slug)
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
    attachments: list[tuple[str, bytes, str]] | None = None,
) -> bool:
    """Render template `slug` and send via configured SMTP backend.

    ``attachments`` is an optional list of ``(filename, content, mimetype)``
    tuples (e.g. an agenda PDF) attached to the outgoing message.
    """
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
        for att in attachments or []:
            try:
                filename, content, mimetype = att
                msg.attach(filename, content, mimetype)
            except Exception:
                logger.warning("Skipping malformed attachment on %s email", slug)
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

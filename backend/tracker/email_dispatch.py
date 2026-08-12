"""Flush queued in-app notifications to email via Django SMTP (DynamicEmailBackend)."""

from __future__ import annotations

import logging

from django.core.mail import EmailMultiAlternatives

from .email_templates import auto_html_from_text, get_from_email, get_frontend_base_url
from .models import Notification

logger = logging.getLogger("scdms.app")

BATCH_LIMIT = 200


def dispatch_pending_emails() -> dict[str, int]:
    """
    Send notifications marked for email delivery that have not been emailed yet.

    Sends via django.core.mail.EmailMultiAlternatives → tracker.email_backend.
    DynamicEmailBackend (Admin SMTP settings / env), with a plain-text body plus
    a branded HTML alternative (auto_html_from_text) so it renders consistently
    with the rest of the system's emails — a plain-text-only send previously
    showed as "Empty" in transactional-email dashboards that preview the HTML part.
    """
    stats = {"sent": 0, "failed": 0, "skipped": 0}
    from_email = get_from_email()

    pending = (
        Notification.objects.filter(
            emailed=False,
            channel__in=[Notification.Channel.EMAIL, Notification.Channel.BOTH],
        )
        .select_related("recipient")
        .order_by("created_at")[:BATCH_LIMIT]
    )

    for notif in pending:
        user = notif.recipient
        if not user or not getattr(user, "is_active", True):
            notif.emailed = True
            notif.save(update_fields=["emailed"])
            stats["skipped"] += 1
            continue

        recipient = (getattr(user, "email", None) or "").strip()
        if not recipient:
            notif.emailed = True
            notif.save(update_fields=["emailed"])
            stats["skipped"] += 1
            continue

        body = (notif.body or "").strip() or notif.title
        link_url = f"{get_frontend_base_url()}{notif.link}" if notif.link else ""
        if link_url:
            body += f"\n\nOpen in SCDMS: {link_url}"
        try:
            msg = EmailMultiAlternatives(
                subject=notif.title,
                body=body,
                from_email=from_email,
                to=[recipient],
            )
            html_body = auto_html_from_text(body, {"submission_url": link_url} if link_url else {})
            msg.attach_alternative(html_body, "text/html")
            msg.send(fail_silently=False)
            notif.emailed = True
            notif.save(update_fields=["emailed"])
            stats["sent"] += 1
        except Exception as exc:
            logger.exception(
                "EMAIL_DISPATCH_FAIL | notification=%s | to=%s | %s",
                notif.pk,
                recipient,
                exc,
            )
            stats["failed"] += 1

    logger.info("EMAIL_DISPATCH | stats=%s", stats)
    return stats

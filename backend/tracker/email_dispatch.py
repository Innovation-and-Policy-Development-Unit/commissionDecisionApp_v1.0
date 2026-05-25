"""Flush queued in-app notifications to email via Django SMTP (DynamicEmailBackend)."""

from __future__ import annotations

import logging

from django.core.mail import send_mail

from .email_templates import get_from_email
from .models import Notification

logger = logging.getLogger("scdms.app")

BATCH_LIMIT = 200


def dispatch_pending_emails() -> dict[str, int]:
    """
    Send notifications marked for email delivery that have not been emailed yet.

    Uses django.core.mail.send_mail → tracker.email_backend.DynamicEmailBackend
    (Admin SMTP settings / env).
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
        try:
            send_mail(
                notif.title,
                body,
                from_email,
                [recipient],
                fail_silently=False,
            )
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

"""Web Push (VAPID) delivery.

Sends browser/PWA push messages to a user's stored WebPushSubscriptions. Disabled
gracefully when VAPID keys are not configured. Dead subscriptions (HTTP 404/410)
are pruned automatically.
"""

from __future__ import annotations

import json
import logging

from django.conf import settings

log = logging.getLogger("scdms.app")


def push_configured() -> bool:
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY)


def _vapid_claims() -> dict:
    return {"sub": settings.VAPID_SUBJECT or "mailto:admin@psc.gov.vu"}


def send_to_subscription(subscription, payload: dict) -> bool:
    """Send one push. Returns True on success; prunes the subscription on 404/410."""
    from pywebpush import WebPushException, webpush

    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh_key, "auth": subscription.auth_key},
            },
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims=_vapid_claims(),
            ttl=86400,
        )
        return True
    except WebPushException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):
            # Subscription is gone — remove it so we stop trying.
            subscription.delete()
        else:
            log.warning("WEB_PUSH_FAIL | sub=%s status=%s: %s", subscription.id, status, exc)
        return False
    except Exception:
        log.exception("WEB_PUSH_ERROR | sub=%s", subscription.id)
        return False


def send_push_to_user(user, *, title: str, body: str = "", url: str = "", tag: str = "") -> int:
    """Push to all of a user's subscriptions. Returns the number delivered."""
    if not push_configured():
        return 0
    from .models import WebPushSubscription

    payload = {"title": title, "body": body, "url": url or "/", "tag": tag or ""}
    sent = 0
    for sub in WebPushSubscription.objects.filter(user=user):
        if send_to_subscription(sub, payload):
            sent += 1
    return sent

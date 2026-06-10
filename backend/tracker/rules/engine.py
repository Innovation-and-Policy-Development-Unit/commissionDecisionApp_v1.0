"""Rule evaluation, flag reconciliation, alerting, and digest — multi-entity.

Evaluation is system-level (sees everything); flags are *viewed* through each
entity's RBAC scoping (see ``entities.py``). Submissions, commission tasks, and
meetings/minutes are all watched through the same engine.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings as dj_settings
from django.core.mail import EmailMultiAlternatives
from django.db.models import Q
from django.utils import timezone
from django.utils.html import escape

from .entities import get_adapter

logger = logging.getLogger(__name__)

DIGEST_HOUR = 7  # Pacific/Efate
_MANAGER_ROLES = {
    "psc_admin", "psc_manager", "senior_admin_officer", "chairperson",
    "vipam_manager", "hr_unit_manager", "odu_manager", "compliance_manager",
}
_LEVEL_LABEL = {"critical": "Critical", "at_risk": "At risk", "monitoring": "Monitoring"}


def _portal():
    try:
        from tracker.email_templates import get_frontend_base_url
        return (get_frontend_base_url() or "").rstrip("/")
    except Exception:  # noqa: BLE001
        return ""


def evaluate_rule(rule, now):
    """Open flags for newly-matching entities; clear flags that no longer match."""
    from tracker.models import SubmissionFlag

    adapter = get_adapter(rule.entity)
    if adapter is None:
        return 0, 0
    fk_id = f"{adapter.flag_fk}_id"
    matched = adapter.matched_ids(rule, now)

    existing = {}
    for f in SubmissionFlag.objects.filter(rule=rule).exclude(status=SubmissionFlag.Status.CLEARED):
        eid = getattr(f, fk_id)
        if eid is not None:
            existing[eid] = f

    opened = 0
    for eid in matched:
        if eid not in existing:
            SubmissionFlag.objects.create(rule=rule, **{fk_id: eid})
            opened += 1
    cleared = 0
    for eid, flag in existing.items():
        if eid not in matched:
            flag.status = SubmissionFlag.Status.CLEARED
            flag.cleared_at = now
            flag.save(update_fields=["status", "cleared_at", "updated_at"])
            cleared += 1
    return opened, cleared


def _alert_flag(rule, flag, adapter, now):
    from tracker.models import Notification

    obj = getattr(flag, adapter.flag_fk)
    if obj is None:
        return
    pl = adapter.payload(flag)
    title = f"[{_LEVEL_LABEL.get(rule.level, rule.level)}] {rule.name}"
    body = f"{pl['ref']} — {pl['title']}"

    emails = []
    for user in adapter.recipients(rule, obj):
        Notification.objects.create(
            recipient=user,
            submission=(obj if adapter.key == "submission" else None),
            channel=Notification.Channel.IN_APP, title=title, body=body,
        )
        if (user.email or "").strip():
            emails.append(user.email.strip())

    if emails and not rule.test_mode:
        try:
            base = _portal()
            link = f"{base}{pl['link']}" if base else ""
            cta = f"<p><a href='{escape(link)}'>Open in SCDMS</a></p>" if link else ""
            html = (
                "<div style='font-family:Segoe UI,Arial,sans-serif;color:#0f172a'>"
                f"<h3 style='margin:0 0 6px'>{escape(title)}</h3>"
                f"<p style='margin:0 0 4px'><strong>{escape(str(pl['ref']))}</strong> — {escape(str(pl['title']))}</p>"
                f"<p style='color:#64748b;font-size:13px'>{escape(rule.description or '')}</p>{cta}</div>"
            )
            msg = EmailMultiAlternatives(subject=title[:200], body=body,
                                         from_email=dj_settings.DEFAULT_FROM_EMAIL, to=emails)
            msg.attach_alternative(html, "text/html")
            msg.send(fail_silently=True)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Flag alert email failed: %s", exc)


def evaluate_all(now=None):
    from tracker.models import SubmissionFlag, SubmissionRule

    now = now or timezone.now()
    summary = {"rules": 0, "opened": 0, "cleared": 0, "alerted": 0}
    for rule in SubmissionRule.objects.filter(is_active=True):
        adapter = get_adapter(rule.entity)
        if adapter is None:
            continue
        opened, cleared = evaluate_rule(rule, now)
        summary["rules"] += 1
        summary["opened"] += opened
        summary["cleared"] += cleared
        if rule.test_mode:
            continue  # flags only — no alerts in test mode
        # Alert flags that have never been alerted; if `realert`, also re-alert
        # open flags whose last alert is older than the rule's cooldown window.
        alert_filter = Q(last_alerted_at__isnull=True)
        if rule.realert and rule.cooldown_minutes:
            alert_filter |= Q(last_alerted_at__lt=now - timedelta(minutes=rule.cooldown_minutes))
        to_alert = (
            SubmissionFlag.objects
            .filter(rule=rule, status=SubmissionFlag.Status.OPEN)
            .filter(alert_filter)
            .select_related("submission", "submission__ministry", "commission_task",
                            "commission_task__assigned_manager", "meeting")
        )
        for flag in to_alert:
            _alert_flag(rule, flag, adapter, now)
            flag.last_alerted_at = now
            flag.save(update_fields=["last_alerted_at"])
            summary["alerted"] += 1
    return summary


def maybe_send_digest(now=None):
    from tracker.models import Profile, SubmissionFlag

    now = now or timezone.localtime()
    if now.hour != DIGEST_HOUR:
        return {"sent": 0, "reason": "not_digest_hour"}

    flags = list(
        SubmissionFlag.objects.filter(status=SubmissionFlag.Status.OPEN)
        .select_related("rule", "submission", "submission__ministry",
                        "commission_task", "commission_task__assigned_manager", "meeting")
    )
    if not flags:
        return {"sent": 0, "reason": "no_open_flags"}

    by_level = {"critical": [], "at_risk": [], "monitoring": []}
    for f in flags:
        adapter = get_adapter(f.rule.entity)
        if adapter is None:
            continue
        by_level.setdefault(f.rule.level, []).append(adapter.payload(f))

    recipients = [
        p.user for p in Profile.objects.filter(role__in=_MANAGER_ROLES).select_related("user")
        if p.user.is_active and (p.user.email or "").strip()
    ]
    if not recipients:
        return {"sent": 0, "reason": "no_recipients"}

    base = _portal()
    sections = ""
    for level in ("critical", "at_risk", "monitoring"):
        items = by_level.get(level) or []
        if not items:
            continue
        rows = "".join(
            f"<li>{escape(str(pl['ref']))} — {escape(str(pl['title']))}</li>" for pl in items[:25]
        )
        sections += f"<h4 style='margin:14px 0 4px'>{_LEVEL_LABEL[level]} — {len(items)}</h4><ul>{rows}</ul>"

    html = (
        "<div style='font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:680px'>"
        f"<h2 style='margin:0 0 4px'>SCDMS flag digest</h2>"
        f"<p style='color:#64748b;font-size:12px'>{len(flags)} open flags · {timezone.localtime(now).strftime('%d %b %Y')}</p>"
        f"{sections}"
        + (f"<p style='margin-top:12px'><a href='{escape(base)}/intelligence/flags'>Open Flag Monitor</a></p>" if base else "")
        + "</div>"
    )
    sent = 0
    for user in recipients:
        try:
            msg = EmailMultiAlternatives(
                subject=f"SCDMS flag digest — {len(flags)} open",
                body="Open the Flag Monitor to review at-risk work.",
                from_email=dj_settings.DEFAULT_FROM_EMAIL, to=[user.email.strip()],
            )
            msg.attach_alternative(html, "text/html")
            msg.send(fail_silently=True)
            sent += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("Flag digest email failed: %s", exc)
    return {"sent": sent}

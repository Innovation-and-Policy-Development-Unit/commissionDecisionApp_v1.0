"""Send daily brief emails and write delivery logs."""

from __future__ import annotations

import logging
import time
from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone

from tracker.email_notify import merge_recipient_context
from tracker.email_templates import get_frontend_base_url, send_templated_email

from .collectors import (
    active_staff_users,
    collect_manager_brief,
    collect_staff_brief,
    manager_brief_is_empty,
    staff_brief_is_empty,
    staff_user_enabled,
)
from .models import DailyBriefDeliveryLog, DailyBriefSettings, DailyBriefStaffPreference
from .render import (
    brief_date_label,
    count_manager_sections,
    count_staff_sections,
    render_manager_kpis_html,
    render_staff_sections_html,
)

logger = logging.getLogger(__name__)

SEND_DELAY_SEC = 0.2


def _resolve_recipient_email(user: User, settings: DailyBriefSettings) -> str:
    if settings.test_mode and settings.test_recipient_email:
        return settings.test_recipient_email.strip()
    return (user.email or "").strip()


def _log_delivery(
    *,
    brief_type: str,
    status: str,
    user: User | None,
    recipient_email: str,
    subject: str = "",
    sections_count: int = 0,
    items_total: int = 0,
    generation_ms: int = 0,
    error_message: str = "",
    detail: dict | None = None,
):
    DailyBriefDeliveryLog.objects.create(
        brief_type=brief_type,
        status=status,
        user=user,
        recipient_email=recipient_email,
        subject=subject[:500],
        sections_count=sections_count,
        items_total=items_total,
        generation_ms=generation_ms,
        error_message=error_message[:2000] if error_message else "",
        detail=detail or {},
    )


def _send_staff_brief(user: User, settings: DailyBriefSettings, force: bool) -> None:
    t0 = time.perf_counter()
    email = _resolve_recipient_email(user, settings)
    if not email:
        _log_delivery(
            brief_type=DailyBriefDeliveryLog.BriefType.STAFF,
            status=DailyBriefDeliveryLog.Status.FAILED,
            user=user,
            recipient_email="",
            error_message="User has no email address.",
        )
        return

    data = collect_staff_brief(user)
    if staff_brief_is_empty(data) and not force:
        _log_delivery(
            brief_type=DailyBriefDeliveryLog.BriefType.STAFF,
            status=DailyBriefDeliveryLog.Status.SKIPPED,
            user=user,
            recipient_email=email,
            detail={"reason": "empty_brief"},
        )
        return

    sections_html = render_staff_sections_html(data)
    sections_count, items_total = count_staff_sections(data)
    brief_date = brief_date_label()
    portal_url = get_frontend_base_url()
    ctx = merge_recipient_context(
        user,
        brief_date=brief_date,
        sections_html=sections_html,
        portal_url=portal_url,
    )
    gen_ms = int((time.perf_counter() - t0) * 1000)

    ok = send_templated_email(
        slug="daily_brief_staff",
        to=[email],
        context=ctx,
        fail_silently=False,
    )
    if ok:
        pref, _ = DailyBriefStaffPreference.objects.get_or_create(user=user)
        pref.last_delivered_at = timezone.now()
        pref.save(update_fields=["last_delivered_at"])
        _log_delivery(
            brief_type=DailyBriefDeliveryLog.BriefType.STAFF,
            status=DailyBriefDeliveryLog.Status.SENT,
            user=user,
            recipient_email=email,
            subject=f"Your daily brief — {brief_date}",
            sections_count=sections_count,
            items_total=items_total,
            generation_ms=gen_ms,
        )
    else:
        _log_delivery(
            brief_type=DailyBriefDeliveryLog.BriefType.STAFF,
            status=DailyBriefDeliveryLog.Status.FAILED,
            user=user,
            recipient_email=email,
            sections_count=sections_count,
            items_total=items_total,
            generation_ms=gen_ms,
            error_message="SMTP send failed.",
        )


def _send_manager_brief(user: User, settings: DailyBriefSettings) -> None:
    t0 = time.perf_counter()
    email = _resolve_recipient_email(user, settings)
    if not email:
        _log_delivery(
            brief_type=DailyBriefDeliveryLog.BriefType.MANAGER,
            status=DailyBriefDeliveryLog.Status.FAILED,
            user=user,
            recipient_email="",
            error_message="User has no email address.",
        )
        return

    data = collect_manager_brief()
    if manager_brief_is_empty(data):
        _log_delivery(
            brief_type=DailyBriefDeliveryLog.BriefType.MANAGER,
            status=DailyBriefDeliveryLog.Status.SKIPPED,
            user=user,
            recipient_email=email,
            detail={"reason": "empty_brief"},
        )
        return

    kpis_html = render_manager_kpis_html(data)
    sections_count, items_total = count_manager_sections(data)
    brief_date = brief_date_label()
    portal_url = get_frontend_base_url()
    ctx = merge_recipient_context(
        user,
        brief_date=brief_date,
        kpis_html=kpis_html,
        portal_url=portal_url,
    )
    gen_ms = int((time.perf_counter() - t0) * 1000)

    ok = send_templated_email(
        slug="daily_brief_manager",
        to=[email],
        context=ctx,
        fail_silently=False,
    )
    if ok:
        _log_delivery(
            brief_type=DailyBriefDeliveryLog.BriefType.MANAGER,
            status=DailyBriefDeliveryLog.Status.SENT,
            user=user,
            recipient_email=email,
            subject=f"Manager daily brief — {brief_date}",
            sections_count=sections_count,
            items_total=items_total,
            generation_ms=gen_ms,
        )
    else:
        _log_delivery(
            brief_type=DailyBriefDeliveryLog.BriefType.MANAGER,
            status=DailyBriefDeliveryLog.Status.FAILED,
            user=user,
            recipient_email=email,
            sections_count=sections_count,
            items_total=items_total,
            generation_ms=gen_ms,
            error_message="SMTP send failed.",
        )


def run_daily_briefs(force: bool = False, test_user_id: int | None = None) -> dict[str, Any]:
    """
    Run staff + manager briefs. Returns summary counts.
    When test_user_id is set, only that user receives a staff brief (force).
    """
    settings = DailyBriefSettings.get_solo()
    if not settings.enabled and not force and not test_user_id:
        return {"skipped": True, "reason": "disabled"}

    summary: dict[str, Any] = {
        "staff_sent": 0,
        "staff_skipped": 0,
        "staff_failed": 0,
        "manager_sent": 0,
        "manager_skipped": 0,
        "manager_failed": 0,
    }

    if test_user_id:
        user = User.objects.filter(pk=test_user_id, is_active=True).first()
        if user:
            _send_staff_brief(user, settings, force=True)
        return summary

    for user in active_staff_users():
        if not staff_user_enabled(user):
            continue
        _send_staff_brief(user, settings, force=force)
        time.sleep(SEND_DELAY_SEC)

    manager_users = _manager_recipient_users(settings)
    for user in manager_users:
        _send_manager_brief(user, settings)
        time.sleep(SEND_DELAY_SEC)

    today = timezone.localdate()
    settings.last_run_date = today
    settings.save(update_fields=["last_run_date"])

    return summary


def _manager_recipient_users(settings: DailyBriefSettings):
    ids = set(settings.manager_recipient_ids or [])
    ids.update(settings.manager_recipients.values_list("id", flat=True))
    if not ids:
        return User.objects.none()
    return User.objects.filter(pk__in=ids, is_active=True).order_by("username")

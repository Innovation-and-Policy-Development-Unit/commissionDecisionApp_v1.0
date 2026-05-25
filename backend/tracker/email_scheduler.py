"""Sync SystemSetting email cron → django-celery-beat PeriodicTask."""

from __future__ import annotations

import logging

log = logging.getLogger("scdms.security")

TASK_NAME = "tracker.tasks.send_scheduled_emails"
PERIODIC_NAME = "scheduled-email-dispatch"
DEFAULT_CRON = "0 8 * * *"


def start_email_scheduler():
    """Ensure Celery Beat has the scheduled email dispatch task when enabled."""
    try:
        from .models import SystemSetting

        enabled = SystemSetting.get_bool("EMAIL_CRON_ENABLED", default=True)
        schedule = (SystemSetting.get_val("EMAIL_CRON_SCHEDULE") or DEFAULT_CRON).strip()

        if enabled and schedule:
            _apply_cron(schedule)
            log.info("Email dispatch schedule synced to Celery beat (schedule=%r)", schedule)
        else:
            _disable_job()
            log.info("Email dispatch cron disabled — PeriodicTask not active")
    except Exception as exc:
        log.error("Failed to sync email dispatch schedule to Celery beat: %s", exc)


def update_email_schedule(*, cron_expr: str | None, enabled: bool = True):
    """Create/update or disable the Celery Beat email dispatch task."""
    if not enabled or not cron_expr or not cron_expr.strip():
        _disable_job()
        return
    _apply_cron(cron_expr.strip())


def get_email_next_run() -> str | None:
    """Return next scheduled run as ISO-8601, or None."""
    try:
        from django_celery_beat.models import PeriodicTask

        task = PeriodicTask.objects.filter(name=PERIODIC_NAME).first()
        if task and task.enabled and task.crontab:
            return task.crontab.get_due_date(task.last_run_at).isoformat()
    except Exception:
        pass
    return None


def _apply_cron(expr: str):
    parts = expr.split()
    if len(parts) != 5:
        raise ValueError(f"Invalid cron expression (need 5 fields): {expr!r}")

    from django_celery_beat.models import CrontabSchedule, PeriodicTask

    minute, hour, day, month, day_of_week = parts

    cron, _ = CrontabSchedule.objects.get_or_create(
        minute=minute,
        hour=hour,
        day_of_month=day,
        month_of_year=month,
        day_of_week=day_of_week,
        timezone="Pacific/Efate",
    )

    PeriodicTask.objects.update_or_create(
        name=PERIODIC_NAME,
        defaults={
            "crontab": cron,
            "task": TASK_NAME,
            "enabled": True,
        },
    )


def _disable_job():
    try:
        from django_celery_beat.models import PeriodicTask

        PeriodicTask.objects.filter(name=PERIODIC_NAME).delete()
    except Exception:
        pass

"""Sync Celery Beat periodic task for hourly daily-brief checks."""

import logging

from django.utils import timezone

log = logging.getLogger("scdms.security")

TASK_NAME = "tracker.tasks.run_daily_briefs_task"
PERIODIC_NAME = "daily-brief"


def sync_daily_brief_scheduler():
    """Ensure hourly beat task exists when module is enabled."""
    try:
        from .models import DailyBriefSettings

        settings = DailyBriefSettings.get_solo()
        if settings.enabled:
            _apply_hourly()
            log.info("Daily brief schedule synced to Celery beat (hourly)")
        else:
            _remove_job()
            log.info("Daily brief disabled — beat task removed")
    except Exception as exc:
        log.error("Failed to sync daily brief schedule: %s", exc)


def get_next_beat_run() -> str | None:
    try:
        from django_celery_beat.models import PeriodicTask

        task = PeriodicTask.objects.filter(name=PERIODIC_NAME).first()
        if task and task.enabled and task.crontab:
            return task.crontab.get_due_date(task.last_run_at).isoformat()
    except Exception:
        pass
    return None


def should_run_delivery_now() -> bool:
    """True if Pacific/Efate local time matches delivery hour and not yet run today."""
    from .models import DailyBriefSettings

    settings = DailyBriefSettings.get_solo()
    if not settings.enabled:
        return False
    if settings.module_status == DailyBriefSettings.ModuleStatus.PAUSED:
        return False

    now = timezone.localtime()
    if settings.weekdays_only and now.weekday() >= 5:
        return False

    hour = max(5, min(12, settings.delivery_hour or 7))
    if now.hour != hour:
        return False

    today = now.date()
    if settings.last_run_date == today:
        return False
    return True


def _apply_hourly():
    from django_celery_beat.models import CrontabSchedule, PeriodicTask

    cron, _ = CrontabSchedule.objects.get_or_create(
        minute="0",
        hour="*",
        day_of_month="*",
        month_of_year="*",
        day_of_week="*",
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


def _remove_job():
    try:
        from django_celery_beat.models import PeriodicTask

        PeriodicTask.objects.filter(name=PERIODIC_NAME).delete()
    except Exception:
        pass

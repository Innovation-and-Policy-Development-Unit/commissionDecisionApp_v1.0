import logging

from django.utils import timezone

log = logging.getLogger("scdms.security")

TASK_NAME = "tracker.tasks.run_backup"


def start_backup_scheduler():
    """
    Ensure a Celery Beat PeriodicTask exists for the database backup based on
    the current BACKUP_SCHEDULE SystemSetting.
    """
    try:
        from .models import SystemSetting

        schedule = None
        try:
            schedule = SystemSetting.objects.get(key="BACKUP_SCHEDULE").value.strip()
        except Exception:
            pass

        if schedule:
            _apply_cron(schedule)
            log.info("Backup schedule synced to Celery beat (schedule=%r)", schedule)
        else:
            _remove_job()
            log.info("No backup schedule configured — no PeriodicTask created")
    except Exception as exc:
        log.error("Failed to sync backup schedule to Celery beat: %s", exc)


def update_schedule(cron_expr: str | None):
    """
    Create/update or remove the Celery Beat PeriodicTask for the backup job.
    """
    if not cron_expr or not cron_expr.strip():
        _remove_job()
        return
    _apply_cron(cron_expr.strip())


def get_next_run() -> str | None:
    """Return the next scheduled run time as an ISO-8601 string, or None."""
    try:
        from django_celery_beat.models import PeriodicTask

        task = PeriodicTask.objects.filter(name="db-backup").first()
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
        name="db-backup",
        defaults={
            "crontab": cron,
            "task": TASK_NAME,
            "enabled": True,
        },
    )


def _remove_job():
    try:
        from django_celery_beat.models import PeriodicTask

        PeriodicTask.objects.filter(name="db-backup").delete()
    except Exception:
        pass

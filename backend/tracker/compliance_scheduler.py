"""Register the compliance SLA recompute task with django-celery-beat."""

from __future__ import annotations

import logging

log = logging.getLogger("scdms.security")

TASK_NAME = "tracker.tasks.recompute_compliance_sla"
PERIODIC_NAME = "compliance-sla-recompute"
# Every 6 hours — keeps at-risk / overdue flags fresh for dashboards & escalation.
DEFAULT_CRON = "0 */6 * * *"


def sync_compliance_sla_scheduler():
    """Ensure Celery Beat has the compliance SLA recompute task."""
    try:
        parts = DEFAULT_CRON.split()
        minute, hour, day, month, day_of_week = parts

        from django_celery_beat.models import CrontabSchedule, PeriodicTask

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
            defaults={"crontab": cron, "task": TASK_NAME, "enabled": True},
        )
        log.info("Compliance SLA recompute schedule synced to Celery beat")
    except Exception as exc:  # noqa: BLE001
        log.error("Failed to sync compliance SLA schedule to Celery beat: %s", exc)

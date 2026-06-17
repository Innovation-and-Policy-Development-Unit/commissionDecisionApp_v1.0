"""Register compliance Celery beat tasks: SLA recompute + deadline notifications."""

from __future__ import annotations

import logging

log = logging.getLogger("scdms.security")

SLA_TASK_NAME      = "tracker.tasks.recompute_compliance_sla"
NOTIFY_TASK_NAME   = "tracker.tasks.send_compliance_deadline_notifications"
SLA_PERIODIC_NAME  = "compliance-sla-recompute"
NOTIFY_PERIODIC_NAME = "compliance-deadline-notifications"

# SLA recompute every 6 hours; notifications run 10 min after each recompute hour.
SLA_CRON    = "0 */6 * * *"
NOTIFY_CRON = "10 */6 * * *"


def sync_compliance_sla_scheduler():
    """Ensure Celery Beat has the compliance SLA recompute and notification tasks."""
    try:
        from django_celery_beat.models import CrontabSchedule, PeriodicTask

        def _cron(expr):
            minute, hour, day, month, dow = expr.split()
            cron, _ = CrontabSchedule.objects.get_or_create(
                minute=minute, hour=hour,
                day_of_month=day, month_of_year=month,
                day_of_week=dow, timezone="Pacific/Efate",
            )
            return cron

        PeriodicTask.objects.update_or_create(
            name=SLA_PERIODIC_NAME,
            defaults={"crontab": _cron(SLA_CRON), "task": SLA_TASK_NAME, "enabled": True},
        )
        PeriodicTask.objects.update_or_create(
            name=NOTIFY_PERIODIC_NAME,
            defaults={"crontab": _cron(NOTIFY_CRON), "task": NOTIFY_TASK_NAME, "enabled": True},
        )
        log.info("Compliance SLA recompute schedule synced to Celery beat")
    except Exception as exc:  # noqa: BLE001
        log.error("Failed to sync compliance SLA schedule to Celery beat: %s", exc)

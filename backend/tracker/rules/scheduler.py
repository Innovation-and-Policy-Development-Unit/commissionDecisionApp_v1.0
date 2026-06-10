"""Sync the hourly Celery-beat tick that evaluates Submission rules."""

import logging

logger = logging.getLogger(__name__)

PERIODIC_NAME = "submission-rules"
TASK_NAME = "tracker.tasks.run_submission_rules_task"


def sync_rules_scheduler() -> None:
    try:
        from django_celery_beat.models import CrontabSchedule, PeriodicTask

        cron, _ = CrontabSchedule.objects.get_or_create(
            minute="0", hour="*", day_of_month="*", month_of_year="*", day_of_week="*",
            timezone="Pacific/Efate",
        )
        PeriodicTask.objects.update_or_create(
            name=PERIODIC_NAME,
            defaults={"crontab": cron, "task": TASK_NAME, "enabled": True},
        )
        logger.info("Submission rules schedule synced to Celery beat (hourly)")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to sync submission rules schedule: %s", exc)

"""Register the periodic session-cap enforcement Celery beat task (applies to all users).

Each user's cutoff (5pm same day, or 12h after login if they logged in after
5pm) is individual — see TrustedSession.compute_expiry() — so this runs
frequently and force_logout_expired_sessions() only acts on sessions that have
actually expired, rather than firing a single blanket sweep at a fixed clock
time.
"""

from __future__ import annotations

import logging

log = logging.getLogger("scdms.security")

TASK_NAME = "tracker.tasks.force_logout_expired_sessions"
PERIODIC_NAME = "session-cap-force-logout"

# Every 15 minutes.
CRON = "*/15 * * * *"


def sync_force_logout_scheduler():
    """Ensure Celery Beat has the periodic session-cap force-logout task."""
    try:
        from django_celery_beat.models import CrontabSchedule, PeriodicTask

        minute, hour, day, month, dow = CRON.split()
        cron, _ = CrontabSchedule.objects.get_or_create(
            minute=minute, hour=hour,
            day_of_month=day, month_of_year=month,
            day_of_week=dow, timezone="Pacific/Efate",
        )
        PeriodicTask.objects.update_or_create(
            name=PERIODIC_NAME,
            defaults={"crontab": cron, "task": TASK_NAME, "enabled": True},
        )
        # Remove the old once-daily task name if it still exists from a
        # previous deploy, so there's no duplicate/stale schedule.
        PeriodicTask.objects.filter(name="daily-5pm-force-logout").delete()
        log.info("Session-cap force-logout schedule synced to Celery beat")
    except Exception as exc:  # noqa: BLE001
        log.error("Failed to sync force-logout schedule to Celery beat: %s", exc)

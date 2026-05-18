import os
import sys

from django.apps import AppConfig


class TrackerConfig(AppConfig):
    name = "tracker"

    def ready(self):
        """
        Start the background backup scheduler.

        Guarded against Django's development auto-reloader which spawns a
        second child process (RUN_MAIN='true' only in the child).  In
        production / gunicorn we always start.
        """
        # In dev runserver: only run in the reloader child (RUN_MAIN=true)
        in_runserver = "runserver" in sys.argv
        if in_runserver and os.environ.get("RUN_MAIN") != "true":
            return

        # Skip during management commands that don't need the scheduler
        skip_commands = {"migrate", "makemigrations", "shell", "backup_db", "seed_tracker"}
        if sys.argv and len(sys.argv) > 1 and sys.argv[1] in skip_commands:
            return

        try:
            from .scheduler import start_backup_scheduler
            start_backup_scheduler()
        except Exception as exc:  # noqa: BLE001
            import logging
            logging.getLogger("scdms.security").warning(
                "Backup schedule could not be synced to Celery beat: %s", exc
            )

        # Wire up signal handlers for AI feedback analysis
        try:
            import tracker.signals  # noqa: F401
        except Exception as exc:  # noqa: BLE001
            import logging
            logging.getLogger("scdms.security").warning(
                "Feedback AI signals could not be registered: %s", exc
            )

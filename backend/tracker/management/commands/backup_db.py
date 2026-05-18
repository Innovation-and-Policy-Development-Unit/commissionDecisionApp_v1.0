"""
Management command: backup_db

Creates a JSON fixture backup of all application data using Django's dumpdata.
Stores backups in BACKUP_DIR (env var, defaults to /var/backups/scdms).
Prunes files older than BACKUP_RETENTION_DAYS (SystemSetting, default 30).

Usage:
    python manage.py backup_db
    python manage.py backup_db --dir /tmp/mybackups
"""

import os
from datetime import datetime
from io import StringIO

from django.core.management import call_command
from django.core.management.base import BaseCommand

BACKUP_DIR = os.getenv("BACKUP_DIR", "/var/backups/scdms")

# Apps/models to exclude from the dump (regeneratable or causes restore conflicts)
_EXCLUDE = [
    "contenttypes",
    "auth.permission",
    "axes",
    "token_blacklist",
    "admin.logentry",
    "sessions",
]


class Command(BaseCommand):
    help = "Create a JSON database backup via dumpdata and prune old files."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dir",
            default=BACKUP_DIR,
            help="Directory to write the backup file (default: BACKUP_DIR env var).",
        )

    def handle(self, *args, **options):
        backup_dir = options["dir"]
        os.makedirs(backup_dir, exist_ok=True)

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"scdms_backup_{ts}.json"
        filepath = os.path.join(backup_dir, filename)

        self.stdout.write(f"Creating backup: {filepath}")

        buf = StringIO()
        call_command(
            "dumpdata",
            "--natural-foreign",
            "--natural-primary",
            "--indent=2",
            *[f"--exclude={e}" for e in _EXCLUDE],
            stdout=buf,
            stderr=self.stderr,
        )
        data = buf.getvalue()

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(data)

        size_kb = len(data.encode()) / 1024
        self.stdout.write(
            self.style.SUCCESS(
                f"[OK] Backup saved: {filename}  ({size_kb:.1f} KB)"
            )
        )

        self._cleanup_old(backup_dir)
        # Return filename so the view can read it back
        return filename

    # ── helpers ──────────────────────────────────────────────────────────────

    def _cleanup_old(self, backup_dir: str):
        days = 30
        try:
            from tracker.models import SystemSetting
            setting = SystemSetting.objects.filter(key="BACKUP_RETENTION_DAYS").first()
            if setting:
                days = int(setting.value)
        except Exception:  # noqa: BLE001
            pass

        cutoff = datetime.now().timestamp() - (days * 86_400)
        removed = 0
        for fn in os.listdir(backup_dir):
            if fn.startswith("scdms_backup_") and fn.endswith(".json"):
                fp = os.path.join(backup_dir, fn)
                if os.path.getmtime(fp) < cutoff:
                    os.remove(fp)
                    removed += 1

        if removed:
            self.stdout.write(f"  Pruned {removed} backup(s) older than {days} days.")

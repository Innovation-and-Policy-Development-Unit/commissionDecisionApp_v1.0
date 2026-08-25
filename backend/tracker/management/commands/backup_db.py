"""
Management command: backup_db

Creates a .zip backup containing a JSON fixture (data.json, via Django's
dumpdata) plus every file under MEDIA_ROOT (media/), so a restore brings
back attachments — submission documents, profile pictures/signatures,
generated PDFs, etc. — not just database rows.

Stores backups in BACKUP_DIR (env var, defaults to /var/backups/scdms).
Prunes files older than BACKUP_RETENTION_DAYS (SystemSetting, default 30).

Usage:
    python manage.py backup_db
    python manage.py backup_db --dir /tmp/mybackups
"""

import os
import zipfile
from datetime import datetime
from io import StringIO

from django.conf import settings
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
    help = "Create a .zip database + media backup and prune old files."

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
        filename = f"scdms_backup_{ts}.zip"
        filepath = os.path.join(backup_dir, filename)

        self.stdout.write(f"Creating backup: {filepath}")

        buf = StringIO()
        call_command(
            "dumpdata",
            "--all",  # base managers — include soft-archived rows (e.g. archived documents)
            "--natural-foreign",
            "--natural-primary",
            "--indent=2",
            *[f"--exclude={e}" for e in _EXCLUDE],
            stdout=buf,
            stderr=self.stderr,
        )
        data = buf.getvalue()

        media_root = getattr(settings, "MEDIA_ROOT", "") or ""
        media_files = []
        if media_root and os.path.isdir(media_root):
            for root, _dirs, files in os.walk(media_root):
                for fn in files:
                    abs_path = os.path.join(root, fn)
                    rel_path = os.path.relpath(abs_path, media_root)
                    media_files.append((abs_path, rel_path))

        with zipfile.ZipFile(filepath, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("data.json", data)
            for abs_path, rel_path in media_files:
                zf.write(abs_path, arcname=os.path.join("media", rel_path))

        size_kb = os.path.getsize(filepath) / 1024
        self.stdout.write(
            self.style.SUCCESS(
                f"[OK] Backup saved: {filename}  ({size_kb:.1f} KB, "
                f"{len(media_files)} media file(s))"
            )
        )

        self._cleanup_old(backup_dir)

        # Push to a connected cloud destination, if any — single choke point
        # for both the manual "Run Backup Now" button and the scheduled
        # Celery Beat path, since both already funnel through this command.
        try:
            from tracker.tasks import queue_push_backup_to_cloud
            queue_push_backup_to_cloud(filename)
        except Exception:  # noqa: BLE001 — never let this block the backup itself
            pass

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
            # Prune both the current .zip format and legacy .json backups.
            if fn.startswith("scdms_backup_") and (fn.endswith(".zip") or fn.endswith(".json")):
                fp = os.path.join(backup_dir, fn)
                if os.path.getmtime(fp) < cutoff:
                    os.remove(fp)
                    removed += 1

        if removed:
            self.stdout.write(f"  Pruned {removed} backup(s) older than {days} days.")

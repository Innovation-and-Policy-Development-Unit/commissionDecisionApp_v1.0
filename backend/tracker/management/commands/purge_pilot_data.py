"""
Management command: purge_pilot_data

Removes pre-pilot test data — every submission, commission sitting
(meeting) and everything hanging off them — while leaving user accounts,
ministries/departments/units, form types, templates, settings and the audit
log untouched.

Deleting a Submission or Meeting cascades to agenda items, minutes, minute
comments, transcripts, checklists, documents, notes, notifications, flags,
decision services, etc. CommissionTask only SET_NULLs its links, so tasks
are deleted explicitly (their updates, sub-tasks and decision letters
cascade from there).

Safe by default: without --execute this only reports what would be deleted
(the real delete runs inside a transaction that is rolled back). With
--execute a full backup is taken first unless --skip-backup is given.

Usage:
    python manage.py purge_pilot_data                      # dry run
    python manage.py purge_pilot_data --execute
    python manage.py purge_pilot_data --execute --reset-reference-counter --delete-files
"""

import os

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import models, transaction
from django.db.models.deletion import Collector

from ...audit import log_action
from ...models import (
    AuditLog,
    CommissionTask,
    Meeting,
    ReferenceCounter,
    Submission,
)


class _DryRun(Exception):
    """Raised inside the transaction to roll the dry-run delete back."""


class Command(BaseCommand):
    help = "Delete all submissions, meetings and dependent records; keep user accounts."

    def add_arguments(self, parser):
        parser.add_argument("--execute", action="store_true",
                            help="Actually delete. Without this flag nothing is changed.")
        parser.add_argument("--skip-backup", action="store_true",
                            help="Do not run backup_db before deleting.")
        parser.add_argument("--reset-reference-counter", action="store_true",
                            help="Reset PSC-YYYY-nnnnn submission numbering so real submissions start at 00001.")
        parser.add_argument("--delete-files", action="store_true",
                            help="Also remove the uploaded files (documents, minutes scans) from MEDIA_ROOT.")

    def handle(self, *args, **options):
        execute = options["execute"]

        if execute and not options["skip_backup"]:
            self.stdout.write("Taking a backup first...")
            try:
                call_command("backup_db", stdout=self.stdout)
            except Exception as exc:  # noqa: BLE001
                raise CommandError(f"Backup failed, nothing deleted: {exc}")

        # _base_manager so trashed/archived rows go too.
        querysets = [
            CommissionTask._base_manager.all(),
            Submission._base_manager.all(),
            Meeting._base_manager.all(),
        ]

        files = self._collect_files(querysets) if options["delete_files"] else []

        counts = {}
        try:
            with transaction.atomic():
                for qs in querysets:
                    _total, per_model = qs.delete()
                    for label, n in per_model.items():
                        counts[label] = counts.get(label, 0) + n
                if options["reset_reference_counter"]:
                    counts["tracker.ReferenceCounter (reset)"] = ReferenceCounter.objects.update(last_seq=0)
                if not execute:
                    raise _DryRun
        except _DryRun:
            pass

        verb = "Deleted" if execute else "Would delete"
        for label in sorted(counts):
            if counts[label]:
                self.stdout.write(f"  {label}: {counts[label]}")
        self.stdout.write(f"{verb} {sum(counts.values())} row(s) in total.")

        if not execute:
            self.stdout.write(self.style.WARNING("Dry run — nothing changed. Re-run with --execute to delete."))
            if files:
                self.stdout.write(f"{len(files)} file(s) would be removed from MEDIA_ROOT.")
            return

        removed = self._remove_files(files)
        if options["delete_files"]:
            self.stdout.write(f"Removed {removed} file(s) from MEDIA_ROOT.")

        log_action(
            None, AuditLog.Action.DELETE, resource_type="PilotDataPurge",
            resource_label="Submissions and meetings",
            description=f"purge_pilot_data removed {sum(counts.values())} row(s); user accounts kept.",
            extra_data={"counts": counts, "files_removed": removed},
        )
        self.stdout.write(self.style.SUCCESS("Done. User accounts were not touched."))

    def _collect_files(self, querysets):
        """Names of every FileField value that the cascade is about to remove."""
        names = set()
        for qs in querysets:
            collector = Collector(using=qs.db)
            collector.collect(qs)
            # data holds instances; fast_deletes holds querysets for models
            # with no signals/further cascades.
            groups = list(collector.data.items())
            groups += [(fast.model, fast) for fast in collector.fast_deletes
                       if isinstance(fast, models.QuerySet)]
            for model, objs in groups:
                for field in model._meta.concrete_fields:
                    if not isinstance(field, models.FileField):
                        continue
                    for obj in objs:
                        value = getattr(obj, field.name, None)
                        if value and getattr(value, "name", None):
                            names.add(value.name)
        return sorted(names)

    def _remove_files(self, names):
        media_root = os.path.realpath(getattr(settings, "MEDIA_ROOT", "") or "")
        removed = 0
        if not media_root:
            return removed
        for name in names:
            path = os.path.realpath(os.path.join(media_root, name))
            if not path.startswith(media_root + os.sep):
                continue  # never touch anything outside MEDIA_ROOT
            try:
                os.remove(path)
                removed += 1
            except OSError:
                pass
        return removed

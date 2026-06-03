"""Merge duplicate Ministry rows into a single canonical row.

Seeding created parallel Ministry records (migration 0052 uses codes like
``MOET``/``MOF`` while ``seed_tracker`` uses ``MET``/``MFEM``), so submissions
landed on one row while the HR/DG user profiles were attached to the other and
ministry-scoped users saw nothing.

Dry-run by default — pass --apply to perform the merge. The merge logic lives in
``tracker.ministry_dedup`` and is also run at the end of ``seed_tracker``.
"""
from django.core.management.base import BaseCommand

from tracker.ministry_dedup import _plan, merge_duplicate_ministries


class Command(BaseCommand):
    help = "Merge duplicate Ministry rows into one canonical row (dry-run unless --apply)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply", action="store_true",
            help="Perform the merge. Without this flag the command only prints the plan.",
        )

    def handle(self, *args, **opts):
        from tracker.models import Submission, Profile, DeadlineReminderDraft

        plan = _plan()
        if not plan:
            self.stdout.write(self.style.SUCCESS("No duplicate ministries found — nothing to do."))
            return

        for canonical, others in plan:
            self.stdout.write(f"\nKEEP   id={canonical.id} [{canonical.code}] {canonical.name}")
            for o in others:
                s = Submission.objects.filter(ministry=o).count()
                p = Profile.objects.filter(ministry=o).count()
                d = DeadlineReminderDraft.objects.filter(ministry=o).count()
                self.stdout.write(
                    f"  MERGE id={o.id} [{o.code}] {o.name} → move {s} submissions, {p} profiles, {d} drafts; delete row + its departments"
                )

        if not opts["apply"]:
            self.stdout.write(self.style.WARNING("\nDRY RUN — no changes made. Re-run with --apply to perform the merge."))
            return

        deleted = merge_duplicate_ministries(log=self.stdout.write)
        self.stdout.write(self.style.SUCCESS(f"\nMerged and deleted {deleted} duplicate ministry row(s)."))

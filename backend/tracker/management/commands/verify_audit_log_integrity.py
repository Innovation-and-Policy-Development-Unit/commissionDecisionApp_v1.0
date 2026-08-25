"""Walk the AuditLog hash chain (P1-08, SCDMS Pre-Production Readiness Audit
— Findings Register) and report any break: a row whose content was altered
after being written, or a row deleted outright (the next surviving row's
prev_hash won't match). See AuditLog.content_hash's help_text for how the
chain is built and its limits."""
from django.core.management.base import BaseCommand, CommandError

from ...models import AuditLog


class Command(BaseCommand):
    help = "Verify the AuditLog hash chain is unbroken; reports any tampering or deletion."

    def add_arguments(self, parser):
        parser.add_argument(
            "--quiet", action="store_true",
            help="Only print output if a break is found.",
        )

    def handle(self, *args, **options):
        quiet = options["quiet"]
        prev_hash = ""
        total = 0
        breaks = []

        first = True
        for entry in AuditLog.objects.order_by("id").iterator():
            total += 1
            # A legitimately-purged chain start (see purge_expired_data.py):
            # its prev_hash was deliberately overwritten with the marker
            # (it used to point at a row that's since been deleted), so its
            # own content_hash can no longer be recomputed/verified against
            # that original value either — skip both checks for just this
            # row and resume normal verification from the row after it.
            is_truncation_point = first and entry.prev_hash == AuditLog.CHAIN_TRUNCATION_MARKER
            if not is_truncation_point:
                if entry.prev_hash != prev_hash:
                    breaks.append((entry.id, "prev_hash does not match the preceding row's "
                                              "content_hash — a row before this one was likely "
                                              "altered or deleted"))
                elif entry.content_hash != entry.compute_content_hash():
                    breaks.append((entry.id, "content_hash does not match this row's own "
                                              "content — this row was altered after being written"))
            prev_hash = entry.content_hash
            first = False

        if breaks:
            self.stdout.write(self.style.ERROR(
                f"AUDIT LOG INTEGRITY FAILURE: {len(breaks)} break(s) found across {total} rows:"
            ))
            for entry_id, reason in breaks:
                self.stdout.write(self.style.ERROR(f"  AuditLog #{entry_id}: {reason}"))
            raise CommandError(f"{len(breaks)} broken link(s) in the audit log hash chain.")

        if not quiet:
            self.stdout.write(self.style.SUCCESS(f"Verified {total} row(s) — chain intact."))

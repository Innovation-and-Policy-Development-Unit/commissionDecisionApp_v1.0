"""Walk the AuditLog hash chain (P1-08, SCDMS Pre-Production Readiness Audit
— Findings Register) and report any break: a row whose content was altered
after being written, or a row deleted outright (the next surviving row's
prev_hash won't match). See AuditLog.content_hash's help_text for how the
chain is built and its limits."""
from django.core.management.base import BaseCommand, CommandError

from ...audit_integrity import verify_audit_chain


class Command(BaseCommand):
    help = "Verify the AuditLog hash chain is unbroken; reports any tampering or deletion."

    def add_arguments(self, parser):
        parser.add_argument(
            "--quiet", action="store_true",
            help="Only print output if a break is found.",
        )

    def handle(self, *args, **options):
        quiet = options["quiet"]
        total, breaks = verify_audit_chain()

        if breaks:
            self.stdout.write(self.style.ERROR(
                f"AUDIT LOG INTEGRITY FAILURE: {len(breaks)} break(s) found across {total} rows:"
            ))
            for entry_id, reason in breaks:
                self.stdout.write(self.style.ERROR(f"  AuditLog #{entry_id}: {reason}"))
            raise CommandError(f"{len(breaks)} broken link(s) in the audit log hash chain.")

        if not quiet:
            self.stdout.write(self.style.SUCCESS(f"Verified {total} row(s) — chain intact."))

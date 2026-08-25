from django.core.management.base import BaseCommand
from django.utils import timezone
from ...audit import log_action
from ...models import AuditLog, PasswordResetToken, SecurityScan


class Command(BaseCommand):
    help = "Purge expired records: password-reset tokens, old audit logs, old scans"

    def add_arguments(self, parser):
        parser.add_argument(
            "--audit-retention-days",
            type=int,
            default=365 * 7,
            help="Delete AuditLog rows older than N days (default 7 years)",
        )
        parser.add_argument(
            "--scan-retention-days",
            type=int,
            default=365,
            help="Delete SecurityScan rows older than N days (default 1 year)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Count records without deleting",
        )

    def handle(self, *args, **options):
        now = timezone.now()
        dry_run = options["dry_run"]
        total = 0

        qs_prt = PasswordResetToken.objects.filter(
            expires_at__lt=now
        ) | PasswordResetToken.objects.filter(used=True)
        count = qs_prt.count()
        if not dry_run:
            qs_prt.delete()
        self.stdout.write(f"Expired/used password-reset tokens: {count} {'(dry-run)' if dry_run else 'deleted'}")
        total += count

        cutoff = now - timezone.timedelta(days=options["audit_retention_days"])
        qs_audit = AuditLog.objects.filter(timestamp__lt=cutoff)
        count = qs_audit.count()
        if not dry_run and count:
            # P1-08, SCDMS Pre-Production Readiness Audit — Findings
            # Register: deleting the oldest rows breaks the hash chain for
            # whatever becomes the new oldest surviving row, since its
            # prev_hash points at a row that's about to stop existing. Mark
            # that row so verify_audit_log_integrity can tell "legitimately
            # truncated by an audited retention purge" apart from real
            # tampering, rather than either silently accepting any dangling
            # prev_hash (defeats the point) or flagging every scheduled
            # purge as a false-positive break.
            first_surviving = (
                AuditLog.objects.exclude(id__in=qs_audit.values("id"))
                .order_by("id").first()
            )
            if first_surviving:
                AuditLog.objects.filter(id=first_surviving.id).update(
                    prev_hash=AuditLog.CHAIN_TRUNCATION_MARKER
                )
            qs_audit.delete()
            log_action(
                None, AuditLog.Action.DELETE, resource_type="RetentionPurge",
                resource_label="AuditLog",
                description=f"Retention purge deleted {count} audit log row(s) older than "
                             f"{options['audit_retention_days']} days.",
                extra_data={"deleted_count": count, "retention_days": options["audit_retention_days"]},
            )
        self.stdout.write(f"Audit logs older than {options['audit_retention_days']}d: {count} {'(dry-run)' if dry_run else 'deleted'}")
        total += count

        cutoff_scans = now - timezone.timedelta(days=options["scan_retention_days"])
        qs_scans = SecurityScan.objects.filter(started_at__lt=cutoff_scans)
        count = qs_scans.count()
        if not dry_run:
            qs_scans.delete()
        self.stdout.write(f"Security scans older than {options['scan_retention_days']}d: {count} {'(dry-run)' if dry_run else 'deleted'}")
        total += count

        self.stdout.write(self.style.SUCCESS(f"Total records purged: {total}"))

from django.core.management.base import BaseCommand
from django.utils import timezone
from ...models import OTPToken, PasswordResetToken, AuditLog, SecurityScan


class Command(BaseCommand):
    help = "Purge expired records: OTP tokens, password-reset tokens, old audit logs, old scans"

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

        qs_otp = OTPToken.objects.filter(expires_at__lt=now)
        count = qs_otp.count()
        if not dry_run:
            qs_otp.delete()
        self.stdout.write(f"Expired OTP tokens: {count} {'(dry-run)' if dry_run else 'deleted'}")
        total += count

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
        if not dry_run:
            qs_audit.delete()
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

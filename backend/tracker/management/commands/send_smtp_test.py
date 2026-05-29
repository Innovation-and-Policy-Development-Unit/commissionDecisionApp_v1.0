"""Send a one-off test email via SMTP. Usage: python manage.py send_smtp_test recipient@example.com"""

from django.core.management.base import BaseCommand, CommandError

from tracker.email_backend import format_smtp_error, resolve_smtp_config, send_smtp_message, smtp_config_diagnostics


class Command(BaseCommand):
    help = "Send a test email through SMTP (configure SMTP_* in .env or Admin)."

    def add_arguments(self, parser):
        parser.add_argument("recipient", help="Email address to receive the test message")

    def handle(self, *args, **options):
        to = (options["recipient"] or "").strip()
        if not to or "@" not in to:
            raise CommandError("Provide a valid recipient email address.")

        cfg = resolve_smtp_config()
        diag = smtp_config_diagnostics()
        if not cfg.get("password"):
            raise CommandError(
                "SMTP password not configured. Set SMTP_* in .env or Admin → System Config."
            )

        from django.conf import settings

        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or cfg.get("username") or "noreply@localhost"
        subject = "SCDMS — SMTP test"
        body = (
            "This is a test message from the Commission Decision App.\n\n"
            f"SMTP host: {cfg.get('host')}:{cfg.get('port')}\n"
            f"Config source: {diag.get('source')}\n"
        )

        try:
            send_smtp_message(
                cfg=cfg,
                from_email=from_email,
                recipients=[to],
                subject=subject,
                body=body,
            )
        except Exception as exc:
            raise CommandError(format_smtp_error(exc)) from exc

        self.stdout.write(self.style.SUCCESS(f"Test email sent to {to} via {cfg.get('host')}"))

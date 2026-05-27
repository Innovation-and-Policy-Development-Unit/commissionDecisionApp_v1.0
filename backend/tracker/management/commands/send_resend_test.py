"""Send a one-off test email via Resend. Usage: python manage.py send_resend_test magsrvcs@gmail.com"""

from django.core.management.base import BaseCommand, CommandError
from django.core.mail import send_mail

from tracker.email_templates import get_from_email
from tracker.resend_backend import format_resend_error, uses_resend


class Command(BaseCommand):
    help = "Send a test email through Resend (requires RESEND_API_KEY in environment)."

    def add_arguments(self, parser):
        parser.add_argument("to", help="Recipient email address")

    def handle(self, *args, **options):
        if not uses_resend():
            raise CommandError("Set RESEND_API_KEY in the environment first.")

        to = options["to"].strip()
        from_email = get_from_email()
        try:
            send_mail(
                "Commission Decision App — Resend test",
                "Congrats on sending your first email via Resend from SCDMS.",
                from_email,
                [to],
                fail_silently=False,
                html_message=(
                    "<p>Congrats on sending your <strong>first email</strong> "
                    "via Resend from the Commission Decision App.</p>"
                ),
            )
        except Exception as exc:
            raise CommandError(format_resend_error(exc)) from exc

        self.stdout.write(self.style.SUCCESS(f"Sent test email to {to} (from {from_email})"))

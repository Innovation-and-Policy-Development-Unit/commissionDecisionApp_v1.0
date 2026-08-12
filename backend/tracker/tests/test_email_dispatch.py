"""dispatch_pending_emails() — flushing queued Notification rows to email.

Previously sent plain-text-only (django.core.mail.send_mail, no HTML part),
which showed as "Empty" in transactional-email dashboards that preview the
HTML part (e.g. Resend) even though the plain-text body was real. Now sends
via EmailMultiAlternatives with a branded HTML alternative too."""

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase

from ..email_dispatch import dispatch_pending_emails
from ..models import Notification


class DispatchPendingEmailsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "notify_user", password="x", email="notify@example.test",
        )

    def test_sends_html_alternative_alongside_plain_text(self):
        Notification.objects.create(
            recipient=self.user,
            channel=Notification.Channel.BOTH,
            title="New submission: PSC-2026-TEST",
            body="Widget Ministry Business Plan has been submitted and needs your checklist review.",
            link="/submissions/999",
        )
        stats = dispatch_pending_emails()
        self.assertEqual(stats["sent"], 1)
        self.assertEqual(len(mail.outbox), 1)

        sent = mail.outbox[0]
        self.assertIn("needs your checklist review", sent.body)
        self.assertIn("Open in SCDMS", sent.body)
        self.assertEqual(len(sent.alternatives), 1)
        html_body, mimetype = sent.alternatives[0]
        self.assertEqual(mimetype, "text/html")
        self.assertIn("needs your checklist review", html_body)
        self.assertTrue(html_body.strip())

    def test_marks_notification_emailed_after_send(self):
        notif = Notification.objects.create(
            recipient=self.user,
            channel=Notification.Channel.EMAIL,
            title="Reminder",
            body="Something needs your attention.",
        )
        dispatch_pending_emails()
        notif.refresh_from_db()
        self.assertTrue(notif.emailed)

    def test_skips_in_app_only_notifications(self):
        Notification.objects.create(
            recipient=self.user,
            channel=Notification.Channel.IN_APP,
            title="In-app only",
            body="Should not be emailed.",
        )
        stats = dispatch_pending_emails()
        self.assertEqual(stats["sent"], 0)
        self.assertEqual(len(mail.outbox), 0)

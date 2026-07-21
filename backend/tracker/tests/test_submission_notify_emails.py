from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..email_notify import notify_external_submission_confirmation
from ..models import FormCategory, Ministry, Profile, Role, Submission, WorkflowStage
from ..serializers import SubmissionWriteSerializer, assert_notify_emails_match_ministry


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=['*'])
class NotifyEmailsValidationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("hrofficer", password="test1234")
        self.ministry = Ministry.objects.create(code="TESTVAL", name="Ministry of Finance")
        self.form_cat = FormCategory.objects.create(code="psc_3_6_v", name="PSC 3.6")
        # A verified account for this ministry so its domain ("example.com") can
        # be inferred — without at least one, notify_emails validation fails closed.
        hr_user = User.objects.create_user("mofhr", email="hr@example.com")
        Profile.objects.create(user=hr_user, role=Role.MINISTRY_HR, ministry=self.ministry)

    def _base_payload(self, **extra):
        payload = {
            "title": "Test submission",
            "form_category": self.form_cat.id,
            "ministry": self.ministry.id,
            "received_at": timezone.now().isoformat(),
        }
        payload.update(extra)
        return payload

    def _serializer(self, payload):
        class FakeRequest:
            user = self.user
        return SubmissionWriteSerializer(data=payload, context={"request": FakeRequest()})

    def test_valid_list_accepted_and_deduped(self):
        serializer = self._serializer(self._base_payload(
            notify_emails=["Jane@Example.com", "bob@example.com", "jane@example.com"]
        ))
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(
            sorted(serializer.validated_data["notify_emails"]),
            ["bob@example.com", "jane@example.com"],
        )

    def test_invalid_email_rejected(self):
        serializer = self._serializer(self._base_payload(notify_emails=["not-an-email"]))
        self.assertFalse(serializer.is_valid())
        self.assertIn("notify_emails", serializer.errors)

    def test_over_cap_list_rejected(self):
        emails = [f"person{i}@example.com" for i in range(9)]
        serializer = self._serializer(self._base_payload(notify_emails=emails))
        self.assertFalse(serializer.is_valid())
        self.assertIn("notify_emails", serializer.errors)

    def test_blank_entries_ignored(self):
        serializer = self._serializer(self._base_payload(notify_emails=["", "  ", "bob@example.com"]))
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["notify_emails"], ["bob@example.com"])

    def test_cross_domain_address_rejected(self):
        serializer = self._serializer(self._base_payload(notify_emails=["someone@othergov.vu"]))
        self.assertFalse(serializer.is_valid())
        self.assertIn("notify_emails", serializer.errors)

    def test_fails_closed_when_ministry_has_no_verified_accounts(self):
        empty_ministry = Ministry.objects.create(code="TESTEMPTY", name="Ministry With No Accounts")
        with self.assertRaises(ValidationError):
            assert_notify_emails_match_ministry(empty_ministry.id, ["anyone@example.com"])


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=['*'])
class ExternalConfirmationEmailTests(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="TESTCONF", name="Ministry of Education")
        self.form_cat = FormCategory.objects.create(code="psc_3_6_c", name="PSC 3.6")
        self.creator = User.objects.create_user("creator", password="test1234")

    def _make_submission(self, **extra):
        return Submission.objects.create(
            title="Appointment matter",
            form_category=self.form_cat, form_type_code="PSC 3.6",
            ministry=self.ministry, received_at=timezone.now(),
            created_by=self.creator, current_stage=WorkflowStage.SUBMITTED,
            **extra,
        )

    def test_sends_one_email_per_deduplicated_address(self):
        dg = User.objects.create_user("dguser", email="dg@ministry.gov.vu")
        hr = User.objects.create_user("hruser", email="hr@ministry.gov.vu")
        sub = self._make_submission(notify_emails=["extra@example.com", "DG@Ministry.gov.vu"])

        notify_external_submission_confirmation(sub, [dg, hr])

        recipients = sorted(m.to[0] for m in mail.outbox)
        self.assertEqual(recipients, ["dg@ministry.gov.vu", "extra@example.com", "hr@ministry.gov.vu"])
        for m in mail.outbox:
            self.assertIn(sub.reference_number, m.body)
            self.assertIn(f"/track?ref={sub.reference_number}", m.body)

    def test_no_recipients_does_not_crash(self):
        sub = self._make_submission()
        notify_external_submission_confirmation(sub, [])
        self.assertEqual(len(mail.outbox), 0)

    def test_user_with_blank_email_skipped(self):
        no_email_user = User.objects.create_user("noemail")
        sub = self._make_submission()
        notify_external_submission_confirmation(sub, [no_email_user])
        self.assertEqual(len(mail.outbox), 0)

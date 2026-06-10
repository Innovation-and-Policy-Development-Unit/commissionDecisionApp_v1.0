"""Tests for formal decision service + ministry acknowledgement."""

from datetime import timedelta
from unittest import skipUnless

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    DecisionService,
    FormCategory,
    Ministry,
    Notification,
    Profile,
    Role,
    Submission,
    WorkflowStage,
)

try:
    import weasyprint  # noqa: F401
    HAS_WEASYPRINT = True
except Exception:
    HAS_WEASYPRINT = False


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class DecisionServiceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ministry = Ministry.objects.create(code="TST-D", name="Test Ministry D")
        self.other_ministry = Ministry.objects.create(code="TST-E", name="Test Ministry E")
        self.form_cat = FormCategory.objects.get_or_create(
            code="psc_3_6", defaults={"name": "PSC 3.6"}
        )[0]

        self.secretary = User.objects.create_user("secretary", password="x")
        Profile.objects.create(user=self.secretary, role=Role.PSC_SECRETARY)
        self.hr = User.objects.create_user("hruser", password="x")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.dg = User.objects.create_user("dguser", password="x")
        Profile.objects.create(user=self.dg, role=Role.HEAD_OF_AGENCY, ministry=self.ministry)

        self.submission = Submission.objects.create(
            title="Appointment of Director",
            form_category=self.form_cat,
            form_type_code="PSC 3.6",
            ministry=self.ministry,
            received_at=timezone.now(),
            created_by=self.hr,
            current_stage=WorkflowStage.APPROVED,
            ai_letter_subject="Decision on appointment",
            ai_letter_content="The Commission approved the appointment.",
        )

    def _serve(self, body="The Commission approved the appointment.", subject="Decision"):
        self.client.force_authenticate(user=self.secretary)
        return self.client.post(
            f"/api/submissions/{self.submission.id}/serve-decision/",
            {"letter_subject": subject, "letter_body": body},
            format="json",
        )

    # ── Serving ──────────────────────────────────────────────────────────────

    @skipUnless(HAS_WEASYPRINT, "WeasyPrint not available")
    def test_serve_creates_immutable_snapshot_and_notifies_ministry(self):
        resp = self._serve()
        self.assertEqual(resp.status_code, 201, resp.content)

        service = DecisionService.objects.get(submission=self.submission)
        self.assertEqual(service.decision_outcome, "approved")
        self.assertEqual(service.served_by, self.secretary)
        self.assertEqual(len(service.content_hash), 64)
        self.assertEqual(service.proof_payload["letter_body"], service.letter_body)
        self.assertTrue(service.letter_pdf)
        self.assertIsNone(service.acknowledged_at)

        # HR + DG of the served ministry are notified, nobody else.
        recipients = set(
            Notification.objects.filter(submission=self.submission)
            .values_list("recipient_id", flat=True)
        )
        self.assertEqual(recipients, {self.hr.id, self.dg.id})

    @skipUnless(HAS_WEASYPRINT, "WeasyPrint not available")
    def test_reserve_supersedes_unacknowledged_service(self):
        self._serve()
        first = DecisionService.objects.get()
        resp = self._serve(body="Corrected letter text.")
        self.assertEqual(resp.status_code, 201)

        first.refresh_from_db()
        self.assertTrue(first.superseded)
        active = DecisionService.objects.filter(superseded=False).get()
        self.assertEqual(active.letter_body, "Corrected letter text.")

    def test_serve_requires_secretariat_role(self):
        self.client.force_authenticate(user=self.hr)
        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/serve-decision/",
            {"letter_body": "x"}, format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_serve_requires_post_decision_stage(self):
        Submission.objects.filter(pk=self.submission.pk).update(
            current_stage=WorkflowStage.UNDER_ASSESSMENT
        )
        resp = self._serve()
        self.assertEqual(resp.status_code, 400)

    def test_serve_requires_letter_text(self):
        Submission.objects.filter(pk=self.submission.pk).update(ai_letter_content="")
        self.client.force_authenticate(user=self.secretary)
        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/serve-decision/", {}, format="json",
        )
        self.assertEqual(resp.status_code, 400)

    @skipUnless(HAS_WEASYPRINT, "WeasyPrint not available")
    def test_serve_falls_back_to_f3_letter(self):
        self.client.force_authenticate(user=self.secretary)
        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/serve-decision/", {}, format="json",
        )
        self.assertEqual(resp.status_code, 201)
        service = DecisionService.objects.get()
        self.assertEqual(service.letter_body, "The Commission approved the appointment.")
        self.assertEqual(service.letter_subject, "Decision on appointment")

    # ── Acknowledgement ──────────────────────────────────────────────────────

    @skipUnless(HAS_WEASYPRINT, "WeasyPrint not available")
    def test_ministry_acknowledges_receipt(self):
        self._serve()
        self.client.force_authenticate(user=self.hr)
        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/acknowledge-decision/",
            {"note": "Received and forwarded to the DG."},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)

        service = DecisionService.objects.get()
        self.assertEqual(service.acknowledged_by, self.hr)
        self.assertIsNotNone(service.acknowledged_at)
        self.assertEqual(service.acknowledgement_note, "Received and forwarded to the DG.")

        # The serving secretary is notified of the acknowledgement.
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.secretary,
                title__icontains="acknowledged",
            ).exists()
        )

        # A second acknowledgement attempt has nothing to acknowledge.
        resp2 = self.client.post(
            f"/api/submissions/{self.submission.id}/acknowledge-decision/", {}, format="json",
        )
        self.assertEqual(resp2.status_code, 400)

    @skipUnless(HAS_WEASYPRINT, "WeasyPrint not available")
    def test_acknowledge_denied_for_secretariat_and_other_ministry(self):
        self._serve()

        self.client.force_authenticate(user=self.secretary)
        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/acknowledge-decision/", {}, format="json",
        )
        self.assertEqual(resp.status_code, 403)

        other_hr = User.objects.create_user("otherhr", password="x")
        Profile.objects.create(user=other_hr, role=Role.MINISTRY_HR, ministry=self.other_ministry)
        self.client.force_authenticate(user=other_hr)
        resp = self.client.post(
            f"/api/submissions/{self.submission.id}/acknowledge-decision/", {}, format="json",
        )
        self.assertIn(resp.status_code, (403, 404))

    @skipUnless(HAS_WEASYPRINT, "WeasyPrint not available")
    def test_letter_download(self):
        self._serve()
        service = DecisionService.objects.get()
        self.client.force_authenticate(user=self.hr)
        resp = self.client.get(
            f"/api/submissions/{self.submission.id}/decision-service/{service.id}/letter/"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "application/pdf")

    # ── Reminder task ────────────────────────────────────────────────────────

    @skipUnless(HAS_WEASYPRINT, "WeasyPrint not available")
    def test_reminder_task_nags_after_interval_and_is_idempotent(self):
        from ..tasks import remind_unacknowledged_decision_services

        self._serve()
        DecisionService.objects.update(served_at=timezone.now() - timedelta(days=10))
        Notification.objects.all().delete()

        processed = remind_unacknowledged_decision_services()
        self.assertEqual(processed, 1)
        service = DecisionService.objects.get()
        self.assertEqual(service.reminder_count, 1)
        self.assertEqual(
            set(Notification.objects.values_list("recipient_id", flat=True)),
            {self.hr.id, self.dg.id},
        )

        # Immediately re-running does nothing (interval not elapsed again).
        self.assertEqual(remind_unacknowledged_decision_services(), 0)

        # Acknowledged services are never nagged.
        service.acknowledged_at = timezone.now()
        service.save(update_fields=["acknowledged_at"])
        DecisionService.objects.update(last_reminder_at=timezone.now() - timedelta(days=10))
        self.assertEqual(remind_unacknowledged_decision_services(), 0)

"""No Commission decision reaches a ministry before its letter does."""
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from tracker import decision_disclosure as dd
from tracker.models import (
    DecisionService, Ministry, Notification, Profile, Role, Submission, WorkflowStage,
)


@override_settings(SECURE_SSL_REDIRECT=False, ALLOWED_HOSTS=["*"])
class _Base(TestCase):
    def setUp(self):
        self.ministry = Ministry.objects.create(code="ZZ_DD", name="Disclosure Ministry")
        self.hr = User.objects.create_user("dd_hr", password="x", email="dd.hr@example.org")
        Profile.objects.create(user=self.hr, role=Role.MINISTRY_HR, ministry=self.ministry)
        self.officer = User.objects.create_user("dd_officer", password="x")
        Profile.objects.create(user=self.officer, role=Role.PSC_OFFICER)
        self.sub = Submission.objects.create(
            title="A decided paper", ministry=self.ministry, form_type_code="DD-TEST",
            current_stage=WorkflowStage.APPROVED, received_at=timezone.now(),
            created_by=self.hr,
        )

    def api(self, user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    def serve(self, superseded=False):
        return DecisionService.objects.create(
            submission=self.sub, ministry=self.ministry,
            decision_outcome=WorkflowStage.APPROVED, letter_subject="Decision",
            letter_body="The Commission approved the matter.", served_by=self.officer,
            superseded=superseded,
        )


class VisibilityTests(_Base):
    def test_outcome_is_hidden_until_served(self):
        self.assertFalse(dd.decision_visible_to_ministry(self.sub))

    def test_serving_the_letter_reveals_it(self):
        self.serve()
        self.assertTrue(dd.decision_visible_to_ministry(self.sub))

    def test_a_superseded_service_does_not_count(self):
        self.serve(superseded=True)
        self.assertFalse(dd.decision_visible_to_ministry(self.sub))

    def test_non_decision_stages_are_not_hidden(self):
        self.sub.current_stage = WorkflowStage.UNDER_ASSESSMENT
        self.assertTrue(dd.decision_visible_to_ministry(self.sub))

    def test_deferral_waits_for_its_letter_too(self):
        self.sub.current_stage = WorkflowStage.DEFERRED_BACK_TO_HR
        self.assertFalse(dd.decision_visible_to_ministry(self.sub))

    def test_opsc_staff_always_see_it(self):
        self.assertFalse(dd.hide_from(self.sub, self.officer))

    def test_ministry_staff_do_not(self):
        self.assertTrue(dd.hide_from(self.sub, self.hr))


class ApiMaskingTests(_Base):
    def test_ministry_detail_does_not_carry_the_outcome(self):
        data = self.api(self.hr).get(f"/api/submissions/{self.sub.id}/").json()
        self.assertEqual(data["current_stage"], "forwarded_to_commission")
        self.assertNotIn("approved", str(data["current_stage"]))

    def test_opsc_detail_still_carries_it(self):
        data = self.api(self.officer).get(f"/api/submissions/{self.sub.id}/").json()
        self.assertEqual(data["current_stage"], WorkflowStage.APPROVED)

    def test_ministry_sees_the_outcome_once_served(self):
        self.serve()
        data = self.api(self.hr).get(f"/api/submissions/{self.sub.id}/").json()
        self.assertEqual(data["current_stage"], WorkflowStage.APPROVED)

    def test_decision_events_are_withheld(self):
        from tracker.models import WorkflowEvent

        WorkflowEvent.objects.create(
            submission=self.sub, previous_stage=WorkflowStage.COMMISSION_SITTING,
            new_stage=WorkflowStage.APPROVED, remarks="Approved by the Commission",
        )
        data = self.api(self.hr).get(f"/api/submissions/{self.sub.id}/").json()
        stages = [e.get("new_stage") for e in data.get("events", [])]
        self.assertNotIn(WorkflowStage.APPROVED, stages)


class ServiceNoticeTests(_Base):
    def test_serving_tells_the_ministry(self):
        before = Notification.objects.filter(recipient=self.hr).count()
        self.serve()
        # The notification is raised by the serve endpoint, not the model, so this
        # asserts the helper picks the right people rather than the endpoint's wiring.
        self.assertIn(self.hr, list(dd.served_notice_recipients(self.sub)))
        self.assertEqual(Notification.objects.filter(recipient=self.hr).count(), before)

    def test_opsc_staff_are_not_on_the_ministry_notice(self):
        self.assertNotIn(self.officer, list(dd.served_notice_recipients(self.sub)))


class PublicTrackingTests(_Base):
    """The applicant holding a tracking code learns a decision was issued, not what it was.

    The HTTP-level tests in test_public_tracking do not run in this sandbox, so these
    go at the labelling directly.
    """

    def label(self):
        from tracker.public_tracking_views import STAGE_INFO, _public_stage_label

        return _public_stage_label(self.sub, STAGE_INFO[self.sub.current_stage])

    def test_outcome_is_withheld_before_service(self):
        self.assertEqual(self.label(), dd.PUBLIC_PENDING_LABEL)

    def test_outcome_is_shown_once_served(self):
        self.serve()
        self.assertEqual(self.label(), "Approved")

    def test_a_refusal_is_withheld_the_same_way(self):
        self.sub.current_stage = WorkflowStage.NOT_APPROVED
        self.assertEqual(self.label(), dd.PUBLIC_PENDING_LABEL)

    def test_history_hides_the_outcome_before_service(self):
        from tracker.models import SubmissionStageEvent
        from tracker.public_tracking_views import _stage_history

        SubmissionStageEvent.objects.create(
            submission=self.sub, stage=WorkflowStage.APPROVED, occurred_at=timezone.now(),
        )
        labels = [h["stage_label"] for h in _stage_history(self.sub)]
        self.assertIn(dd.PUBLIC_PENDING_LABEL, labels)
        self.assertNotIn("Approved", labels)


class UnservedChaseTests(_Base):
    """A decision nobody serves must not leave the ministry in silence unnoticed."""

    def setUp(self):
        super().setUp()
        self.manager = User.objects.create_user("dd_mgr", password="x")
        Profile.objects.create(user=self.manager, role=Role.HR_UNIT_MANAGER)
        self.sub.routed_unit = "hr"
        self.sub.save(update_fields=["routed_unit"])

    def decide(self, days_ago):
        from datetime import timedelta

        from tracker.models import WorkflowEvent

        event = WorkflowEvent.objects.create(
            submission=self.sub, previous_stage=WorkflowStage.COMMISSION_SITTING,
            new_stage=WorkflowStage.APPROVED, remarks="Approved",
        )
        WorkflowEvent.objects.filter(pk=event.pk).update(
            created_at=timezone.now() - timedelta(days=days_ago),
        )

    def sweep(self):
        from tracker.tasks import remind_unserved_decisions

        return remind_unserved_decisions()

    def test_a_fresh_decision_is_not_chased_yet(self):
        self.decide(days_ago=0)
        self.assertEqual(self.sweep(), 0)

    def test_an_old_unserved_decision_is_chased(self):
        self.decide(days_ago=7)
        self.assertEqual(self.sweep(), 1)
        self.assertTrue(Notification.objects.filter(recipient=self.manager).exists())

    def test_the_same_decision_is_not_chased_twice(self):
        self.decide(days_ago=7)
        self.assertEqual(self.sweep(), 1)
        self.assertEqual(self.sweep(), 0)

    def test_a_served_decision_is_never_chased(self):
        self.decide(days_ago=7)
        self.serve()
        self.assertEqual(self.sweep(), 0)

    def test_the_ministry_is_not_told_by_the_chase(self):
        self.decide(days_ago=7)
        self.sweep()
        self.assertFalse(Notification.objects.filter(recipient=self.hr).exists())

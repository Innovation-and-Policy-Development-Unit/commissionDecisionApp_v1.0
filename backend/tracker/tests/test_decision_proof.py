"""Decision proof hashing and verification."""

from django.contrib.auth.models import User
from django.test import TestCase

from tracker.decision_proof import (
    build_decision_proof_payload,
    create_decision_proof,
    hash_proof_payload,
    verify_stored_proof,
)
from tracker.models import Profile, Role, Submission, WorkflowEvent, WorkflowStage


class DecisionProofTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="sec1", password="pass")
        Profile.objects.create(user=self.user, role=Role.PSC_SECRETARY)
        from django.utils import timezone

        self.submission = Submission.objects.create(
            title="Test matter",
            current_stage=WorkflowStage.COMMISSION_SITTING,
            received_at=timezone.now(),
            created_by=self.user,
        )

    def test_hash_stable_for_same_payload(self):
        payload = build_decision_proof_payload(
            submission=self.submission,
            previous_stage=WorkflowStage.COMMISSION_SITTING,
            new_stage=WorkflowStage.APPROVED,
            actor=self.user,
            remarks="Approved as recommended",
        )
        h1 = hash_proof_payload(payload)
        h2 = hash_proof_payload(payload)
        self.assertEqual(h1, h2)
        self.assertEqual(len(h1), 64)

    def test_create_and_verify_proof(self):
        content_hash, payload = create_decision_proof(
            submission=self.submission,
            previous_stage=WorkflowStage.COMMISSION_SITTING,
            new_stage=WorkflowStage.APPROVED,
            actor=self.user,
        )
        result = verify_stored_proof(content_hash, payload)
        self.assertTrue(result["verified"])
        self.assertEqual(result["status"], "valid")

    def test_workflow_event_stores_proof_fields(self):
        content_hash, payload = create_decision_proof(
            submission=self.submission,
            previous_stage=WorkflowStage.COMMISSION_SITTING,
            new_stage=WorkflowStage.REJECTED,
            actor=self.user,
        )
        ev = WorkflowEvent.objects.create(
            submission=self.submission,
            actor=self.user,
            previous_stage=WorkflowStage.COMMISSION_SITTING,
            new_stage=WorkflowStage.REJECTED,
            content_hash=content_hash,
            proof_payload=payload,
        )
        self.assertTrue(ev.content_hash)
        self.assertEqual(verify_stored_proof(ev.content_hash, ev.proof_payload)["status"], "valid")

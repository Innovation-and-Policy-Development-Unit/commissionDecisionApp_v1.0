"""
Django signal handlers for the tracker app.

Currently wires FeedbackComment post-save to the AI analysis pipeline.
"""

import logging

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

log = logging.getLogger("scdms.security")


@receiver(post_save, sender="tracker.FeedbackComment")
def feedback_comment_post_save(sender, instance, created, **kwargs):
    """Trigger AI analysis on newly created feedback comments."""
    if not created:
        return

    if instance.ai_processed:
        return

    from .tasks import process_feedback_with_ai

    transaction.on_commit(lambda: process_feedback_with_ai.delay(instance.id))


@receiver(post_save, sender="tracker.ComplianceCase")
def compliance_case_post_save(sender, instance, created, **kwargs):
    """Materialise the statutory stage timeline when a compliance case is created."""
    if not created:
        return
    from .compliance_workflows import materialize_stages

    try:
        materialize_stages(instance)
    except Exception as exc:  # noqa: BLE001
        log.error("Could not materialise compliance stages for case %s: %s", instance.pk, exc)


# ── Act engine event triggers ─────────────────────────────────────────────────
# Each save dispatches created/updated automations for the entity. Wrapped so a
# missing table during migrations, or any automation error, never breaks a save.
# Tag/shift actions use queryset.update() (no signal) so there's no recursion.

def _dispatch_automation(entity, instance, created):
    # Savepoint: if the Automation table is absent (early migrations) or an
    # automation errors, the rollback is contained and never poisons the outer
    # transaction (or the request).
    try:
        with transaction.atomic():
            from .automation.engine import run_event
            run_event(entity, instance, "created" if created else "updated")
    except Exception:  # noqa: BLE001
        pass


@receiver(post_save, sender="tracker.Submission")
def submission_automation(sender, instance, created, raw=False, **kwargs):
    if not raw:
        _dispatch_automation("submission", instance, created)


@receiver(post_save, sender="tracker.CommissionTask")
def commission_task_automation(sender, instance, created, raw=False, **kwargs):
    if not raw:
        _dispatch_automation("commission_task", instance, created)


@receiver(post_save, sender="tracker.Meeting")
def meeting_automation(sender, instance, created, raw=False, **kwargs):
    if not raw:
        _dispatch_automation("meeting", instance, created)

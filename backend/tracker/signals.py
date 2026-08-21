"""
Django signal handlers for the tracker app.

Currently wires FeedbackComment post-save to the AI analysis pipeline.
"""

import logging

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

log = logging.getLogger("scdms.security")


@receiver(post_save, sender="tracker.Notification")
def notification_post_save(sender, instance, created, **kwargs):
    """Deliver a web-push for newly created important notifications."""
    if not created or not instance.push:
        return
    from .tasks import send_web_push_notification

    transaction.on_commit(lambda: send_web_push_notification.delay(instance.id))


@receiver(post_save, sender="tracker.FeedbackComment")
def feedback_comment_post_save(sender, instance, created, **kwargs):
    """Trigger AI analysis on newly created feedback comments."""
    if not created:
        return

    if instance.ai_processed:
        return

    from .tasks import process_feedback_with_ai

    transaction.on_commit(lambda: process_feedback_with_ai.delay(instance.id))


# ── Act engine event triggers ─────────────────────────────────────────────────
# Each save dispatches created/updated automations for the entity. Wrapped so a
# missing table during migrations, or any automation error, never breaks a save.
# Tag/shift actions use queryset.update() (no signal) so there's no recursion.

def _dispatch_automation(entity, instance, created):
    # Deferred to transaction.on_commit() + Celery so the automation engine's
    # outbound notify/escalate/remind email sends never run inline inside the
    # caller's open transaction (they used to hold row locks for the duration
    # of the SMTP call — see P0-04, SCDMS Pre-Production Readiness Audit).
    from .tasks import queue_automation_event

    trigger = "created" if created else "updated"
    transaction.on_commit(lambda: queue_automation_event(entity, instance.pk, trigger))


@receiver(post_save, sender="tracker.Submission")
def submission_automation(sender, instance, created, raw=False, **kwargs):
    if not raw:
        _dispatch_automation("submission", instance, created)


@receiver(post_save, sender="tracker.Submission")
def stamp_implementation_milestones(sender, instance, raw=False, **kwargs):
    """Stamp the implementation-rollup timestamps the first time each
    milestone is reached. Uses queryset.update() so it works regardless of
    the caller's update_fields and never re-triggers signals."""
    if raw:
        return
    from django.utils import timezone
    from .models import ImplementationStatus, Submission, WorkflowStage

    updates = {}
    if (
        instance.current_stage == WorkflowStage.APPROVED
        and instance.commission_approved_at is None
    ):
        updates["commission_approved_at"] = timezone.now()
    if (
        instance.implementation_status == ImplementationStatus.IMPLEMENTED
        and instance.implementation_completed_at is None
    ):
        updates["implementation_completed_at"] = timezone.now()
    if updates:
        Submission.objects.filter(
            pk=instance.pk, **{f"{field}__isnull": True for field in updates}
        ).update(**updates)
        for field, value in updates.items():
            setattr(instance, field, value)


@receiver(post_save, sender="tracker.CommissionTask")
def commission_task_automation(sender, instance, created, raw=False, **kwargs):
    if not raw:
        _dispatch_automation("commission_task", instance, created)


@receiver(post_save, sender="tracker.Meeting")
def meeting_automation(sender, instance, created, raw=False, **kwargs):
    if not raw:
        _dispatch_automation("meeting", instance, created)


@receiver(post_save, sender="tracker.Meeting")
def meeting_carryover_reconcile(sender, instance, raw=False, **kwargs):
    """When a sitting is completed, roll its unplaced carry-over items to the next."""
    if raw or instance.status != "completed":
        return
    try:
        with transaction.atomic():
            from .agenda_carryover import reconcile_carryover
            reconcile_carryover(instance)
    except Exception:  # noqa: BLE001
        pass

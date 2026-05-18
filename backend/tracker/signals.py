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

"""Notify CMS to close a case when the linked SCDMS submission is fully complete."""

from __future__ import annotations

import logging

import requests
from django.conf import settings
from django.utils import timezone

from .models import CommissionTaskStatus, ImplementationStatus, Submission, WorkflowStage

logger = logging.getLogger(__name__)

# Stages that end the matter when there are no commission implementation tasks.
_TERMINAL_WITHOUT_TASKS = frozenset({
    WorkflowStage.REJECTED,
    WorkflowStage.IMPLEMENTATION_REPORT,
})


def cms_linked_submission_complete(submission: Submission) -> bool:
    """
    True when a CMS-originated submission has finished in SCDMS.

    - If commission tasks exist: all tasks and subtasks must be completed.
    - If none: REJECTED or IMPLEMENTATION_REPORT, or APPROVED with implementation done.
    """
    cms_case_id = (submission.cms_case_id or "").strip()
    if not cms_case_id:
        return False
    if submission.cms_case_closed_at:
        return False

    tasks = list(submission.commission_tasks.all())
    if tasks:
        for task in tasks:
            if task.status != CommissionTaskStatus.COMPLETED:
                return False
            for subtask in task.subtasks.all():
                if subtask.status != CommissionTaskStatus.COMPLETED:
                    return False
        return True

    stage = submission.current_stage
    if stage in _TERMINAL_WITHOUT_TASKS:
        return True
    if stage == WorkflowStage.APPROVED:
        return submission.implementation_status == ImplementationStatus.IMPLEMENTED
    return False


def maybe_close_cms_case(submission: Submission) -> bool:
    """
    POST close request to CMS if the submission is complete. Idempotent.
    Returns True if CMS was notified successfully.
    """
    if not cms_linked_submission_complete(submission):
        return False

    cms_case_id = submission.cms_case_id.strip()
    cms_url = getattr(settings, "CMS_API_URL", "").rstrip("/")
    secret = getattr(settings, "CMS_CALLBACK_SECRET", "")
    if not cms_url or not secret:
        logger.warning(
            "maybe_close_cms_case: CMS_API_URL or CMS_CALLBACK_SECRET not set — skip close for %s",
            submission.reference_number,
        )
        return False

    endpoint = f"{cms_url}/api/v1/cases/{cms_case_id}/close-from-cdp/"
    payload = {
        "cdp_submission_id": submission.reference_number,
        "current_stage": submission.current_stage,
        "closed_at": timezone.now().isoformat(),
    }
    try:
        resp = requests.post(
            endpoint,
            json=payload,
            headers={"X-CDP-Callback-Key": secret},
            timeout=15,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error(
            "maybe_close_cms_case: CMS close failed for %s (case %s): %s",
            submission.reference_number,
            cms_case_id,
            exc,
        )
        return False

    Submission.objects.filter(pk=submission.pk).update(cms_case_closed_at=timezone.now())
    logger.info(
        "maybe_close_cms_case: notified CMS to close case %s for submission %s",
        cms_case_id,
        submission.reference_number,
    )
    return True

"""Celery tasks for the CDP ↔ CMS integration bridge."""

import logging

import requests
from celery import shared_task
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# Map CDP form_type_code prefixes to CMS case_family values.
# Extend this dict as new compliance form types are introduced.
_FORM_TYPE_TO_CASE_FAMILY = {
    "PSC 5":  "serious_misconduct_employee",
    "PSC 5.1": "serious_misconduct_employee",
    "PSC 5.2": "serious_misconduct_employee",
    "PSC 6":  "grievance",
    "PSC 6.1": "grievance",
    "PSC 7":  "senior_serious_misconduct",
    "PSC 7.1": "senior_serious_misconduct",
    "PSC 8":  "senior_poor_performance",
    "PSC 8.1": "senior_poor_performance",
    "COMP-SMDR": "employee_disciplinary",
    "COMP-PAR": "employee_disciplinary",
    "COMP-PSDB": "employee_disciplinary",
    "COMP-14D": "employee_disciplinary",
    "COMP-OMB": "employee_disciplinary",
    "COMP-PSA": "policy_review",
}

_DEFAULT_CASE_FAMILY = "employee_disciplinary"


def _map_form_type_to_case_family(form_type_code: str) -> str:
    for prefix, family in _FORM_TYPE_TO_CASE_FAMILY.items():
        if form_type_code.startswith(prefix):
            return family
    return _DEFAULT_CASE_FAMILY


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def dispatch_submission_to_cms(self, submission_id: int) -> None:
    """
    POST a compliance submission to the CMS, then record the resulting
    cms_case_id / cms_case_reference back on the Submission row.

    Retries up to 3 times (60-second delay) on network or server errors.
    On permanent failure, sets cms_dispatched_at = None and logs the error.
    """
    from tracker.models import Submission, WorkflowStage

    try:
        sub = Submission.objects.select_related("ministry", "created_by__psc_profile").get(
            pk=submission_id
        )
    except Submission.DoesNotExist:
        logger.error("dispatch_submission_to_cms: Submission %s not found", submission_id)
        return

    if sub.cms_dispatched_at:
        logger.info(
            "dispatch_submission_to_cms: Submission %s already dispatched (%s), skipping",
            sub.reference_number,
            sub.cms_case_reference,
        )
        return

    cdp_base = getattr(settings, "CDP_BASE_URL", "")
    payload = {
        "cdp_submission_id": sub.reference_number,
        "cdp_callback_url": f"{cdp_base}/api/webhooks/cms-signoff/",
        "case_family": _map_form_type_to_case_family(sub.form_type_code),
        "subject_ministry": sub.ministry.name if sub.ministry_id else "",
        "description": sub.title,
        "date_received": (
            sub.received_at.date().isoformat() if sub.received_at else timezone.now().date().isoformat()
        ),
    }

    cms_url = getattr(settings, "CMS_API_URL", "")
    cms_key = getattr(settings, "CMS_API_KEY", "")

    try:
        resp = requests.post(
            f"{cms_url}/api/v1/cases/",
            json=payload,
            headers={"Authorization": f"Bearer {cms_key}"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as exc:
        logger.warning(
            "dispatch_submission_to_cms: request failed for %s: %s",
            sub.reference_number,
            exc,
        )
        raise self.retry(exc=exc)

    Submission.objects.filter(pk=submission_id).update(
        cms_case_id=str(data.get("id", "")),
        cms_case_reference=data.get("reference_number", ""),
        cms_dispatched_at=timezone.now(),
    )
    logger.info(
        "dispatch_submission_to_cms: %s → CMS case %s",
        sub.reference_number,
        data.get("reference_number"),
    )

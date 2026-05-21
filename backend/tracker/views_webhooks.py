"""Webhook endpoints for inbound callbacks from external systems (CMS, etc.)."""

import logging

from django.conf import settings
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .audit import log_action
from .models import AuditLog, Submission, WorkflowEvent, WorkflowStage

logger = logging.getLogger(__name__)


def _verify_cms_callback_key(request) -> bool:
    expected = getattr(settings, "CMS_CALLBACK_SECRET", "")
    if not expected:
        logger.error("CMS_CALLBACK_SECRET not configured — rejecting all CMS callbacks")
        return False
    provided = request.headers.get("X-CMS-Callback-Key", "")
    return provided == expected


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def cms_signoff_callback(request):
    """
    Called by the CMS when the Compliance Manager signs off a case.

    Expected payload:
        cdp_submission_id  – e.g. "PSC-2026-00001"
        outcome            – free-text or code, e.g. "cleared" / "referred_back"
        signoff_by         – name of the compliance manager who signed off
        notes              – optional narrative

    Authentication: shared secret in X-CMS-Callback-Key header.
    """
    if not _verify_cms_callback_key(request):
        logger.warning(
            "cms_signoff_callback: rejected request from %s — invalid or missing key",
            request.META.get("REMOTE_ADDR"),
        )
        return Response({"detail": "Forbidden."}, status=403)

    cdp_ref    = request.data.get("cdp_submission_id", "").strip()
    outcome    = request.data.get("outcome", "").strip()
    signoff_by = request.data.get("signoff_by", "CMS Compliance Manager").strip()
    notes      = request.data.get("notes", "").strip()

    if not cdp_ref:
        return Response({"detail": "cdp_submission_id is required."}, status=400)

    try:
        sub = Submission.objects.get(reference_number=cdp_ref)
    except Submission.DoesNotExist:
        logger.warning("cms_signoff_callback: unknown submission reference %s", cdp_ref)
        return Response({"detail": f"Submission {cdp_ref!r} not found."}, status=404)

    if sub.current_stage != WorkflowStage.COMPLIANCE_UNDER_REVIEW:
        logger.info(
            "cms_signoff_callback: %s is at stage %s, not COMPLIANCE_UNDER_REVIEW — ignoring",
            cdp_ref,
            sub.current_stage,
        )
        return Response({"detail": "Submission is not awaiting CMS sign-off.", "stage": sub.current_stage})

    prev_stage = sub.current_stage
    sub.current_stage      = WorkflowStage.SECRETARY_REVIEW
    sub.cms_signoff_at     = timezone.now()
    sub.cms_signoff_outcome = f"{outcome} — {signoff_by}" if outcome else signoff_by
    sub.save(update_fields=["current_stage", "cms_signoff_at", "cms_signoff_outcome", "updated_at"])

    WorkflowEvent.objects.create(
        submission=sub,
        actor=None,
        actor_label=f"CMS / {signoff_by}",
        previous_stage=prev_stage,
        new_stage=WorkflowStage.SECRETARY_REVIEW,
        remarks=f"CMS compliance sign-off by {signoff_by}. Outcome: {outcome}. {notes}".strip(" ."),
    )

    log_action(
        request,
        AuditLog.Action.UPDATE,
        resource_type="Submission",
        resource_id=sub.id,
        resource_label=sub.reference_number,
        description=f"CMS callback: compliance sign-off by {signoff_by} → Secretary Review",
    )

    logger.info(
        "cms_signoff_callback: %s → SECRETARY_REVIEW (sign-off by %s, outcome: %s)",
        cdp_ref,
        signoff_by,
        outcome,
    )
    return Response({"status": "accepted", "new_stage": WorkflowStage.SECRETARY_REVIEW})

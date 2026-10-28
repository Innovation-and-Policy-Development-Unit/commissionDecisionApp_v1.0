"""
Public pages behind the Director-General's emailed approval link.

The link token is the credential: these views are unauthenticated, throttled per IP,
and answer every unusable link (unknown, used, cancelled, expired, paper no longer
awaiting the DG) with the same 404 so a caller cannot tell them apart. Approving or
returning needs the DG's session PIN as well, so a forwarded or intercepted email
alone cannot approve. Nothing here changes a paper except decide, which does it once.
"""
from __future__ import annotations

import mimetypes

from django.db import transaction
from django.http import FileResponse
from rest_framework import permissions, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.response import Response

from . import dg_approval
from .audit import _get_ip, _get_ua, log_action
from .models import AuditLog, PSCFormType, WorkflowStage
from .throttles import DGApprovalThrottle

MAX_FORM_FIELDS = 60
MAX_VALUE_CHARS = 500


def _protect(response):
    """The page and its API replies must never be cached, indexed, or leaked in a Referer."""
    response["Cache-Control"] = "no-store"
    response["Referrer-Policy"] = "no-referrer"
    response["X-Robots-Tag"] = "noindex, nofollow"
    return response


def _not_found():
    return _protect(Response({"detail": "This link is not valid any more."}, status=status.HTTP_404_NOT_FOUND))


def _form_fields(submission):
    """The digitized form's answers as a flat label/value list for the DG to read."""
    try:
        data = submission.dynamic_form_response.data
    except Exception:
        return []
    if not isinstance(data, dict):
        return []
    rows = []
    for key, value in data.items():
        if value in (None, "", [], {}):
            continue
        if isinstance(value, (dict, list)):
            continue
        text = str(value)
        rows.append({
            "label": str(key).replace("_", " ").strip().capitalize(),
            "value": text[:MAX_VALUE_CHARS],
        })
        if len(rows) >= MAX_FORM_FIELDS:
            break
    return rows


def _ai_brief(sub):
    """The AI summary for the page, or None when there is nothing to show (switched off,
    failed, never started). 'pending' tells the page to keep checking."""
    if sub.ai_dg_brief_status == "pending":
        return {"status": "pending"}
    brief = sub.ai_dg_brief or {}
    if sub.ai_dg_brief_status != "ready" or not brief.get("request"):
        return None
    return {
        "status": "ready",
        "request": brief["request"],
        "key_facts": brief.get("key_facts", []),
        "documents": brief.get("documents", []),
        "points_to_check": brief.get("points_to_check", []),
        "generated_at": sub.ai_dg_brief_generated_at,
    }


def _summary(token):
    from .agenda_carryover import carryover_status

    sub = token.submission
    dg = token.dg_user
    form_type = PSCFormType.objects.filter(code=sub.form_type_code).values_list("name", flat=True).first()
    creator = sub.created_by
    docs = [
        {
            "id": d.id,
            "name": d.original_name,
            "description": d.description,
            "uploaded_at": d.uploaded_at,
        }
        for d in sub.documents.filter(archived_at__isnull=True).order_by("uploaded_at")
    ]
    profile = getattr(dg, "psc_profile", None)
    return {
        "reference_number": sub.reference_number,
        "title": sub.title,
        "form_type_code": sub.form_type_code,
        "form_type_name": form_type or "",
        "ministry": sub.ministry.name,
        "department": sub.department.name if sub.department_id else "",
        "classification": sub.get_classification_display(),
        "notes": sub.notes,
        "prepared_by": (creator.get_full_name() or creator.username) if creator else "",
        "prepared_at": sub.created_at if hasattr(sub, "created_at") else None,
        "form_fields": _form_fields(sub),
        "ai_brief": _ai_brief(sub),
        "documents": docs,
        "sitting": carryover_status(sub),
        "dg_name": dg.get_full_name() or dg.username,
        "expires_at": token.expires_at,
        "pin_required": dg_approval.pin_required(),
        "has_pin": bool(profile and profile.session_pin),
    }


@api_view(["GET"])
@authentication_classes([])  # the token is the credential; ignore any login header
@permission_classes([permissions.AllowAny])
@throttle_classes([DGApprovalThrottle])
def dg_approval_summary_view(request, token):
    """GET /dg-approval/<token>/ — what the DG is being asked to approve."""
    row = dg_approval.find_live_token(token)
    if row is None:
        return _not_found()
    if not request.query_params.get("poll"):  # the page re-checks while the summary is written
        log_action(
            request, AuditLog.Action.READ,
            resource_type="Submission", resource_id=row.submission_id,
            resource_label=row.submission.reference_number,
            description=f"DG approval link opened: {row.dg_user.username}",
        )
    return _protect(Response(_summary(row)))


@api_view(["GET"])
@authentication_classes([])  # the token is the credential; ignore any login header
@permission_classes([permissions.AllowAny])
@throttle_classes([DGApprovalThrottle])
def dg_approval_document_view(request, token, doc_id):
    """GET /dg-approval/<token>/documents/<id>/ — a file of the paper being approved."""
    row = dg_approval.find_live_token(token)
    if row is None:
        return _not_found()
    doc = row.submission.documents.filter(pk=doc_id, archived_at__isnull=True).first()
    if doc is None or not doc.file:
        return _not_found()
    try:
        handle = doc.file.open("rb")
    except FileNotFoundError:
        return _not_found()
    content_type = mimetypes.guess_type(doc.original_name)[0] or "application/octet-stream"
    response = FileResponse(handle, content_type=content_type)
    safe_name = (doc.original_name or "document").replace('"', "")
    response["Content-Disposition"] = f'inline; filename="{safe_name}"'
    response["X-Content-Type-Options"] = "nosniff"
    return _protect(response)


@api_view(["POST"])
@authentication_classes([])  # the token is the credential; ignore any login header
@permission_classes([permissions.AllowAny])
@throttle_classes([DGApprovalThrottle])
def dg_approval_decide_view(request, token):
    """POST /dg-approval/<token>/decide/ — approve, or return to HR with a comment.

    Body: {"decision": "approve" | "return", "pin": "...", "remarks": "..."}.
    """
    from .views import SubmissionViewSet

    decision = str(request.data.get("decision") or "").strip().lower()
    remarks = str(request.data.get("remarks") or "").strip()
    pin = str(request.data.get("pin") or "")
    if decision not in {"approve", "return"}:
        return _protect(Response({"detail": "Choose approve or return."}, status=status.HTTP_400_BAD_REQUEST))
    if decision == "return" and not remarks:
        return _protect(Response(
            {"detail": "Please add a comment explaining why you are returning this to HR.", "code": "remarks_required"},
            status=status.HTTP_400_BAD_REQUEST,
        ))

    ip, user_agent = _get_ip(request), _get_ua(request)
    with transaction.atomic():
        row = dg_approval.find_live_token(token)
        if row is None:
            return _not_found()
        # Serialize two clicks on the same link: only the first one gets through.
        from .models import DGApprovalToken

        row = DGApprovalToken.objects.select_for_update().select_related("submission", "dg_user").get(pk=row.pk)
        if not row.is_active() or row.submission.current_stage != WorkflowStage.PENDING_DG_ENDORSEMENT:
            return _not_found()

        ok, reason = dg_approval.check_pin(row, pin)
        if not ok:
            if reason == "no_pin":
                body = {
                    "detail": "You have not set your SCDMS PIN yet. Sign in to SCDMS once to set it, "
                              "then use this link again — or approve the paper after signing in.",
                    "code": "no_pin",
                }
            elif reason == "locked":
                body = {
                    "detail": "Too many incorrect PINs. This link has been cancelled — ask HR to send a new one.",
                    "code": "locked",
                }
            else:
                left = max(dg_approval.MAX_PIN_ATTEMPTS - row.failed_pin_attempts, 0)
                body = {"detail": "That PIN is not correct.", "code": "wrong_pin", "attempts_left": left}
            log_action(
                request, AuditLog.Action.UPDATE,
                resource_type="Submission", resource_id=row.submission_id,
                resource_label=row.submission.reference_number,
                description=f"DG approval link: PIN check failed ({reason}) for {row.dg_user.username}",
            )
            # check_pin already saved the attempt counter (or the cancellation); returning
            # normally commits it.
            return _protect(Response(body, status=status.HTTP_400_BAD_REQUEST))

        submission, dg = row.submission, row.dg_user
        view = SubmissionViewSet()
        if decision == "approve":
            dg_approval.consume(row, "approved", ip, user_agent)
            view._complete_dg_endorsement(submission, dg, method="email_link", request=request)
        else:
            dg_approval.consume(row, "returned", ip, user_agent)
            view._return_from_dg(submission, dg, remarks, request=request)

    from .email_templates import get_frontend_base_url

    return _protect(Response({
        "outcome": "approved" if decision == "approve" else "returned",
        "reference_number": submission.reference_number,
        "title": submission.title,
        "login_url": f"{get_frontend_base_url()}/auth/login",
        "submission_url": f"{get_frontend_base_url()}/submissions/{submission.pk}",
    }))

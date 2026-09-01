"""
Public, unauthenticated submission tracking.

Lets a ministry that lodged a form check its status without logging in —
reference number in, a coarse progress view out. Deliberately minimal:
no applicant name, documents, comments, assessment content, or staff
names are ever returned here (unit + role title only for "who's handling
it"; no actor identity in the transition history).

When a submission has an applicant_tracking_code (see Submission model —
set automatically when applicant_email is provided at lodging), the
reference number alone is no longer enough: an optional `?code=` query
param must match it too, giving the affected employee/public servant a
private second factor the ministry HR/DG who lodged it doesn't need.
"""
from __future__ import annotations

from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response

from .audit import log_action
from .models import AuditLog, Submission, WorkflowStage
from .throttles import SubmissionTrackThrottle

# The public-facing progress sequence. Every forward-path stage maps onto one
# of these; branch/hold stages are anchored to the milestone they interrupt
# (see STAGE_INFO) rather than counted as their own step.
MILESTONES = [
    "Submitted",
    "Registered",
    "Checklist Review",
    "Assessment",
    "With Commission",
    "Decision Recorded",
    "Implementation",
]

# WorkflowStage.DRAFT is deliberately absent — the enforcement point for
# "drafts aren't publicly trackable." Any stage missing from this map
# (DRAFT today, or a future stage added without updating this dict) is
# treated as "not found" by the view below, not just DRAFT specifically.
#
# Each entry: milestone index into MILESTONES (or None for stages that don't
# belong on the forward path at all), whether the stage represents a pause/
# hold rather than forward progress, and a display label. Labels are mostly
# the stage's own human-readable name; overrides exist only to strip internal
# jargon/system references (e.g. "(CMS)"), never to hide an outcome — the
# actual result (Approved / Not Approved / Rejected / Returned) is the whole
# point of tracking a decision, so it's shown plainly.
STAGE_INFO = {
    # ── Submitted ──
    WorkflowStage.PENDING_DG_ENDORSEMENT: {"milestone": 0, "paused": False, "label": "Submitted"},
    WorkflowStage.DG_APPROVED: {"milestone": 0, "paused": False, "label": "Submitted"},
    WorkflowStage.PENDING_MANAGER_APPROVAL: {"milestone": 0, "paused": False, "label": "Submitted"},
    WorkflowStage.PENDING_SECOND_APPROVAL: {"milestone": 0, "paused": False, "label": "Submitted"},
    WorkflowStage.SUBMITTED: {"milestone": 0, "paused": False, "label": "Submitted"},
    WorkflowStage.RESUBMITTED: {"milestone": 0, "paused": False, "label": "Resubmitted"},
    # ── Registered ──
    WorkflowStage.RECEIVED_BY_PSC: {"milestone": 1, "paused": False, "label": "Registered"},
    WorkflowStage.REGISTERED_ROUTED: {"milestone": 1, "paused": False, "label": "Registered"},
    WorkflowStage.RETURNED_FOR_CLARIFICATION: {"milestone": 1, "paused": True, "label": "Clarification Requested"},
    # ── Checklist review ──
    WorkflowStage.MANAGER_CHECKLIST_REVIEW: {"milestone": 2, "paused": False, "label": "Checklist Review"},
    WorkflowStage.DEFERRED_BACK_TO_HR: {"milestone": 2, "paused": True, "label": "Returned to Ministry"},
    WorkflowStage.DEFERRED_BACK_TO_UNIT: {"milestone": 2, "paused": True, "label": "Returned to Unit"},
    # ── Assessment ──
    WorkflowStage.UNDER_ASSESSMENT: {"milestone": 3, "paused": False, "label": "Under Assessment"},
    WorkflowStage.PENDING_SECRETARY_APPROVAL: {"milestone": 3, "paused": False, "label": "Pending Secretary Approval"},
    WorkflowStage.COMPLIANCE_UNDER_REVIEW: {"milestone": 3, "paused": False, "label": "Compliance Review"},
    WorkflowStage.SECRETARY_REVIEW: {"milestone": 3, "paused": False, "label": "Secretary Review"},
    # ── With commission ──
    WorkflowStage.FORWARDED_TO_COMMISSION: {"milestone": 4, "paused": False, "label": "Forwarded to Commission"},
    WorkflowStage.COMMISSION_SITTING: {"milestone": 4, "paused": False, "label": "Commission Sitting"},
    WorkflowStage.MATTERS_ARISING: {"milestone": 4, "paused": False, "label": "Matters Arising"},
    WorkflowStage.DEFERRED: {"milestone": 4, "paused": True, "label": "Deferred"},
    WorkflowStage.TABLED: {"milestone": 4, "paused": True, "label": "Tabled"},
    WorkflowStage.AWAITING_LEGAL_ADVICE: {"milestone": 4, "paused": True, "label": "Awaiting Legal Advice"},
    WorkflowStage.AWAITING_CABINET_DECISION: {"milestone": 4, "paused": True, "label": "Awaiting Cabinet Decision"},
    # ── Decision recorded ──
    WorkflowStage.APPROVED: {"milestone": 5, "paused": False, "label": "Approved"},
    WorkflowStage.NOTED: {"milestone": 5, "paused": False, "label": "Noted"},
    WorkflowStage.NOT_APPROVED: {"milestone": 5, "paused": False, "label": "Not Approved"},
    WorkflowStage.REJECTED: {"milestone": 5, "paused": False, "label": "Rejected"},
    WorkflowStage.RETURNED: {"milestone": 5, "paused": False, "label": "Returned"},
    WorkflowStage.MINUTES_DRAFTED_SIGNED: {"milestone": 5, "paused": False, "label": "Minutes Drafted and Signed"},
    WorkflowStage.DECISION_ENTERED_ASSIGNED: {"milestone": 5, "paused": False, "label": "Decision Recorded"},
    # ── Implementation ──
    WorkflowStage.UNDER_IMPLEMENTATION: {"milestone": 6, "paused": False, "label": "Under Implementation"},
    WorkflowStage.IMPLEMENTATION_REPORT: {"milestone": 6, "paused": False, "label": "Implementation Reported"},
    # ── Special case: not on the forward path at all ──
    WorkflowStage.RECALLED: {"milestone": None, "paused": True, "label": "Recalled by Ministry"},
}


def _not_found(request, ref):
    log_action(
        request, AuditLog.Action.READ,
        resource_type="submission_track", resource_id=ref, resource_label=ref,
        description="Public tracking lookup — not found",
    )
    return Response({"detail": "Submission not found."}, status=404)


def _stage_history(submission):
    events = (
        submission.stage_events
        .exclude(stage=WorkflowStage.DRAFT)
        .order_by("occurred_at")
    )
    history = []
    for event in events:
        info = STAGE_INFO.get(event.stage)
        if info is None:
            continue
        history.append({"stage_label": info["label"], "occurred_at": event.occurred_at})
    return history


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@throttle_classes([SubmissionTrackThrottle])
def track_submission_view(request, reference_number):
    """GET /track/<reference_number>/ — public, unauthenticated lookup.

    Returns reference number, ministry name, current unit/role (never a
    person's name), a progress-milestone position, and a dated stage
    history. Nonexistent references, drafts, and any stage not yet mapped
    all return the same generic 404 so a requester can't distinguish
    "wrong reference" from "not trackable yet".
    """
    ref = (reference_number or "").strip().upper()
    if not ref:
        return _not_found(request, ref)

    submission = (
        Submission.objects.filter(reference_number__iexact=ref)
        .select_related("ministry", "unit", "assigned_to__psc_profile")
        .first()
    )
    info = STAGE_INFO.get(submission.current_stage) if submission else None
    if submission is None or info is None:
        return _not_found(request, ref)

    # Submissions with an applicant_tracking_code require it as a second
    # factor — reference number alone can leak (printed documents, forwarded
    # emails), so this quietly upgrades protection where a code was issued.
    # Same generic 404 as "not found" either way, so a requester can't tell
    # a wrong code apart from a wrong reference number.
    if submission.applicant_tracking_code:
        supplied_code = (request.query_params.get("code") or "").strip().upper()
        if supplied_code != submission.applicant_tracking_code:
            return _not_found(request, ref)

    assigned_role = None
    assigned_to = submission.assigned_to
    if assigned_to is not None and hasattr(assigned_to, "psc_profile"):
        assigned_role = assigned_to.psc_profile.get_role_display()

    log_action(
        request, AuditLog.Action.READ,
        resource_type="submission_track", resource_id=submission.reference_number,
        resource_label=submission.reference_number,
        description="Public tracking lookup",
    )

    return Response({
        "reference_number": submission.reference_number,
        "ministry": submission.ministry.name,
        "unit": submission.unit.name if submission.unit else None,
        "assigned_role": assigned_role,
        "current_stage_label": info["label"],
        "is_paused": info["paused"],
        "milestone_index": info["milestone"],
        "milestones": MILESTONES,
        "history": _stage_history(submission),
        "last_updated": submission.updated_at,
    })

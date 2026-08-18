"""
Ministry-facing "subway map" for submission workflow progress.

Five logical stations map many granular :class:`tracker.models.WorkflowStage` values.
"""
from __future__ import annotations

from typing import Any

from .models import WorkflowStage

# ── Human-readable role titles (no personal names — role/title only) ──────────
_ROLE_TITLE: dict[str, str] = {
    "odu_principal":               "ODU Principal Analyst",
    "hr_unit_principal":           "HR Principal Officer",
    "vipam_principal":             "VIPAM Principal",
    "compliance_principal":        "Compliance Principal",
    "compliance_senior":           "Compliance Senior Officer",
    "odu_senior":                  "ODU Senior Officer",
    "hr_unit_senior":              "HR Unit Senior Officer",
    "vipam_senior":                "VIPAM Senior Officer",
    "csu_senior":                  "CSU Senior Officer",
    "psc_officer":                 "PSC Officer",
    "psc_secretary":               "PSC Secretary",
    "senior_admin_officer":        "Senior Administration Officer",
    "psc_manager":                 "OPSC Manager",
    "psc_admin":                   "PSC Administrator",
    "odu_manager":                 "ODU Manager",
    "hr_unit_manager":             "HR Unit Manager",
    "vipam_manager":               "VIPAM Manager",
    "compliance_manager":          "Compliance Manager",
    "csu_manager":                 "CSU Manager",
    "principal_officer":           "Principal Officer",
    "senior_officer":              "Senior Officer",
}

_UNIT_LABEL: dict[str, str] = {
    "odu":        "ODU",
    "hr":         "HR Unit",
    "vipam":      "VIPAM",
    "compliance": "Compliance Unit",
    "csu":        "Corporate Services Unit",
}


def _role_title(role: str | None) -> str:
    if not role:
        return "assigned officer"
    return _ROLE_TITLE.get(role, role.replace("_", " ").title())


def _unit_label(unit: str | None) -> str:
    if not unit:
        return "the responsible unit"
    return _UNIT_LABEL.get(unit, unit.upper())


# Stages before OPSC has even registered/routed the submission — it's still
# sitting with whoever created it (ministry HR, DG, or an OPSC-internal
# creator), so "who created it" is the only meaningful answer to "who has it".
_PRE_INTAKE_STAGES = frozenset({
    WorkflowStage.DRAFT,
    WorkflowStage.PENDING_DG_ENDORSEMENT,
    WorkflowStage.DG_APPROVED,
    WorkflowStage.PENDING_MANAGER_APPROVAL,
    WorkflowStage.PENDING_SECOND_APPROVAL,
    WorkflowStage.SUBMITTED,
    WorkflowStage.RECEIVED_BY_PSC,
    WorkflowStage.RETURNED_FOR_CLARIFICATION,
    WorkflowStage.RESUBMITTED,
})


def allocated_to_label(submission) -> str | None:
    """Short, role-aware label for who currently has this submission — e.g.
    "Principal Samuel", "Manager ODU", "Secretary", "Created by Julie" — for
    the OPSC-internal Submissions list "Allocated To" column. Returns None
    for stages not explicitly covered here (Commission, post-decision),
    letting the caller fall back to the plain assigned-officer name / blank.
    """
    stage = submission.current_stage
    if stage in (WorkflowStage.PENDING_SECRETARY_APPROVAL, WorkflowStage.SECRETARY_REVIEW):
        return "Secretary"

    if stage in _PRE_INTAKE_STAGES:
        creator = submission.created_by
        if not creator:
            return None
        return f"Created by {creator.first_name or creator.username}"

    if stage == WorkflowStage.REGISTERED_ROUTED:
        # Just landed with the unit — nobody's picked it up to assign yet.
        return f"Manager {_unit_label(submission.routed_unit)}" if submission.routed_unit else "Manager"

    if stage in (WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.UNDER_ASSESSMENT):
        assignee = submission.assigned_to
        if assignee and not submission.ready_for_manager_at:
            profile = getattr(assignee, "psc_profile", None)
            role = (profile.role if profile else "") or ""
            first = assignee.first_name or assignee.username
            if "principal" in role:
                return f"Principal {first}"
            if "senior" in role:
                return f"Senior {first}"
            return first
        if assignee and submission.ready_for_manager_at:
            # Handed back by the Principal/Senior — genuinely with the Manager
            # for action now, distinct from the never-assigned case below (the
            # list's "Manager {unit}" used to mean both, so a Manager had no
            # way to tell "my team finished, act now" from "nobody's touched
            # this yet" — see caller's Unassigned fallback for the latter).
            return f"Manager {_unit_label(submission.routed_unit)}" if submission.routed_unit else "Manager"
        # Nobody assigned yet — falls through to the caller's "Unassigned" label.
        return None

    return None


def _build_status_detail(submission) -> str:
    """
    Return a short, human-readable status line for the current station.
    Uses role titles only — never personal names.
    """
    stage = submission.current_stage or ""

    # Helper: get assigned principal's role title (if any)
    assigned_role: str | None = None
    try:
        profile = getattr(submission.assigned_to, "psc_profile", None)
        if profile:
            assigned_role = profile.role
    except Exception:
        pass

    has_co_assigned = False
    try:
        has_co_assigned = submission.co_assignments.exists()
    except Exception:
        pass

    unit = submission.routed_unit or ""

    # ── Ministry pre-submission ───────────────────────────────────────────────
    if stage == WorkflowStage.DRAFT:
        return "Preparing submission"
    if stage == WorkflowStage.PENDING_DG_ENDORSEMENT:
        return "Awaiting Director-General endorsement"
    if stage in (WorkflowStage.SUBMITTED, WorkflowStage.RESUBMITTED):
        return "Received — awaiting PSC registration"
    if stage == WorkflowStage.RECEIVED_BY_PSC:
        return "Registered at PSC"

    # ── Return / clarification ────────────────────────────────────────────────
    if stage == WorkflowStage.RETURNED_FOR_CLARIFICATION:
        return "Returned — ministry clarification required"
    if stage == WorkflowStage.DEFERRED_BACK_TO_HR:
        return "Deferred by Commission — ministry action required"
    if stage == WorkflowStage.RECALLED:
        return "Recalled by Ministry"

    # ── Assessment ───────────────────────────────────────────────────────────
    if stage == WorkflowStage.REGISTERED_ROUTED:
        if unit:
            return f"Routed to {_unit_label(unit)} for checklist review"
        return "Registered and routed for review"

    if stage == WorkflowStage.MANAGER_CHECKLIST_REVIEW:
        # Once the assigned principal hands the checklist back (ready_for_manager_at
        # set), the ball is with the unit manager — "assigned to {principal}" would
        # be stale and read as if nothing had happened since allocation.
        if assigned_role and submission.ready_for_manager_at:
            unit_manager = f"{_unit_label(unit)} Manager" if unit else "the unit manager"
            return f"Reviewed by {_role_title(assigned_role)} — awaiting {unit_manager}'s decision"
        if assigned_role:
            detail = f"Checklist review assigned to {_role_title(assigned_role)}"
            if has_co_assigned:
                detail += " and co-analysts"
            return detail
        if unit:
            return f"{_unit_label(unit)} Manager reviewing submission package"
        return "Manager checklist review in progress"

    if stage == WorkflowStage.UNDER_ASSESSMENT:
        overdue = getattr(submission, "is_assessment_overdue", False)
        if overdue:
            if assigned_role:
                return f"Assessment overdue — with {_role_title(assigned_role)}"
            return "Assessment overdue — pending escalation"
        # Same hand-back staleness fix as Manager Checklist Review above.
        if assigned_role and submission.ready_for_manager_at:
            unit_manager = f"{_unit_label(unit)} Manager" if unit else "the unit manager"
            return f"Assessed by {_role_title(assigned_role)} — awaiting {unit_manager}'s decision"
        if assigned_role:
            detail = f"Under assessment by {_role_title(assigned_role)}"
            if has_co_assigned:
                detail += " and co-analysts"
            return detail
        if unit:
            return f"Awaiting assignment by {_unit_label(unit)} Manager"
        return "Under assessment"

    if stage == WorkflowStage.PENDING_SECRETARY_APPROVAL:
        return "Assessment complete — awaiting PSC Secretary approval"

    if stage == WorkflowStage.COMPLIANCE_UNDER_REVIEW:
        return "Compliance review in progress (CMS)"

    if stage == WorkflowStage.DEFERRED:
        return "Deferred — awaiting further information"
    if stage == WorkflowStage.AWAITING_LEGAL_ADVICE:
        return "Awaiting legal advice"
    if stage == WorkflowStage.AWAITING_CABINET_DECISION:
        return "Awaiting Cabinet decision"

    # ── Commission ────────────────────────────────────────────────────────────
    if stage == WorkflowStage.FORWARDED_TO_COMMISSION:
        return "Forwarded — queued for Commission sitting"
    if stage == WorkflowStage.COMMISSION_SITTING:
        return "Before the Public Service Commission"
    if stage == WorkflowStage.MATTERS_ARISING:
        return "Matters arising — follow-up required"
    if stage == WorkflowStage.TABLED:
        return "Tabled — deferred to a future sitting"

    # ── Internal (Secretary review) ───────────────────────────────────────────
    if stage == WorkflowStage.SECRETARY_REVIEW:
        return "Under Secretary review"

    # ── Decision ─────────────────────────────────────────────────────────────
    if stage == WorkflowStage.APPROVED:
        return "Approved by the Commission"
    if stage == WorkflowStage.REJECTED:
        return "Rejected by the Commission"
    if stage == WorkflowStage.RETURNED:
        return "Returned — further action required"

    # ── Post-decision / implementation ────────────────────────────────────────
    if stage == WorkflowStage.MINUTES_DRAFTED_SIGNED:
        return "Decision recorded — minutes being finalised"
    if stage == WorkflowStage.DECISION_ENTERED_ASSIGNED:
        return "Decision entered — implementation assigned"
    if stage == WorkflowStage.UNDER_IMPLEMENTATION:
        return "Under implementation"
    if stage == WorkflowStage.IMPLEMENTATION_REPORT:
        return "Implementation complete"

    # Fallback
    return stage.replace("_", " ").title()

SENT_BACK_STAGES = frozenset({
    WorkflowStage.RETURNED_FOR_CLARIFICATION,
    WorkflowStage.DEFERRED_BACK_TO_HR,
    WorkflowStage.RETURNED,
})

_DEFAULT_RETURN_TARGET = {
    WorkflowStage.RETURNED_FOR_CLARIFICATION: WorkflowStage.SUBMITTED,
    WorkflowStage.DEFERRED_BACK_TO_HR: WorkflowStage.UNDER_ASSESSMENT,
    WorkflowStage.RETURNED: WorkflowStage.REGISTERED_ROUTED,
}

SUBWAY_STATION_DEFS: list[dict[str, Any]] = [
    {
        "id": "intake",
        "label": "Intake",
        "workflow_stages": [
            WorkflowStage.DRAFT,
            WorkflowStage.SUBMITTED,
            WorkflowStage.RECEIVED_BY_PSC,
            WorkflowStage.RESUBMITTED,
            WorkflowStage.RETURNED_FOR_CLARIFICATION,
            WorkflowStage.SECRETARY_REVIEW,
        ],
    },
    {
        "id": "assessment",
        "label": "Assessment",
        "workflow_stages": [
            WorkflowStage.REGISTERED_ROUTED,
            WorkflowStage.MANAGER_CHECKLIST_REVIEW,
            WorkflowStage.UNDER_ASSESSMENT,
            WorkflowStage.PENDING_SECRETARY_APPROVAL,
            WorkflowStage.COMPLIANCE_UNDER_REVIEW,
            WorkflowStage.DEFERRED,
            WorkflowStage.AWAITING_LEGAL_ADVICE,
            WorkflowStage.AWAITING_CABINET_DECISION,
        ],
    },
    {
        "id": "commission",
        "label": "Commission",
        "workflow_stages": [
            WorkflowStage.FORWARDED_TO_COMMISSION,
            WorkflowStage.COMMISSION_SITTING,
            WorkflowStage.MATTERS_ARISING,
            WorkflowStage.TABLED,
        ],
    },
    {
        "id": "decision",
        "label": "Decision",
        "workflow_stages": [
            WorkflowStage.APPROVED,
            WorkflowStage.REJECTED,
            WorkflowStage.RETURNED,
            WorkflowStage.DEFERRED_BACK_TO_HR,
        ],
    },
    {
        "id": "implementation",
        "label": "Execution",
        "workflow_stages": [
            WorkflowStage.MINUTES_DRAFTED_SIGNED,
            WorkflowStage.DECISION_ENTERED_ASSIGNED,
            WorkflowStage.UNDER_IMPLEMENTATION,
            WorkflowStage.IMPLEMENTATION_REPORT,
        ],
    },
]

ALERT_STAGES = frozenset({
    WorkflowStage.RETURNED_FOR_CLARIFICATION,
    WorkflowStage.REJECTED,
})

STATION_IDS = [s["id"] for s in SUBWAY_STATION_DEFS]


def _stage_to_station_map() -> dict[str, str]:
    out: dict[str, str] = {}
    for st in SUBWAY_STATION_DEFS:
        for code in st["workflow_stages"]:
            out[code] = st["id"]
    return out


_STAGE_TO_STATION = _stage_to_station_map()


def station_id_for_stage(stage: str | None) -> str:
    if not stage:
        return STATION_IDS[0]
    return _STAGE_TO_STATION.get(stage, STATION_IDS[0])


def _station_index(station_id: str) -> int:
    try:
        return STATION_IDS.index(station_id)
    except ValueError:
        return 0


def _resolve_sent_back(submission, current_stage: str) -> dict[str, Any] | None:
    if current_stage not in SENT_BACK_STAGES:
        return None

    previous_stage: str | None = None
    events = getattr(submission, "events", None)
    if events is not None:
        for ev in reversed(list(events.all())):
            if ev.new_stage == current_stage:
                previous_stage = ev.previous_stage
                break

    if not previous_stage:
        previous_stage = _DEFAULT_RETURN_TARGET.get(current_stage)

    from_station_id = station_id_for_stage(previous_stage)
    target_station_id = station_id_for_stage(
        _DEFAULT_RETURN_TARGET.get(current_stage, previous_stage),
    )

    if current_stage in (
        WorkflowStage.RETURNED_FOR_CLARIFICATION,
        WorkflowStage.RETURNED,
    ):
        target_station_id = "intake"
    elif current_stage == WorkflowStage.DEFERRED_BACK_TO_HR:
        target_station_id = "assessment"

    return {
        "active": True,
        "reason_stage": current_stage,
        "from_station_id": from_station_id,
        "target_station_id": target_station_id,
        "from_stage": previous_stage,
    }


def build_subway_map(submission) -> dict[str, Any]:
    """Build subway-map payload for a submission (detail API / SPA)."""
    stage = submission.current_stage
    sent_back = _resolve_sent_back(submission, stage)
    is_alert = stage in ALERT_STAGES

    if sent_back and sent_back["active"]:
        current_station_id = sent_back["target_station_id"]
    else:
        current_station_id = station_id_for_stage(stage)

    current_idx = _station_index(current_station_id)

    stations_out: list[dict[str, Any]] = []
    for i, st_def in enumerate(SUBWAY_STATION_DEFS):
        sid = st_def["id"]
        in_station = stage in st_def["workflow_stages"]

        if sent_back and sent_back["active"]:
            target_idx = _station_index(sent_back["target_station_id"])
            from_idx = _station_index(sent_back["from_station_id"])
            if sid == sent_back["target_station_id"]:
                status = "returned"
            elif sid == sent_back["from_station_id"]:
                status = "returned_from"
            elif i < min(target_idx, from_idx):
                status = "complete"
            else:
                status = "upcoming"
        elif in_station:
            status = "current"
        elif i < current_idx:
            status = "complete"
        else:
            status = "upcoming"

        stations_out.append({
            "id": sid,
            "label": st_def["label"],
            "label_key": f"subway.{sid}",
            "status": status,
            "workflow_stages": list(st_def["workflow_stages"]),
            "current_substage": stage if in_station else None,
        })

    if stage == WorkflowStage.IMPLEMENTATION_REPORT:
        path_variant = "complete"
    elif sent_back and sent_back["active"]:
        path_variant = "returned"
    elif is_alert:
        path_variant = "alert"
    else:
        path_variant = "normal"

    if path_variant == "complete":
        progress_percent = 100
    elif sent_back and sent_back["active"]:
        target_idx = _station_index(sent_back["target_station_id"])
        progress_percent = round((target_idx + 0.35) / len(STATION_IDS) * 100)
    else:
        progress_percent = round((current_idx + 0.65) / (len(STATION_IDS) - 1) * 100)

    return {
        "stations": stations_out,
        "current_stage": stage,
        "current_station_id": current_station_id,
        "current_station_index": current_idx,
        "path_variant": path_variant,
        "is_alert_state": is_alert,
        "sent_back": sent_back,
        "progress_percent": min(100, max(0, progress_percent)),
        "station_order": list(STATION_IDS),
        "status_detail": _build_status_detail(submission),
    }


def list_subway_station_catalog() -> list[dict[str, Any]]:
    return [
        {
            "id": s["id"],
            "label": s["label"],
            "label_key": f"subway.{s['id']}",
            "workflow_stages": list(s["workflow_stages"]),
        }
        for s in SUBWAY_STATION_DEFS
    ]

"""
Ministry-facing "subway map" for submission workflow progress.

Station definitions are derived from :class:`tracker.models.WorkflowStage` choices.
"""
from __future__ import annotations

from typing import Any

from .models import WorkflowStage

# Stages that mean the matter was sent back for ministry / HR action.
SENT_BACK_STAGES = frozenset({
    WorkflowStage.RETURNED_FOR_CLARIFICATION,
    WorkflowStage.DEFERRED_BACK_TO_HR,
    WorkflowStage.RETURNED,
})

# Default return target when no workflow event history is available.
_DEFAULT_RETURN_TARGET = {
    WorkflowStage.RETURNED_FOR_CLARIFICATION: WorkflowStage.REGISTERED_ROUTED,
    WorkflowStage.DEFERRED_BACK_TO_HR: WorkflowStage.UNDER_ASSESSMENT,
    WorkflowStage.RETURNED: WorkflowStage.REGISTERED_ROUTED,
}

SUBWAY_STATION_DEFS: list[dict[str, Any]] = [
    {
        "id": "registered",
        "label": "Registered",
        "workflow_stages": [
            WorkflowStage.DRAFT,
            WorkflowStage.SUBMITTED,
            WorkflowStage.RECEIVED_BY_PSC,
            WorkflowStage.RETURNED_FOR_CLARIFICATION,
            WorkflowStage.REGISTERED_ROUTED,
            WorkflowStage.MANAGER_CHECKLIST_REVIEW,
            WorkflowStage.RESUBMITTED,
            WorkflowStage.SECRETARY_REVIEW,
        ],
    },
    {
        "id": "under_assessment",
        "label": "Under Assessment",
        "workflow_stages": [
            WorkflowStage.UNDER_ASSESSMENT,
            WorkflowStage.COMPLIANCE_UNDER_REVIEW,
            WorkflowStage.DEFERRED,
            WorkflowStage.TABLED,
            WorkflowStage.AWAITING_LEGAL_ADVICE,
            WorkflowStage.AWAITING_CABINET_DECISION,
        ],
    },
    {
        "id": "commission_sitting",
        "label": "Commission Sitting",
        "workflow_stages": [
            WorkflowStage.FORWARDED_TO_COMMISSION,
            WorkflowStage.COMMISSION_SITTING,
            WorkflowStage.MATTERS_ARISING,
            WorkflowStage.APPROVED,
            WorkflowStage.REJECTED,
            WorkflowStage.RETURNED,
            WorkflowStage.DEFERRED_BACK_TO_HR,
        ],
    },
    {
        "id": "implementation",
        "label": "Implementation",
        "workflow_stages": [
            WorkflowStage.MINUTES_DRAFTED_SIGNED,
            WorkflowStage.DECISION_ENTERED_ASSIGNED,
            WorkflowStage.UNDER_IMPLEMENTATION,
            WorkflowStage.IMPLEMENTATION_REPORT,
        ],
    },
]

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

    # Clarification / commission return → ministry works at intake (registered).
    if current_stage in (
        WorkflowStage.RETURNED_FOR_CLARIFICATION,
        WorkflowStage.RETURNED,
    ):
        target_station_id = "registered"
    elif current_stage == WorkflowStage.DEFERRED_BACK_TO_HR:
        target_station_id = "under_assessment"

    return {
        "active": True,
        "reason_stage": current_stage,
        "from_station_id": from_station_id,
        "target_station_id": target_station_id,
        "from_stage": previous_stage,
    }


def build_subway_map(submission) -> dict[str, Any]:
    """
    Build subway-map payload for a submission (detail API / SPA).

    ``submission`` should have ``current_stage``; ``events`` prefetched when possible.
    """
    stage = submission.current_stage
    sent_back = _resolve_sent_back(submission, stage)

    if sent_back and sent_back["active"]:
        current_station_id = sent_back["target_station_id"]
    else:
        current_station_id = station_id_for_stage(stage)

    current_idx = _station_index(current_station_id)
    from_idx = (
        _station_index(sent_back["from_station_id"])
        if sent_back and sent_back["active"]
        else current_idx
    )
    target_idx = (
        _station_index(sent_back["target_station_id"])
        if sent_back and sent_back["active"]
        else current_idx
    )

    stations_out: list[dict[str, Any]] = []
    for i, st_def in enumerate(SUBWAY_STATION_DEFS):
        sid = st_def["id"]
        in_station = stage in st_def["workflow_stages"]

        if sent_back and sent_back["active"]:
            if sid == sent_back["target_station_id"]:
                status = "returned"
            elif sid == sent_back["from_station_id"]:
                status = "returned_from"
            elif i < min(target_idx, from_idx):
                status = "complete"
            elif i > max(target_idx, from_idx):
                status = "upcoming"
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
    else:
        path_variant = "normal"

    # Progress for Fluent ProgressBar (0–100).
    if path_variant == "complete":
        progress_percent = 100
    elif sent_back and sent_back["active"]:
        progress_percent = round((target_idx + 0.35) / len(STATION_IDS) * 100)
    else:
        progress_percent = round((current_idx + (0.65 if stage in SUBWAY_STATION_DEFS[current_idx]["workflow_stages"] else 1)) / len(STATION_IDS) * 100)
    progress_percent = min(100, max(0, progress_percent))

    return {
        "stations": stations_out,
        "current_stage": stage,
        "current_station_id": current_station_id,
        "path_variant": path_variant,
        "sent_back": sent_back,
        "progress_percent": progress_percent,
        "station_order": list(STATION_IDS),
    }


def list_subway_station_catalog() -> list[dict[str, Any]]:
    """Public catalog of stations (optional API)."""
    return [
        {
            "id": s["id"],
            "label": s["label"],
            "label_key": f"subway.{s['id']}",
            "workflow_stages": list(s["workflow_stages"]),
        }
        for s in SUBWAY_STATION_DEFS
    ]

"""
Ministry-facing "subway map" for submission workflow progress.

Five logical stations map many granular :class:`tracker.models.WorkflowStage` values.
"""
from __future__ import annotations

from typing import Any

from .models import WorkflowStage

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

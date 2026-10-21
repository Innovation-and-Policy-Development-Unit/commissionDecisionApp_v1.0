"""Small helpers shared by the Smart Report domain resolvers."""

from __future__ import annotations

import math
import statistics
from datetime import datetime, timedelta
from typing import Any

from django.utils import timezone

from tracker.models import Role, WorkflowStage

# Ministry-facing roles: never allowed to run reports that look across ministries or
# at system access.
MINISTRY_SIDE_ROLES = frozenset({
    Role.HEAD_OF_AGENCY, Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.TRAVELLER, Role.DG_DIRECTOR,
})


# Ministry-side stages before the matter has actually reached the PSC.
PRE_LODGE_STAGES = frozenset({
    WorkflowStage.DRAFT,
    WorkflowStage.PENDING_DG_ENDORSEMENT,
    WorkflowStage.DG_APPROVED,
    WorkflowStage.PENDING_MANAGER_APPROVAL,
    WorkflowStage.PENDING_PRINCIPAL_REVIEW,
    WorkflowStage.PENDING_SECOND_APPROVAL,
})
# First event into either of these means the matter was lodged with the PSC.
LODGE_STAGES = (WorkflowStage.SUBMITTED, WorkflowStage.RECEIVED_BY_PSC)
# Commission/Secretary outcomes that count as "decided".
DECISION_STAGES = (
    WorkflowStage.APPROVED,
    WorkflowStage.NOTED,
    WorkflowStage.NOT_APPROVED,
    WorkflowStage.REJECTED,
)


def parse_date(val: Any):
    """'YYYY-MM-DD' → aware datetime at local midnight, or None."""
    if not val:
        return None
    try:
        dt = datetime.strptime(str(val)[:10], "%Y-%m-%d")
    except (TypeError, ValueError):
        return None
    return timezone.make_aware(dt) if timezone.is_naive(dt) else dt


def period_bounds(params: dict[str, Any]):
    """(start, end_exclusive) from date_from/date_to params; either may be None."""
    start = parse_date(params.get("date_from"))
    end = parse_date(params.get("date_to"))
    return start, (end + timedelta(days=1)) if end else None


def in_period(moment, start, end) -> bool:
    if moment is None:
        return False
    if start and moment < start:
        return False
    if end and moment >= end:
        return False
    return True


def is_psc_staff(user) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if user.is_superuser or user.is_staff:
        return True
    try:
        return user.psc_profile.role not in MINISTRY_SIDE_ROLES
    except Exception:
        return False


def median(values: list[float]) -> float | None:
    return round(statistics.median(values), 1) if values else None


def percentile(values: list[float], pct: float) -> float | None:
    """Nearest-rank percentile (pct in 0–100)."""
    if not values:
        return None
    ordered = sorted(values)
    rank = max(1, math.ceil(pct / 100 * len(ordered)))
    return round(ordered[rank - 1], 1)


def days_between(earlier, later) -> float:
    return max((later - earlier).total_seconds() / 86400, 0.0)

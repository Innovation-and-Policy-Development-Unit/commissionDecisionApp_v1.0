"""Condition field catalogs + ORM translators for Watch rules (per entity).

Whitelist-only: a rule condition can reference only a field declared here, and
each leaf is translated into a parameterised Django ``Q`` — no raw SQL.
"""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from tracker.models import (
    AgendaStatus, Classification, CommissionActionUnit, CommissionDecisionOutcome,
    CommissionImplementationStatus, CommissionTaskStatus, MeetingStatus, MeetingType,
    RoutedUnit, WorkflowStage,
)


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _direct(col, op, value):
    if op == "eq":
        return Q(**{col: value})
    if op == "ne":
        return ~Q(**{col: value})
    if op == "in" and isinstance(value, list):
        return Q(**{f"{col}__in": value})
    if op == "contains":
        return Q(**{f"{col}__icontains": value})
    return None


# ── Submissions ───────────────────────────────────────────────────────────────

def submission_fields():
    return [
        {"key": "current_stage", "label": "Stage", "kind": "choice", "choices": dict(WorkflowStage.choices)},
        {"key": "routed_unit", "label": "Routed unit", "kind": "choice", "choices": dict(RoutedUnit.choices)},
        {"key": "classification", "label": "Classification", "kind": "choice", "choices": dict(Classification.choices)},
        {"key": "form_type_code", "label": "Form type", "kind": "text"},
        {"key": "ministry", "label": "Ministry", "kind": "text"},
        {"key": "is_unassigned", "label": "Unassigned", "kind": "bool"},
        {"key": "is_overdue", "label": "Assessment overdue", "kind": "bool"},
        {"key": "days_since_received", "label": "Days since received", "kind": "number"},
        {"key": "days_to_deadline", "label": "Days to assessment deadline", "kind": "number"},
        {"key": "days_since_update", "label": "Days since last update", "kind": "number"},
    ]


def submission_leaf(field, op, value, now):
    if field in ("current_stage", "routed_unit", "classification", "form_type_code"):
        return _direct(field, op, value)
    if field == "ministry":
        return _direct("ministry__name", op, value)
    if field == "is_unassigned":
        return Q(assigned_to__isnull=(op == "is_true"))
    if field == "is_overdue":
        overdue = Q(current_stage=WorkflowStage.UNDER_ASSESSMENT,
                    assessment_deadline_at__isnull=False, assessment_deadline_at__lt=now)
        return overdue if op == "is_true" else ~overdue
    n = _num(value)
    if n is None:
        return None
    days = timedelta(days=n)
    if field == "days_since_received":
        return Q(received_at__isnull=False, received_at__lt=now - days) if op in ("gt", "gte") \
            else Q(received_at__isnull=False, received_at__gt=now - days)
    if field == "days_since_update":
        return Q(updated_at__lt=now - days) if op in ("gt", "gte") else Q(updated_at__gt=now - days)
    if field == "days_to_deadline":
        return Q(assessment_deadline_at__isnull=False, assessment_deadline_at__lt=now + days) if op in ("lt", "lte") \
            else Q(assessment_deadline_at__isnull=False, assessment_deadline_at__gt=now + days)
    return None


# ── Commission tasks (manager → principal allocation) ─────────────────────────

def task_fields():
    return [
        {"key": "status", "label": "Status", "kind": "choice", "choices": dict(CommissionTaskStatus.choices)},
        {"key": "implementation_status", "label": "Implementation", "kind": "choice", "choices": dict(CommissionImplementationStatus.choices)},
        {"key": "action_unit", "label": "Action unit", "kind": "choice", "choices": dict(CommissionActionUnit.choices)},
        {"key": "decision_outcome", "label": "Decision outcome", "kind": "choice", "choices": dict(CommissionDecisionOutcome.choices)},
        {"key": "is_undelegated", "label": "With manager, not delegated", "kind": "bool"},
        {"key": "is_overdue", "label": "Past due date", "kind": "bool"},
        {"key": "days_to_due", "label": "Days to due date", "kind": "number"},
        {"key": "days_since_update", "label": "Days since last update", "kind": "number"},
        {"key": "days_since_created", "label": "Days since created", "kind": "number"},
    ]


def task_leaf(field, op, value, now):
    today = now.date()
    if field in ("status", "implementation_status", "action_unit", "decision_outcome"):
        return _direct(field, op, value)
    if field == "is_undelegated":
        undelegated = Q(assigned_manager__isnull=False, assigned_staff__isnull=True, assigned_staff_m2m__isnull=True)
        return undelegated if op == "is_true" else ~undelegated
    if field == "is_overdue":
        overdue = Q(due_date__isnull=False, due_date__lt=today,
                    status__in=[CommissionTaskStatus.OPEN, CommissionTaskStatus.IN_PROGRESS])
        return overdue if op == "is_true" else ~overdue
    n = _num(value)
    if n is None:
        return None
    days = timedelta(days=n)
    if field == "days_to_due":
        return Q(due_date__isnull=False, due_date__lt=today + days) if op in ("lt", "lte") \
            else Q(due_date__isnull=False, due_date__gt=today + days)
    if field == "days_since_update":
        return Q(updated_at__lt=now - days) if op in ("gt", "gte") else Q(updated_at__gt=now - days)
    if field == "days_since_created":
        return Q(created_at__lt=now - days) if op in ("gt", "gte") else Q(created_at__gt=now - days)
    return None


# ── Meetings / minutes ────────────────────────────────────────────────────────

def meeting_fields():
    return [
        {"key": "status", "label": "Status", "kind": "choice", "choices": dict(MeetingStatus.choices)},
        {"key": "agenda_status", "label": "Agenda status", "kind": "choice", "choices": dict(AgendaStatus.choices)},
        {"key": "type", "label": "Type", "kind": "choice", "choices": dict(MeetingType.choices)},
        {"key": "minutes_signed", "label": "Minutes signed", "kind": "bool"},
        {"key": "has_decisions", "label": "Decisions entered", "kind": "bool"},
        {"key": "days_since_meeting", "label": "Days since sitting date", "kind": "number"},
    ]


def meeting_leaf(field, op, value, now):
    today = now.date()
    if field in ("status", "agenda_status", "type"):
        return _direct(field, op, value)
    if field == "minutes_signed":
        signed = Q(minutes__signed_at__isnull=False)
        return signed if op == "is_true" else ~signed
    if field == "has_decisions":
        has = Q(commission_tasks__isnull=False)
        return has if op == "is_true" else ~has
    if field == "days_since_meeting":
        n = _num(value)
        if n is None:
            return None
        days = timedelta(days=n)
        return Q(date__isnull=False, date__lt=today - days) if op in ("gt", "gte") \
            else Q(date__isnull=False, date__gt=today - days)
    return None


def build_q(leaf_fn, conditions, match, now=None):
    """Combine condition leaves with a per-entity translator (None → match nothing)."""
    now = now or timezone.now()
    parts = []
    for c in conditions or []:
        if not isinstance(c, dict):
            continue
        q = leaf_fn(c.get("field"), c.get("op"), c.get("value"), now)
        if q is not None:
            parts.append(q)
    if not parts:
        return None
    combined = parts[0]
    for q in parts[1:]:
        combined = (combined | q) if match == "any" else (combined & q)
    return combined

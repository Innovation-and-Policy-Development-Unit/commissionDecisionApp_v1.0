"""Condition field catalog + ORM translator for Submission rules.

Whitelist-only: a rule condition can reference only a field declared here, and
each leaf is translated into a parameterised Django ``Q`` — no raw SQL. This is
the same safety posture as the SCDMS Intelligence semantic layer.
"""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from tracker.models import Classification, RoutedUnit, WorkflowStage


def field_catalog():
    """Fields a rule may test, with kind + choices for the builder UI."""
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


_KINDS = {f["key"]: f["kind"] for f in field_catalog()}


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _leaf_q(field, op, value, now):
    kind = _KINDS.get(field)
    if kind is None:
        return None

    # ── Direct category / text columns ──────────────────────────────────────
    if kind == "choice" or field in ("form_type_code", "ministry"):
        col = "ministry__name" if field == "ministry" else field
        if op == "eq":
            return Q(**{col: value})
        if op == "ne":
            return ~Q(**{col: value})
        if op == "in" and isinstance(value, list):
            return Q(**{f"{col}__in": value})
        if op == "contains":
            return Q(**{f"{col}__icontains": value})
        return None

    # ── Booleans ────────────────────────────────────────────────────────────
    if kind == "bool":
        truthy = (op == "is_true") or (op == "eq" and value in (True, "true", 1, "1"))
        if field == "is_unassigned":
            return Q(assigned_to__isnull=truthy)
        if field == "is_overdue":
            overdue = Q(
                current_stage=WorkflowStage.UNDER_ASSESSMENT,
                assessment_deadline_at__isnull=False,
                assessment_deadline_at__lt=now,
            )
            return overdue if truthy else ~overdue
        return None

    # ── Computed temporal fields → date comparisons (no annotation needed) ──
    if kind == "number":
        n = _num(value)
        if n is None:
            return None
        days = timedelta(days=n)
        if field == "days_since_received":
            if op in ("gt", "gte"):
                return Q(received_at__isnull=False, received_at__lt=now - days)
            if op in ("lt", "lte"):
                return Q(received_at__isnull=False, received_at__gt=now - days)
        elif field == "days_since_update":
            if op in ("gt", "gte"):
                return Q(updated_at__lt=now - days)
            if op in ("lt", "lte"):
                return Q(updated_at__gt=now - days)
        elif field == "days_to_deadline":
            if op in ("lt", "lte"):
                return Q(assessment_deadline_at__isnull=False, assessment_deadline_at__lt=now + days)
            if op in ("gt", "gte"):
                return Q(assessment_deadline_at__isnull=False, assessment_deadline_at__gt=now + days)
    return None


def build_q(conditions, match, now=None):
    """Combine condition leaves into one Q (None when nothing valid → match nothing)."""
    now = now or timezone.now()
    parts = []
    for c in conditions or []:
        if not isinstance(c, dict):
            continue
        q = _leaf_q(c.get("field"), c.get("op"), c.get("value"), now)
        if q is not None:
            parts.append(q)
    if not parts:
        return None
    combined = parts[0]
    for q in parts[1:]:
        combined = (combined | q) if match == "any" else (combined & q)
    return combined

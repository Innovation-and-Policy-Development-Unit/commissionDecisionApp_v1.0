"""REST API for the Act (Automation) engine."""

from __future__ import annotations

import csv

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from .automation.engine import action_catalog, run_automation_now
from .models import Automation, AutomationRun, Role
from .rules.entities import get_adapter

_ENTITIES = {c[0] for c in Automation.Entity.choices}
_TRIGGERS = {c[0] for c in Automation.Trigger.choices}
_MATCH = {c[0] for c in Automation.Match.choices}
_OPS = {
    "choice": ["eq", "ne", "in"], "text": ["eq", "ne", "contains"],
    "number": ["gt", "gte", "lt", "lte"], "bool": ["is_true", "is_false"],
}


def _profile(user):
    from .views import _profile as p
    return p(user)


def _require_admin(user):
    if user.is_superuser or user.is_staff:
        return
    if _profile(user).role not in {Role.PSC_ADMIN, Role.PSC_MANAGER}:
        raise PermissionDenied("Only administrators can manage automations.")


def _clean_conditions(raw, entity):
    if not isinstance(raw, list):
        raise ValidationError({"conditions": "conditions must be a list."})
    adapter = get_adapter(entity)
    valid = {f["key"] for f in adapter.catalog()} if adapter else set()
    return [{"field": c["field"], "op": c["op"], "value": c.get("value")}
            for c in raw if isinstance(c, dict) and c.get("field") in valid and c.get("op")]


def _clean_actions(raw, entity):
    if not isinstance(raw, list):
        raise ValidationError({"actions": "actions must be a list."})
    valid = {a["type"] for a in action_catalog(entity)}
    out = []
    for a in raw:
        if isinstance(a, dict) and a.get("type") in valid:
            params = a.get("params") if isinstance(a.get("params"), dict) else {}
            out.append({"type": a["type"], "params": params})
    return out


def _apply(automation, data, *, creating):
    if creating or "entity" in data:
        entity = data.get("entity") or "submission"
        if entity not in _ENTITIES:
            raise ValidationError({"entity": "Invalid entity."})
        automation.entity = entity
    if creating or "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            raise ValidationError({"name": "A name is required."})
        automation.name = name[:200]
    if "description" in data:
        automation.description = (data.get("description") or "").strip()[:300]
    if creating or "trigger" in data:
        if (data.get("trigger") or "updated") not in _TRIGGERS:
            raise ValidationError({"trigger": "Invalid trigger."})
        automation.trigger = data.get("trigger") or "updated"
    if creating or "match" in data:
        if (data.get("match") or "all") not in _MATCH:
            raise ValidationError({"match": "Invalid match mode."})
        automation.match = data.get("match") or "all"
    if creating or "conditions" in data:
        automation.conditions = _clean_conditions(data.get("conditions") or [], automation.entity)
    if creating or "actions" in data:
        automation.actions = _clean_actions(data.get("actions") or [], automation.entity)
    if "is_active" in data:
        automation.is_active = bool(data.get("is_active"))
    if "test_mode" in data:
        automation.test_mode = bool(data.get("test_mode"))
    if "cooldown_minutes" in data:
        try:
            automation.cooldown_minutes = max(0, int(data.get("cooldown_minutes")))
        except (TypeError, ValueError):
            raise ValidationError({"cooldown_minutes": "Must be an integer."})


def _payload(a):
    return {
        "id": a.id, "name": a.name, "description": a.description, "entity": a.entity,
        "trigger": a.trigger, "conditions": a.conditions or [], "match": a.match,
        "actions": a.actions or [], "is_active": a.is_active, "test_mode": a.test_mode,
        "cooldown_minutes": a.cooldown_minutes, "updated_at": a.updated_at.isoformat(),
        "runs": a.runs.count(),
    }


# ── Field + action catalog ────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def automation_fields(request):
    _require_admin(request.user)
    entity = request.query_params.get("entity") or "submission"
    adapter = get_adapter(entity)
    if adapter is None:
        raise ValidationError({"entity": "Unknown entity."})
    from .rules.entities import ADAPTERS
    return Response({
        "entity": entity, "fields": adapter.catalog(), "ops": _OPS,
        "actions": action_catalog(entity),
        "entities": [{"key": k, "label": ad.label} for k, ad in ADAPTERS.items()],
        "triggers": [{"key": c[0], "label": c[1]} for c in Automation.Trigger.choices],
    })


# ── CRUD ──────────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def automations(request):
    _require_admin(request.user)
    if request.method == "GET":
        return Response({"automations": [_payload(a) for a in Automation.objects.all()]})
    a = Automation(created_by=request.user)
    _apply(a, request.data, creating=True)
    a.save()
    return Response(_payload(a), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([permissions.IsAuthenticated])
def automation_detail(request, pk):
    _require_admin(request.user)
    try:
        a = Automation.objects.get(pk=pk)
    except Automation.DoesNotExist:
        raise NotFound("Automation not found.")
    if request.method == "GET":
        return Response(_payload(a))
    if request.method == "DELETE":
        a.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    _apply(a, request.data, creating=False)
    a.save()
    return Response(_payload(a))


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def automation_test(request):
    """Dry-run: how many entities currently match these conditions?"""
    _require_admin(request.user)
    entity = request.data.get("entity") or "submission"
    adapter = get_adapter(entity)
    if adapter is None:
        raise ValidationError({"entity": "Unknown entity."})
    probe = Automation(
        entity=entity, match=(request.data.get("match") if request.data.get("match") in _MATCH else "all"),
        conditions=_clean_conditions(request.data.get("conditions") or [], entity),
    )
    ids = adapter.matched_ids(probe, timezone.now())
    sample = [{k: d[k] for k in ("ref", "title", "state", "context")}
              for d in (adapter.describe(o) for o in adapter.base_qs().filter(id__in=list(ids)[:8]))]
    return Response({"match_count": len(ids), "sample": sample})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def automation_run_now(request, pk):
    _require_admin(request.user)
    try:
        a = Automation.objects.get(pk=pk)
    except Automation.DoesNotExist:
        raise NotFound("Automation not found.")
    return Response(run_automation_now(a))


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def automation_runs(request):
    _require_admin(request.user)
    qs = AutomationRun.objects.select_related("automation")
    if request.query_params.get("automation"):
        qs = qs.filter(automation_id=request.query_params["automation"])
    return Response({"runs": [{
        "id": r.id, "automation_id": r.automation_id, "automation": r.automation.name,
        "trigger": r.trigger, "status": r.status, "detail": r.detail,
        "created_at": r.created_at.isoformat(),
    } for r in qs[:200]]})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def automation_runs_export(request):
    """CSV of the automation run log (reporting)."""
    _require_admin(request.user)
    qs = AutomationRun.objects.select_related("automation")
    if request.query_params.get("automation"):
        qs = qs.filter(automation_id=request.query_params["automation"])
    resp = HttpResponse(content_type="text/csv")
    resp["Content-Disposition"] = 'attachment; filename="scdms-automation-runs.csv"'
    w = csv.writer(resp)
    w.writerow(["When", "Automation", "Trigger", "Status", "Item", "Actions"])
    for r in qs[:5000]:
        actions = " ".join(
            f"{a.get('type')}:{'ok' if a.get('ok') else 'fail'}" for a in (r.detail.get("actions") or [])
        )
        w.writerow([r.created_at.isoformat(), r.automation.name, r.trigger, r.status,
                    r.detail.get("ref", ""), actions])
    return resp

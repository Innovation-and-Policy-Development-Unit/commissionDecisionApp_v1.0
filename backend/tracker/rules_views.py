"""REST API for the multi-entity Watch engine — Rules & Flag Monitor."""

from __future__ import annotations

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from .models import Role, SubmissionFlag, SubmissionRule
from .rules.entities import ADAPTERS, get_adapter

_LEVELS = {c[0] for c in SubmissionRule.Level.choices}
_MATCH = {c[0] for c in SubmissionRule.Match.choices}
_ENTITIES = {c[0] for c in SubmissionRule.Entity.choices}
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
        raise PermissionDenied("Only administrators can manage rules.")


def _valid_fields(entity):
    adapter = get_adapter(entity)
    return {f["key"] for f in adapter.catalog()} if adapter else set()


def _clean_conditions(raw, entity):
    if not isinstance(raw, list):
        raise ValidationError({"conditions": "conditions must be a list."})
    valid = _valid_fields(entity)
    out = []
    for c in raw:
        if isinstance(c, dict) and c.get("field") in valid and c.get("op"):
            out.append({"field": c["field"], "op": c["op"], "value": c.get("value")})
    return out


def _apply_rule_fields(rule, data, *, creating):
    if creating or "entity" in data:
        entity = data.get("entity") or "submission"
        if entity not in _ENTITIES:
            raise ValidationError({"entity": "Invalid entity."})
        rule.entity = entity
    if creating or "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            raise ValidationError({"name": "A name is required."})
        rule.name = name[:200]
    if "description" in data:
        rule.description = (data.get("description") or "").strip()[:300]
    if creating or "level" in data:
        if (data.get("level") or "at_risk") not in _LEVELS:
            raise ValidationError({"level": "Invalid level."})
        rule.level = data.get("level") or "at_risk"
    if creating or "match" in data:
        if (data.get("match") or "all") not in _MATCH:
            raise ValidationError({"match": "Invalid match mode."})
        rule.match = data.get("match") or "all"
    if creating or "conditions" in data:
        rule.conditions = _clean_conditions(data.get("conditions") or [], rule.entity)
    if "is_active" in data:
        rule.is_active = bool(data.get("is_active"))
    if "test_mode" in data:
        rule.test_mode = bool(data.get("test_mode"))
    if "cooldown_minutes" in data:
        try:
            rule.cooldown_minutes = max(0, int(data.get("cooldown_minutes")))
        except (TypeError, ValueError):
            raise ValidationError({"cooldown_minutes": "Must be an integer."})
    if "notify_assignee" in data:
        rule.notify_assignee = bool(data.get("notify_assignee"))
    if "notify_roles" in data:
        roles = data.get("notify_roles") or []
        if not isinstance(roles, list):
            raise ValidationError({"notify_roles": "Must be a list of role keys."})
        rule.notify_roles = [str(r) for r in roles]


def _rule_payload(r, open_count=None):
    return {
        "id": r.id, "name": r.name, "description": r.description,
        "entity": r.entity, "level": r.level, "conditions": r.conditions or [], "match": r.match,
        "is_active": r.is_active, "is_builtin": r.is_builtin, "test_mode": r.test_mode,
        "cooldown_minutes": r.cooldown_minutes, "notify_assignee": r.notify_assignee,
        "notify_roles": r.notify_roles or [], "open_flags": open_count,
        "updated_at": r.updated_at.isoformat(),
    }


def _flag_payload(f):
    adapter = get_adapter(f.rule.entity)
    pl = adapter.payload(f) if adapter else {"ref": "", "title": "", "context": "", "state": "", "link": "", "entity_id": None}
    return {
        "id": f.id, "status": f.status, "level": f.rule.level,
        "rule_id": f.rule_id, "rule_name": f.rule.name, "entity": f.rule.entity,
        "opened_at": f.opened_at.isoformat(),
        "acknowledged_by": (f.acknowledged_by.get_username() if f.acknowledged_by_id else None),
        **pl,
    }


# ── Field catalog ─────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def rule_fields(request):
    _require_admin(request.user)
    entity = request.query_params.get("entity") or "submission"
    adapter = get_adapter(entity)
    if adapter is None:
        raise ValidationError({"entity": "Unknown entity."})
    return Response({
        "entity": entity,
        "fields": adapter.catalog(),
        "ops": _OPS,
        "entities": [{"key": k, "label": a.label} for k, a in ADAPTERS.items()],
    })


# ── Rules CRUD ────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def rules(request):
    _require_admin(request.user)
    if request.method == "GET":
        counts = dict(
            SubmissionFlag.objects.filter(status=SubmissionFlag.Status.OPEN)
            .values("rule_id").annotate(n=Count("id")).values_list("rule_id", "n")
        )
        return Response({"rules": [_rule_payload(r, counts.get(r.id, 0)) for r in SubmissionRule.objects.all()]})

    rule = SubmissionRule(created_by=request.user)
    _apply_rule_fields(rule, request.data, creating=True)
    rule.save()
    return Response(_rule_payload(rule, 0), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([permissions.IsAuthenticated])
def rule_detail(request, pk):
    _require_admin(request.user)
    try:
        rule = SubmissionRule.objects.get(pk=pk)
    except SubmissionRule.DoesNotExist:
        raise NotFound("Rule not found.")

    if request.method == "GET":
        return Response(_rule_payload(rule))
    if request.method == "DELETE":
        if rule.is_builtin:
            raise ValidationError({"detail": "Built-in rules cannot be deleted — disable them instead."})
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    _apply_rule_fields(rule, request.data, creating=False)
    rule.save()
    return Response(_rule_payload(rule))


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def rule_test(request):
    """Dry-run: how many entities would these conditions match right now?"""
    _require_admin(request.user)
    entity = request.data.get("entity") or "submission"
    adapter = get_adapter(entity)
    if adapter is None:
        raise ValidationError({"entity": "Unknown entity."})
    probe = SubmissionRule(
        entity=entity, match=(request.data.get("match") if request.data.get("match") in _MATCH else "all"),
        conditions=_clean_conditions(request.data.get("conditions") or [], entity),
    )
    return Response({"match_count": len(adapter.matched_ids(probe, timezone.now()))})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def rules_run_now(request):
    _require_admin(request.user)
    from .rules.engine import evaluate_all
    return Response(evaluate_all())


# ── Flag Monitor (multi-entity, RBAC-scoped) ──────────────────────────────────

def _scoped_flags(user):
    cond = Q()
    for adapter in ADAPTERS.values():
        cond |= Q(**{f"{adapter.flag_fk}_id__in": adapter.scoped_ids(user)})
    return (
        SubmissionFlag.objects
        .exclude(status=SubmissionFlag.Status.CLEARED)
        .filter(cond)
        .select_related("rule", "submission", "submission__ministry",
                        "commission_task", "commission_task__assigned_manager", "meeting")
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def flags(request):
    qs = _scoped_flags(request.user)
    p = request.query_params
    if p.get("level"):
        qs = qs.filter(rule__level=p["level"])
    if p.get("entity"):
        qs = qs.filter(rule__entity=p["entity"])
    if p.get("rule"):
        qs = qs.filter(rule_id=p["rule"])
    if p.get("status"):
        qs = qs.filter(status=p["status"])

    summary = dict(qs.values("rule__level").annotate(n=Count("id")).values_list("rule__level", "n"))
    return Response({
        "flags": [_flag_payload(f) for f in qs.order_by("rule__level", "-opened_at")[:500]],
        "summary": {
            "critical": summary.get("critical", 0),
            "at_risk": summary.get("at_risk", 0),
            "monitoring": summary.get("monitoring", 0),
            "total": sum(summary.values()),
        },
    })


def _get_scoped_flag(request, pk):
    try:
        flag = SubmissionFlag.objects.select_related("rule", "submission", "commission_task", "meeting").get(pk=pk)
    except SubmissionFlag.DoesNotExist:
        raise NotFound("Flag not found.")
    adapter = get_adapter(flag.rule.entity)
    eid = getattr(flag, f"{adapter.flag_fk}_id") if adapter else None
    if eid is None or not adapter.base_qs().filter(id=eid, id__in=adapter.scoped_ids(request.user)).exists():
        raise NotFound("Flag not found.")
    return flag


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def flag_acknowledge(request, pk):
    flag = _get_scoped_flag(request, pk)
    flag.status = SubmissionFlag.Status.ACKNOWLEDGED
    flag.acknowledged_at = timezone.now()
    flag.acknowledged_by = request.user
    flag.save(update_fields=["status", "acknowledged_at", "acknowledged_by", "updated_at"])
    return Response(_flag_payload(flag))


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def flag_clear(request, pk):
    flag = _get_scoped_flag(request, pk)
    flag.status = SubmissionFlag.Status.CLEARED
    flag.cleared_at = timezone.now()
    flag.save(update_fields=["status", "cleared_at", "updated_at"])
    return Response({"detail": "Flag cleared."})

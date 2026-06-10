"""REST API for SCDMS Intelligence (interactive explorer)."""

from __future__ import annotations

import hashlib
import json
import os
import time

from django.core.cache import cache
from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from .intelligence.datasets import DATASETS, get_dataset
from .intelligence.interpret import interpret_query
from .intelligence.query import CHART_TYPES, execute_query
from .models import Dashboard, IntelligenceFavorite, IntelligenceReport, SavedExploration
from .rbac import rbac_user_has_permission


def _gate(user):
    if user.is_superuser or user.is_staff:
        return
    if not (
        rbac_user_has_permission(user, "view_reports")
        or rbac_user_has_permission(user, "export_reports")
    ):
        raise PermissionDenied("You do not have permission to use SCDMS Intelligence.")


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def intelligence_datasets(request):
    _gate(request.user)
    return Response({"datasets": [ds.to_dict() for ds in DATASETS.values()]})


INTEL_CACHE_TTL = int(os.getenv("INTELLIGENCE_CACHE_TTL", "60"))


def _query_cache_key(user, dataset, spec):
    # Scope by user so the RBAC-filtered result is never shared across users.
    blob = json.dumps({"u": user.id, "d": dataset, "s": spec}, sort_keys=True, default=str)
    return "intel:q:" + hashlib.sha256(blob.encode("utf-8")).hexdigest()


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def intelligence_query(request):
    _gate(request.user)
    dataset = (request.data.get("dataset") or "").strip()
    spec = request.data.get("query_spec") or {}
    if not get_dataset(dataset):
        raise ValidationError({"dataset": f"Unknown dataset '{dataset}'."})
    if not isinstance(spec, dict):
        raise ValidationError({"query_spec": "query_spec must be an object."})

    no_cache = bool(request.data.get("no_cache"))
    key = _query_cache_key(request.user, dataset, spec)
    started = time.monotonic()

    if not no_cache:
        try:
            cached = cache.get(key)
        except Exception:  # noqa: BLE001 — cache outage must never break a query
            cached = None
        if cached is not None:
            cached = {**cached, "meta": {**cached["meta"], "cached": True,
                                         "ms": int((time.monotonic() - started) * 1000)}}
            return Response(cached)

    try:
        result = execute_query(user=request.user, dataset_key=dataset, spec=spec)
    except ValueError as exc:
        raise ValidationError({"detail": str(exc)})
    result["meta"]["ms"] = int((time.monotonic() - started) * 1000)
    result["meta"]["cached"] = False
    try:
        cache.set(key, result, INTEL_CACHE_TTL)
    except Exception:  # noqa: BLE001
        pass
    return Response(result)


def _exploration_payload(e, user):
    return {
        "id": e.id,
        "name": e.name,
        "dataset": e.dataset,
        "spec": e.spec,
        "is_shared": e.is_shared,
        "owner": e.owner_id,
        "owner_name": e.owner.get_username(),
        "is_owner": e.owner_id == user.id,
        "updated_at": e.updated_at.isoformat(),
    }


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def intelligence_explorations(request):
    """List the user's own + shared saved explorations, or create a new one."""
    _gate(request.user)

    if request.method == "GET":
        qs = (
            SavedExploration.objects
            .filter(Q(owner=request.user) | Q(is_shared=True))
            .select_related("owner")
        )
        return Response({"explorations": [_exploration_payload(e, request.user) for e in qs]})

    # POST — create
    name = (request.data.get("name") or "").strip()
    dataset = (request.data.get("dataset") or "").strip()
    spec = request.data.get("spec") or {}
    if not name:
        raise ValidationError({"name": "A name is required."})
    if not get_dataset(dataset):
        raise ValidationError({"dataset": f"Unknown dataset '{dataset}'."})
    if not isinstance(spec, dict):
        raise ValidationError({"spec": "spec must be an object."})
    exploration = SavedExploration.objects.create(
        owner=request.user,
        name=name[:200],
        dataset=dataset,
        spec=spec,
        is_shared=bool(request.data.get("is_shared", False)),
    )
    return Response(_exploration_payload(exploration, request.user), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([permissions.IsAuthenticated])
def intelligence_exploration_detail(request, pk):
    """Update or delete a saved exploration — owner (or staff) only."""
    _gate(request.user)
    try:
        exploration = SavedExploration.objects.select_related("owner").get(pk=pk)
    except SavedExploration.DoesNotExist:
        raise NotFound("Exploration not found.")

    is_staff = request.user.is_superuser or request.user.is_staff
    if exploration.owner_id != request.user.id and not is_staff:
        raise PermissionDenied("Only the owner can modify this exploration.")

    if request.method == "DELETE":
        exploration.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH — partial update of name / spec / dataset / is_shared
    if "name" in request.data:
        name = (request.data.get("name") or "").strip()
        if not name:
            raise ValidationError({"name": "Name cannot be empty."})
        exploration.name = name[:200]
    if "dataset" in request.data:
        dataset = (request.data.get("dataset") or "").strip()
        if not get_dataset(dataset):
            raise ValidationError({"dataset": f"Unknown dataset '{dataset}'."})
        exploration.dataset = dataset
    if "spec" in request.data:
        spec = request.data.get("spec") or {}
        if not isinstance(spec, dict):
            raise ValidationError({"spec": "spec must be an object."})
        exploration.spec = spec
    if "is_shared" in request.data:
        exploration.is_shared = bool(request.data.get("is_shared"))
    exploration.save()
    return Response(_exploration_payload(exploration, request.user))


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def intelligence_interpret(request):
    _gate(request.user)
    dataset = (request.data.get("dataset") or "").strip()
    prompt = (request.data.get("prompt") or "").strip()
    if not get_dataset(dataset):
        raise ValidationError({"dataset": f"Unknown dataset '{dataset}'."})
    spec, err = interpret_query(user_prompt=prompt, dataset_key=dataset)
    if err:
        return Response({"detail": err}, status=502 if "AI" in err else 400)
    return Response({"query_spec": spec})


# ── Dashboards (composed boards of chart tiles) ────────────────────────────────

def _clean_tiles(raw):
    """Validate/normalise a tiles array — chart snapshots or markdown notes."""
    if not isinstance(raw, list):
        raise ValidationError({"tiles": "tiles must be a list."})
    cleaned = []
    for i, t in enumerate(raw):
        if not isinstance(t, dict):
            continue
        ttype = t.get("type") if t.get("type") in ("chart", "markdown") else "chart"
        width = t.get("width") if t.get("width") in ("half", "full") else "half"
        tab = (t.get("tab") or "").strip()[:64]
        base = {"id": str(t.get("id") or f"t{i}"), "width": width, "tab": tab,
                "title": (t.get("title") or "").strip()[:200]}
        if ttype == "markdown":
            cleaned.append({**base, "type": "markdown", "content": str(t.get("content") or "")[:5000]})
            continue
        dataset = (t.get("dataset") or "").strip()
        spec = t.get("spec") or {}
        if not get_dataset(dataset) or not isinstance(spec, dict):
            continue  # drop chart tiles referencing unknown datasets / malformed specs
        chart_type = t.get("chart_type") if t.get("chart_type") in CHART_TYPES else "column"
        cleaned.append({**base, "type": "chart", "dataset": dataset, "spec": spec, "chart_type": chart_type})
    return cleaned


def _clean_tabs(raw):
    if not isinstance(raw, list):
        return []
    out = []
    for i, tb in enumerate(raw):
        if not isinstance(tb, dict):
            continue
        out.append({"id": str(tb.get("id") or f"tab{i}"),
                    "label": (tb.get("label") or "").strip()[:60] or f"Tab {i + 1}"})
    return out


def _clean_tags(raw):
    if not isinstance(raw, list):
        return []
    seen, out = set(), []
    for x in raw:
        s = str(x).strip()[:40]
        if s and s.lower() not in seen:
            seen.add(s.lower())
            out.append(s)
    return out[:20]


def _clean_filters(raw):
    """Validate dashboard native-filter definitions."""
    if not isinstance(raw, list):
        raise ValidationError({"filters": "filters must be a list."})
    cleaned = []
    for i, f in enumerate(raw):
        if not isinstance(f, dict):
            continue
        ftype = f.get("type")
        if ftype not in ("category", "time"):
            continue
        default = f.get("default")
        if not isinstance(default, (str, list)):
            default = None
        cleaned.append({
            "id": str(f.get("id") or f"f{i}"),
            "type": ftype,
            "col": (f.get("col") or "").strip()[:64],
            "label": (f.get("label") or "").strip()[:100],
            "default": default,
        })
    return cleaned


def _dashboard_payload(d, user, is_favorite=False):
    return {
        "id": d.id,
        "name": d.name,
        "description": d.description,
        "tiles": d.tiles or [],
        "filters": d.filters or [],
        "tabs": d.tabs or [],
        "tags": d.tags or [],
        "is_favorite": is_favorite,
        "is_shared": d.is_shared,
        "owner": d.owner_id,
        "owner_name": d.owner.get_username(),
        "is_owner": d.owner_id == user.id,
        "created_at": d.created_at.isoformat(),
        "updated_at": d.updated_at.isoformat(),
    }


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def intelligence_dashboards(request):
    """List the user's own + shared dashboards, or create a new one."""
    _gate(request.user)

    if request.method == "GET":
        qs = (
            Dashboard.objects
            .filter(Q(owner=request.user) | Q(is_shared=True))
            .select_related("owner")
        )
        fav_ids = set(
            IntelligenceFavorite.objects.filter(user=request.user).values_list("dashboard_id", flat=True)
        )
        return Response({"dashboards": [_dashboard_payload(d, request.user, d.id in fav_ids) for d in qs]})

    name = (request.data.get("name") or "").strip()
    if not name:
        raise ValidationError({"name": "A name is required."})
    dashboard = Dashboard.objects.create(
        owner=request.user,
        name=name[:200],
        description=(request.data.get("description") or "").strip(),
        tiles=_clean_tiles(request.data.get("tiles") or []),
        filters=_clean_filters(request.data.get("filters") or []),
        tabs=_clean_tabs(request.data.get("tabs") or []),
        tags=_clean_tags(request.data.get("tags") or []),
        is_shared=bool(request.data.get("is_shared", False)),
    )
    return Response(_dashboard_payload(dashboard, request.user), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([permissions.IsAuthenticated])
def intelligence_dashboard_detail(request, pk):
    """Retrieve (own/shared), update or delete (owner-only) a dashboard."""
    _gate(request.user)
    try:
        dashboard = Dashboard.objects.select_related("owner").get(pk=pk)
    except Dashboard.DoesNotExist:
        raise NotFound("Dashboard not found.")

    is_staff = request.user.is_superuser or request.user.is_staff
    is_owner = dashboard.owner_id == request.user.id

    def _is_fav():
        return IntelligenceFavorite.objects.filter(user=request.user, dashboard=dashboard).exists()

    if request.method == "GET":
        if not (is_owner or dashboard.is_shared or is_staff):
            raise PermissionDenied("You do not have access to this dashboard.")
        return Response(_dashboard_payload(dashboard, request.user, _is_fav()))

    if not (is_owner or is_staff):
        raise PermissionDenied("Only the owner can modify this dashboard.")

    if request.method == "DELETE":
        dashboard.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH — partial update
    if "name" in request.data:
        name = (request.data.get("name") or "").strip()
        if not name:
            raise ValidationError({"name": "Name cannot be empty."})
        dashboard.name = name[:200]
    if "description" in request.data:
        dashboard.description = (request.data.get("description") or "").strip()
    if "tiles" in request.data:
        dashboard.tiles = _clean_tiles(request.data.get("tiles") or [])
    if "filters" in request.data:
        dashboard.filters = _clean_filters(request.data.get("filters") or [])
    if "tabs" in request.data:
        dashboard.tabs = _clean_tabs(request.data.get("tabs") or [])
    if "tags" in request.data:
        dashboard.tags = _clean_tags(request.data.get("tags") or [])
    if "is_shared" in request.data:
        dashboard.is_shared = bool(request.data.get("is_shared"))
    dashboard.save()
    return Response(_dashboard_payload(dashboard, request.user, _is_fav()))


@api_view(["POST", "DELETE"])
@permission_classes([permissions.IsAuthenticated])
def intelligence_dashboard_favorite(request, pk):
    """Star / unstar a dashboard for the current user."""
    _gate(request.user)
    try:
        dashboard = Dashboard.objects.get(pk=pk)
    except Dashboard.DoesNotExist:
        raise NotFound("Dashboard not found.")
    is_staff = request.user.is_superuser or request.user.is_staff
    if not (dashboard.owner_id == request.user.id or dashboard.is_shared or is_staff):
        raise PermissionDenied("You do not have access to this dashboard.")

    if request.method == "DELETE":
        IntelligenceFavorite.objects.filter(user=request.user, dashboard=dashboard).delete()
        return Response({"is_favorite": False})
    IntelligenceFavorite.objects.get_or_create(user=request.user, dashboard=dashboard)
    return Response({"is_favorite": True})


# ── Scheduled reports & alerts ─────────────────────────────────────────────────

_REPORT_FREQ = {"daily", "weekly", "monthly"}
_REPORT_KIND = {"report", "alert"}
_REPORT_OPS = {"gt", "gte", "lt", "lte"}


def _report_payload(r, user):
    return {
        "id": r.id,
        "name": r.name,
        "kind": r.kind,
        "dataset": r.dataset,
        "spec": r.spec,
        "alert_metric": r.alert_metric,
        "alert_operator": r.alert_operator,
        "alert_threshold": r.alert_threshold,
        "frequency": r.frequency,
        "hour": r.hour,
        "day_of_week": r.day_of_week,
        "day_of_month": r.day_of_month,
        "recipients": r.recipients or [],
        "is_active": r.is_active,
        "last_run_at": r.last_run_at.isoformat() if r.last_run_at else None,
        "last_status": r.last_status,
        "last_value": r.last_value,
        "owner": r.owner_id,
        "owner_name": r.owner.get_username(),
        "is_owner": r.owner_id == user.id,
        "updated_at": r.updated_at.isoformat(),
    }


def _apply_report_fields(report, data, *, creating):
    if creating or "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            raise ValidationError({"name": "A name is required."})
        report.name = name[:200]
    if creating or "dataset" in data:
        dataset = (data.get("dataset") or "").strip()
        if not get_dataset(dataset):
            raise ValidationError({"dataset": f"Unknown dataset '{dataset}'."})
        report.dataset = dataset
    if creating or "spec" in data:
        spec = data.get("spec") or {}
        if not isinstance(spec, dict):
            raise ValidationError({"spec": "spec must be an object."})
        report.spec = spec
    if creating or "kind" in data:
        kind = data.get("kind") or "report"
        if kind not in _REPORT_KIND:
            raise ValidationError({"kind": "kind must be 'report' or 'alert'."})
        report.kind = kind
    if creating or "frequency" in data:
        freq = data.get("frequency") or "daily"
        if freq not in _REPORT_FREQ:
            raise ValidationError({"frequency": "Invalid frequency."})
        report.frequency = freq
    if creating or "hour" in data:
        try:
            report.hour = max(0, min(23, int(data.get("hour", 7))))
        except (TypeError, ValueError):
            raise ValidationError({"hour": "hour must be an integer 0–23."})
    if "day_of_week" in data:
        try:
            report.day_of_week = max(0, min(6, int(data.get("day_of_week") or 0)))
        except (TypeError, ValueError):
            raise ValidationError({"day_of_week": "day_of_week must be 0–6."})
    if "day_of_month" in data:
        try:
            report.day_of_month = max(1, min(28, int(data.get("day_of_month") or 1)))
        except (TypeError, ValueError):
            raise ValidationError({"day_of_month": "day_of_month must be 1–28."})
    if creating or "recipients" in data:
        rec = data.get("recipients") or []
        if not isinstance(rec, list):
            raise ValidationError({"recipients": "recipients must be a list of emails."})
        report.recipients = [str(e).strip() for e in rec if str(e).strip()]
    if "is_active" in data:
        report.is_active = bool(data.get("is_active"))
    if "alert_metric" in data:
        report.alert_metric = (data.get("alert_metric") or "").strip()[:64]
    if "alert_operator" in data:
        op = (data.get("alert_operator") or "").strip()
        if op and op not in _REPORT_OPS:
            raise ValidationError({"alert_operator": "Invalid operator."})
        report.alert_operator = op
    if "alert_threshold" in data:
        thr = data.get("alert_threshold")
        if thr in (None, ""):
            report.alert_threshold = None
        else:
            try:
                report.alert_threshold = float(thr)
            except (TypeError, ValueError):
                raise ValidationError({"alert_threshold": "Threshold must be a number."})
    if report.kind == "alert" and (
        not report.alert_metric or not report.alert_operator or report.alert_threshold is None
    ):
        raise ValidationError({"alert": "Alerts need a metric, an operator and a threshold."})


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def intelligence_reports(request):
    """List the user's reports (staff see all), or create a new report / alert."""
    _gate(request.user)
    if request.method == "GET":
        is_staff = request.user.is_superuser or request.user.is_staff
        qs = IntelligenceReport.objects.select_related("owner")
        if not is_staff:
            qs = qs.filter(owner=request.user)
        return Response({"reports": [_report_payload(r, request.user) for r in qs]})

    report = IntelligenceReport(owner=request.user)
    _apply_report_fields(report, request.data, creating=True)
    report.save()
    return Response(_report_payload(report, request.user), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([permissions.IsAuthenticated])
def intelligence_report_detail(request, pk):
    _gate(request.user)
    try:
        report = IntelligenceReport.objects.select_related("owner").get(pk=pk)
    except IntelligenceReport.DoesNotExist:
        raise NotFound("Report not found.")
    is_staff = request.user.is_superuser or request.user.is_staff
    if report.owner_id != request.user.id and not is_staff:
        raise PermissionDenied("Only the owner can access this report.")

    if request.method == "GET":
        return Response(_report_payload(report, request.user))
    if request.method == "DELETE":
        report.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    _apply_report_fields(report, request.data, creating=False)
    report.save()
    return Response(_report_payload(report, request.user))


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def intelligence_report_run(request, pk):
    """Run a report immediately (force-send) — to preview/test delivery."""
    _gate(request.user)
    try:
        report = IntelligenceReport.objects.select_related("owner").get(pk=pk)
    except IntelligenceReport.DoesNotExist:
        raise NotFound("Report not found.")
    if report.owner_id != request.user.id and not (request.user.is_superuser or request.user.is_staff):
        raise PermissionDenied("Only the owner can run this report.")

    from .intelligence.reports import run_report
    outcome = run_report(report, force=True)
    return Response({"detail": "Report run.", "result": outcome, "report": _report_payload(report, request.user)})

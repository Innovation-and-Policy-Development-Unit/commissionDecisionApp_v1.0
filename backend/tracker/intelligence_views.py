"""REST API for SCDMS Intelligence (interactive explorer)."""

from __future__ import annotations

import time

from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from .intelligence.datasets import DATASETS, get_dataset
from .intelligence.interpret import interpret_query
from .intelligence.query import execute_query
from .models import SavedExploration
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
    started = time.monotonic()
    try:
        result = execute_query(user=request.user, dataset_key=dataset, spec=spec)
    except ValueError as exc:
        raise ValidationError({"detail": str(exc)})
    result["meta"]["ms"] = int((time.monotonic() - started) * 1000)
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

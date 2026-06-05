"""REST API for SCDMS Intelligence (interactive explorer)."""

from __future__ import annotations

import time

from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .intelligence.datasets import DATASETS, get_dataset
from .intelligence.interpret import interpret_query
from .intelligence.query import execute_query
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

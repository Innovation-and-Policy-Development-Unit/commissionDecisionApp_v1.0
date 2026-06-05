"""
SCDMS Intelligence semantic layer.

A *dataset* declares the dimensions, time dimensions, and metrics the explorer may
query. This is the whitelist that both the query executor and the UI build on — a user
(or the AI) can never reference a field or aggregation not declared here, and every
dataset's queryset is RBAC-scoped so exploration honours the same visibility as the rest
of SCDMS.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from tracker.models import Classification, RoutedUnit, WorkflowStage


@dataclass
class Dimension:
    key: str            # ORM field path, e.g. "ministry__name" or "current_stage"
    label: str
    kind: str = "category"          # "category" | "time"
    choices: dict | None = None     # code → label for coded fields

    def to_dict(self) -> dict[str, Any]:
        return {"key": self.key, "label": self.label, "kind": self.kind}


@dataclass
class Metric:
    key: str
    label: str
    agg: str = "count"              # "count" | "sum" | "avg"
    column: str | None = None       # ORM field for sum/avg

    def to_dict(self) -> dict[str, Any]:
        return {"key": self.key, "label": self.label, "agg": self.agg}


class Dataset(Protocol):
    key: str
    label: str

    def queryset(self, user): ...
    def dimensions(self) -> list[Dimension]: ...
    def time_dimensions(self) -> list[Dimension]: ...
    def metrics(self) -> list[Metric]: ...


class SubmissionsDataset:
    key = "submissions"
    label = "Submissions"

    def queryset(self, user):
        # Lazy import avoids a circular dependency (views imports models/serializers).
        from tracker.views import _submission_queryset_for

        return _submission_queryset_for(user)

    def dimensions(self) -> list[Dimension]:
        return [
            Dimension("ministry__name", "Ministry"),
            Dimension("department__name", "Department"),
            Dimension("form_category__name", "Form category"),
            Dimension("current_stage", "Stage", choices=dict(WorkflowStage.choices)),
            Dimension("routed_unit", "Routed unit", choices=dict(RoutedUnit.choices)),
            Dimension("classification", "Classification", choices=dict(Classification.choices)),
            Dimension("form_type_code", "Form type"),
        ]

    def time_dimensions(self) -> list[Dimension]:
        return [
            Dimension("created_at", "Created", kind="time"),
            Dimension("received_at", "Received", kind="time"),
            Dimension("registered_at", "Registered", kind="time"),
        ]

    def metrics(self) -> list[Metric]:
        return [Metric("count", "Count", "count")]

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "dimensions": [d.to_dict() for d in self.dimensions()],
            "time_dimensions": [d.to_dict() for d in self.time_dimensions()],
            "metrics": [m.to_dict() for m in self.metrics()],
        }


DATASETS: dict[str, Dataset] = {}


def register_dataset(ds: Dataset) -> None:
    DATASETS[ds.key] = ds


def get_dataset(key: str) -> Dataset | None:
    return DATASETS.get(key)


register_dataset(SubmissionsDataset())

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
from typing import Any, Callable, Protocol

from tracker.models import Classification, RoutedUnit, WorkflowStage


@dataclass
class Dimension:
    key: str            # ORM field path, e.g. "ministry__name" or "current_stage"
    label: str
    kind: str = "category"          # "category" | "time"
    choices: dict | None = None     # code → label for coded fields

    def to_dict(self) -> dict[str, Any]:
        return {"key": self.key, "label": self.label, "kind": self.kind, "choices": self.choices or None}


@dataclass
class Metric:
    key: str
    label: str
    agg: str = "count"              # "count" | "sum" | "avg"
    column: str | None = None       # ORM field for sum/avg
    # Optional custom aggregate factory (overrides agg/column) — lets a dataset
    # declare count-distinct, conditional counts, computed durations, etc. The
    # executor calls it per-request, so values like timezone.now() stay fresh.
    make_agg: Callable[[], Any] | None = None
    # "number" (default) or "duration_days" — the executor converts duration
    # aggregates (timedelta) into a rounded number of days for the chart/grid.
    value_kind: str = "number"

    def to_dict(self) -> dict[str, Any]:
        return {"key": self.key, "label": self.label, "agg": self.agg, "value_kind": self.value_kind}


class Dataset(Protocol):
    key: str
    label: str

    def queryset(self, user): ...
    def dimensions(self) -> list[Dimension]: ...
    def time_dimensions(self) -> list[Dimension]: ...
    def metrics(self) -> list[Metric]: ...


class BaseDataset:
    """Shared serialisation for the dataset panel (dimensions/metrics whitelist)."""

    key: str
    label: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "dimensions": [d.to_dict() for d in self.dimensions()],
            "time_dimensions": [d.to_dict() for d in self.time_dimensions()],
            "metrics": [m.to_dict() for m in self.metrics()],
        }


class SubmissionsDataset(BaseDataset):
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
        from django.db.models import (
            Avg, Count, DurationField, ExpressionWrapper, F, Q,
        )
        from django.utils import timezone

        return [
            Metric("count", "Count", "count"),
            Metric(
                "distinct_ministries", "Ministries (distinct)",
                make_agg=lambda: Count("ministry", distinct=True),
            ),
            Metric(
                "distinct_form_types", "Form types (distinct)",
                make_agg=lambda: Count("form_type_code", distinct=True),
            ),
            Metric(
                "overdue_count", "Overdue assessments",
                make_agg=lambda: Count(
                    "id",
                    filter=Q(
                        current_stage=WorkflowStage.UNDER_ASSESSMENT,
                        assessment_deadline_at__lt=timezone.now(),
                    ),
                ),
            ),
            Metric(
                "avg_turnaround_days", "Avg turnaround (days)",
                value_kind="duration_days",
                make_agg=lambda: Avg(
                    ExpressionWrapper(
                        F("registered_at") - F("received_at"),
                        output_field=DurationField(),
                    )
                ),
            ),
        ]


class MeetingsDataset(BaseDataset):
    """Commission sittings — agenda load, status, and capacity across meetings.

    Not ministry-firewalled (sittings are PSC-internal); access is gated by the
    `view_reports` permission on the Intelligence endpoints. Each meeting carries
    a subquery-annotated `agenda_item_count` so agenda-load metrics aggregate
    correctly without join inflation.
    """

    key = "meetings"
    label = "Commission sittings"

    def queryset(self, user):
        from django.db.models import Count, IntegerField, OuterRef, Subquery
        from django.db.models.functions import Coalesce

        from tracker.models import AgendaItem, Meeting

        agenda_count = Coalesce(
            Subquery(
                AgendaItem.objects.filter(meeting=OuterRef("pk"))
                .values("meeting")
                .annotate(c=Count("id"))
                .values("c"),
                output_field=IntegerField(),
            ),
            0,
        )
        return Meeting.objects.annotate(agenda_item_count=agenda_count)

    def dimensions(self) -> list[Dimension]:
        from tracker.models import AgendaStatus, MeetingStatus, MeetingType

        return [
            Dimension("type", "Type", choices=dict(MeetingType.choices)),
            Dimension("status", "Status", choices=dict(MeetingStatus.choices)),
            Dimension("agenda_status", "Agenda status", choices=dict(AgendaStatus.choices)),
            Dimension("venue", "Venue"),
        ]

    def time_dimensions(self) -> list[Dimension]:
        return [
            Dimension("date", "Sitting date", kind="time"),
            Dimension("created_at", "Created", kind="time"),
        ]

    def metrics(self) -> list[Metric]:
        from django.db.models import Avg, Count, Sum

        return [
            Metric("count", "Sittings", "count"),
            Metric(
                "agenda_items_total", "Agenda items (total)",
                make_agg=lambda: Sum("agenda_item_count"),
            ),
            Metric(
                "avg_agenda_items", "Avg agenda items / sitting",
                make_agg=lambda: Avg("agenda_item_count"),
            ),
            Metric(
                "distinct_venues", "Venues (distinct)",
                make_agg=lambda: Count("venue", distinct=True),
            ),
        ]


DATASETS: dict[str, Dataset] = {}


def register_dataset(ds: Dataset) -> None:
    DATASETS[ds.key] = ds


def get_dataset(key: str) -> Dataset | None:
    return DATASETS.get(key)


register_dataset(SubmissionsDataset())
register_dataset(MeetingsDataset())

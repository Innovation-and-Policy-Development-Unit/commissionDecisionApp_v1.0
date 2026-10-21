"""
Stage flow ("Where do matters wait?") domain for the Smart Report engine.

Reconstructs how long matters spend in each workflow stage from WorkflowEvent
timestamps — the data the audit (P2-08) noted already exists but was never reported on.
Scoped with the same RBAC queryset as the Submissions domain, so a user only ever sees
timing for matters they could already open.

Dwell definition: a matter enters a stage when an event moves it there and leaves when
the next event moves it on. Closed dwells feed the median / 90th-percentile figures;
matters still sitting in a stage are reported separately as "waiting now" so open-ended
waits do not distort the closed-stage statistics. Ministry-side pre-lodgement stages
(drafts, DG endorsement) are excluded: this report is about the PSC pipeline.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import timedelta
from typing import Any

from django.utils import timezone

from tracker.models import RoutedUnit, WorkflowEvent, WorkflowStage

from ._common import (
    DECISION_STAGES,
    LODGE_STAGES,
    PRE_LODGE_STAGES,
    days_between,
    median,
    parse_date,
    percentile,
)
from .base import ResolvedDataset, register_resolver

MAX_OPEN_ROWS = 200
MIN_SAMPLE = 3  # stages with fewer closed dwells are not named "slowest"
LONG_WAIT_DAYS = 30
_CHUNK = 5000

_STAGE_LABELS = dict(WorkflowStage.choices)
_UNIT_LABELS = dict(RoutedUnit.choices)

# Resting/outcome stages: a matter sitting here is not "waiting" on anyone.
RESTING_STAGES = frozenset({
    WorkflowStage.APPROVED,
    WorkflowStage.NOTED,
    WorkflowStage.NOT_APPROVED,
    WorkflowStage.REJECTED,
    WorkflowStage.RETURNED,
    WorkflowStage.IMPLEMENTATION_REPORT,
    WorkflowStage.RECALLED,
})


def _stage_label(stage: str) -> str:
    return _STAGE_LABELS.get(stage, stage)


def _ranked(values: dict[str, float], n: int = 15) -> list[dict[str, Any]]:
    ranked = sorted(values.items(), key=lambda kv: -kv[1])[:n]
    return [
        {"name": _stage_label(stage), "value": int(val) if float(val).is_integer() else round(val, 1)}
        for stage, val in ranked
    ]


class StageFlowResolver:
    key = "stage_flow"

    vocab = {
        "kpi_labels": {
            "matters_in_scope": "Matters in scope",
            "open_now": "Waiting now",
            "decided_total": "Decided",
            "median_end_to_end_days": "Median days to decision",
            "p90_end_to_end_days": "90th percentile days to decision",
            "slowest_stage": "Slowest stage",
            "slowest_stage_median_days": "Slowest stage median (days)",
            "longest_open_days": "Longest current wait (days)",
            "waiting_over_30_days": "Waiting over 30 days",
        },
        "list_sources": {
            "stage_median_days", "stage_p90_days", "stage_open_now",
            "stage_oldest_open_days", "time_share_by_stage", "open_by_unit",
        },
        "table_columns": [
            "reference_number", "title", "ministry", "stage", "unit", "days_in_stage", "days_open",
        ],
        "column_labels": {
            "reference_number": "Reference",
            "title": "Title",
            "ministry": "Ministry",
            "stage": "Waiting at",
            "unit": "Unit",
            "days_in_stage": "Days in this stage",
            "days_open": "Days since lodged",
        },
        "default_table_columns": ["reference_number", "title", "stage", "unit", "days_in_stage"],
        "default_kpis": ["matters_in_scope", "open_now", "median_end_to_end_days"],
        "default_charts": [("stage_median_days", "bar", "Median days in each stage")],
    }

    def param_schema(self) -> dict[str, str]:
        return {
            "date_from": "date", "date_to": "date", "ministry_id": "int",
            "routed_unit": "str", "include_test": "bool",
        }

    def _queryset(self, *, user, params: dict[str, Any]):
        from tracker.views import _submission_queryset_for  # lazy: views imports models

        qs = _submission_queryset_for(user).prefetch_related(None).select_related(None)
        start = parse_date(params.get("date_from"))
        end = parse_date(params.get("date_to"))
        if start:
            qs = qs.filter(created_at__gte=start)
        if end:
            qs = qs.filter(created_at__lt=end + timedelta(days=1))
        if params.get("ministry_id"):
            qs = qs.filter(ministry_id=params["ministry_id"])
        if params.get("routed_unit"):
            qs = qs.filter(routed_unit=params["routed_unit"])
        if not params.get("include_test"):
            qs = qs.filter(is_test=False)
        return qs

    def resolve(self, *, user, params: dict[str, Any]) -> ResolvedDataset:
        now = timezone.now()
        qs = self._queryset(user=user, params=params)
        subs = {
            s["id"]: s
            for s in qs.values(
                "id", "reference_number", "title", "ministry__name",
                "current_stage", "routed_unit",
            )
        }

        events_by_sub: dict[int, list[tuple[str, Any]]] = defaultdict(list)
        sub_ids = list(subs)
        for i in range(0, len(sub_ids), _CHUNK):
            chunk = sub_ids[i:i + _CHUNK]
            for sub_id, stage, at in (
                WorkflowEvent.objects.filter(submission_id__in=chunk)
                .order_by("created_at", "id")
                .values_list("submission_id", "new_stage", "created_at")
            ):
                events_by_sub[sub_id].append((stage, at))

        closed: dict[str, list[float]] = defaultdict(list)
        open_waits: dict[str, list[float]] = defaultdict(list)
        open_by_unit: Counter = Counter()
        end_to_end: list[float] = []
        open_rows: list[dict[str, Any]] = []

        for sub_id, sub in subs.items():
            events = events_by_sub.get(sub_id) or []
            if not events:
                continue

            for (stage, entered), (_, left) in zip(events, events[1:]):
                if stage not in PRE_LODGE_STAGES:
                    closed[stage].append(days_between(entered, left))

            lodged_at = next((at for st, at in events if st in LODGE_STAGES), None)
            if lodged_at:
                decided_at = next(
                    (at for st, at in events if st in DECISION_STAGES and at >= lodged_at), None
                )
                if decided_at:
                    end_to_end.append(days_between(lodged_at, decided_at))

            last_stage, last_at = events[-1]
            if (
                last_stage == sub["current_stage"]
                and last_stage not in PRE_LODGE_STAGES
                and last_stage not in RESTING_STAGES
            ):
                waited = days_between(last_at, now)
                open_waits[last_stage].append(waited)
                unit = _UNIT_LABELS.get(sub["routed_unit"], "") if sub["routed_unit"] else ""
                open_by_unit[unit or "Unrouted"] += 1
                open_rows.append({
                    "reference_number": sub["reference_number"],
                    "title": sub["title"],
                    "ministry": sub["ministry__name"] or "",
                    "stage": _stage_label(last_stage),
                    "unit": unit,
                    "days_in_stage": round(waited, 1),
                    "days_open": round(days_between(lodged_at, now), 1) if lodged_at else "",
                })

        # ── Stage statistics (closed dwells) ─────────────────────────────────
        stage_median = {st: median(v) for st, v in closed.items() if v}
        stage_p90 = {st: percentile(v, 90) for st, v in closed.items() if v}
        stage_total = {st: sum(v) for st, v in closed.items() if v}
        sampled = {st: m for st, m in stage_median.items() if len(closed[st]) >= MIN_SAMPLE}
        slowest = max(sampled, key=sampled.get) if sampled else None

        total_time = sum(stage_total.values()) or 1.0
        shares = sorted(stage_total.items(), key=lambda kv: -kv[1])
        time_share = [
            {"name": _stage_label(st), "value": round(100 * t / total_time, 1)} for st, t in shares[:8]
        ]
        if len(shares) > 8:
            other = sum(t for _, t in shares[8:])
            time_share.append({"name": "All other stages", "value": round(100 * other / total_time, 1)})

        open_rows.sort(key=lambda r: -r["days_in_stage"])
        all_open = [d for waits in open_waits.values() for d in waits]

        aggregates = {
            "matters_in_scope": len(subs),
            "open_now": len(all_open),
            "decided_total": len(end_to_end),
            "median_end_to_end_days": median(end_to_end) or 0,
            "p90_end_to_end_days": percentile(end_to_end, 90) or 0,
            "slowest_stage": _stage_label(slowest) if slowest else "n/a",
            "slowest_stage_median_days": sampled[slowest] if slowest else 0,
            "longest_open_days": round(max(all_open), 1) if all_open else 0,
            "waiting_over_30_days": sum(1 for d in all_open if d > LONG_WAIT_DAYS),
            "stage_median_days": _ranked({st: v for st, v in stage_median.items() if v is not None}),
            "stage_p90_days": _ranked({st: v for st, v in stage_p90.items() if v is not None}),
            "stage_open_now": _ranked({st: float(len(v)) for st, v in open_waits.items()}),
            "stage_oldest_open_days": _ranked({st: max(v) for st, v in open_waits.items()}),
            "time_share_by_stage": time_share,
            "open_by_unit": [
                {"name": unit, "value": n} for unit, n in open_by_unit.most_common()
            ],
        }

        meta = {
            "row_count": len(open_rows),
            "rows_shown": min(len(open_rows), MAX_OPEN_ROWS),
            "truncated": len(open_rows) > MAX_OPEN_ROWS,
            "scope": "stage_flow",
            "filters": {k: v for k, v in params.items() if v not in (None, "")},
            "generated_at": timezone.localtime().strftime("%d %B %Y %H:%M"),
            "notes": [
                "Time in a stage runs from the event that moved a matter into it to the event that "
                "moved it on. Statistics use completed stays only; matters still waiting are counted "
                "separately under 'waiting now'.",
                "Ministry-side drafting and endorsement stages are excluded. Outcome stages "
                "(Approved, Noted, Not Approved, Rejected) and closed matters are never counted as waiting.",
                f"A stage is only named 'slowest' once at least {MIN_SAMPLE} completed stays exist.",
                "The detail table lists the matters waiting longest, up to "
                f"{MAX_OPEN_ROWS}. Days are calendar days.",
                "Test submissions are " + ("included." if params.get("include_test") else "excluded."),
            ],
        }
        return ResolvedDataset(rows=open_rows[:MAX_OPEN_ROWS], aggregates=aggregates, meta=meta)


register_resolver(StageFlowResolver())

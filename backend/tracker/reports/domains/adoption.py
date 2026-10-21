"""
Pilot adoption & readiness domain for the Smart Report engine.

One row per ministry: are people signing in, are matters being lodged, how often do they
come back for clarification, and how long do decisions take. It exists to give the
pilot go/no-go checkpoint evidence rather than anecdote.

Account activity comes from ``User.last_login`` (refreshed on every token refresh), not
AuditLog LOGIN rows, which go stale for 2FA / PIN sign-ins. Lodgement, return and
decision moments come from WorkflowEvent. OPSC-internal submissions and attached
child forms are excluded so a ministry is only measured on its own matters.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import timedelta
from typing import Any

from django.core.exceptions import PermissionDenied
from django.utils import timezone

from tracker.models import Ministry, Profile, Submission, WorkflowEvent, WorkflowStage

from ._common import (
    DECISION_STAGES,
    LODGE_STAGES,
    PRE_LODGE_STAGES,
    in_period,
    is_psc_staff,
    median,
    period_bounds,
)
from .base import ResolvedDataset, register_resolver

ACTIVE_WINDOW_DAYS = 30
STALLED_DRAFT_DAYS = 14
LOW_FIRST_TIME_RIGHT_PCT = 60.0
STALLED_DRAFTS_NEEDING_SUPPORT = 3

STATUS_NOT_STARTED = "Not started"
STATUS_ONBOARDING = "Onboarding"
STATUS_ACTIVE = "Active"
STATUS_NEEDS_SUPPORT = "Needs support"
STATUS_ORDER = [STATUS_ACTIVE, STATUS_NEEDS_SUPPORT, STATUS_ONBOARDING, STATUS_NOT_STARTED]
# Table order: the ministries that most need attention first.
_ATTENTION_ORDER = [STATUS_NEEDS_SUPPORT, STATUS_NOT_STARTED, STATUS_ONBOARDING, STATUS_ACTIVE]

_CHUNK = 5000


def _pct(part: int, whole: int) -> float | None:
    return round(100 * part / whole, 1) if whole else None


def _status(*, lodged: int, active_users: int, first_time_right: float | None, stalled: int) -> str:
    if lodged == 0:
        return STATUS_ONBOARDING if active_users else STATUS_NOT_STARTED
    if (first_time_right is not None and first_time_right < LOW_FIRST_TIME_RIGHT_PCT) or (
        stalled >= STALLED_DRAFTS_NEEDING_SUPPORT
    ):
        return STATUS_NEEDS_SUPPORT
    return STATUS_ACTIVE


class PilotAdoptionResolver:
    key = "pilot_adoption"

    vocab = {
        "kpi_labels": {
            "ministries_total": "Ministries with accounts",
            "ministries_active": "Ministries active",
            "ministries_needs_support": "Ministries needing support",
            "ministries_not_started": "Ministries not started",
            "accounts_total": "User accounts",
            "active_users": "Active users (30 days)",
            "activation_rate": "Activation rate (%)",
            "never_logged_in": "Never signed in",
            "lodged_total": "Matters lodged",
            "first_time_right_pct": "First-time-right (%)",
            "median_turnaround_days": "Median days to decision",
            "stalled_drafts": "Stalled drafts",
        },
        "list_sources": {
            "adoption_status", "lodged_by_ministry", "active_users_by_ministry",
            "returns_by_ministry", "lodged_by_month",
        },
        "table_columns": [
            "ministry", "accounts", "active_users", "never_logged_in", "lodged", "returned",
            "first_time_right_pct", "decided", "median_turnaround_days", "stalled_drafts", "status",
        ],
        "column_labels": {
            "ministry": "Ministry",
            "accounts": "Accounts",
            "active_users": "Active (30 d)",
            "never_logged_in": "Never signed in",
            "lodged": "Lodged",
            "returned": "Returned",
            "first_time_right_pct": "First-time-right (%)",
            "decided": "Decided",
            "median_turnaround_days": "Median days to decision",
            "stalled_drafts": "Stalled drafts",
            "status": "Status",
        },
        "default_table_columns": [
            "ministry", "accounts", "active_users", "lodged", "first_time_right_pct", "status",
        ],
        "default_kpis": ["ministries_total", "ministries_active", "lodged_total"],
        "default_charts": [("adoption_status", "pie", "Ministries by adoption status")],
    }

    def param_schema(self) -> dict[str, str]:
        return {"date_from": "date", "date_to": "date", "include_test": "bool"}

    def authorize(self, user) -> bool:
        return is_psc_staff(user)

    def resolve(self, *, user, params: dict[str, Any]) -> ResolvedDataset:
        if not self.authorize(user):
            raise PermissionDenied("The pilot adoption scorecard is for PSC staff only.")

        now = timezone.now()
        start, end = period_bounds(params)
        include_test = bool(params.get("include_test"))
        act_end = end or now
        act_start = act_end - timedelta(days=ACTIVE_WINDOW_DAYS)

        ministry_names = dict(Ministry.objects.values_list("id", "name"))

        # ── Accounts and sign-in activity ────────────────────────────────────
        accounts: Counter = Counter()
        never: Counter = Counter()
        active: Counter = Counter()
        for ministry_id, last_login in Profile.objects.filter(
            ministry__isnull=False, user__is_active=True
        ).values_list("ministry_id", "user__last_login"):
            accounts[ministry_id] += 1
            if last_login is None:
                never[ministry_id] += 1
            elif act_start <= last_login < act_end:
                active[ministry_id] += 1

        # ── Matters: lodged / returned / decided ─────────────────────────────
        sub_qs = Submission.objects.filter(is_internal=False, is_attachment=False)
        if not include_test:
            sub_qs = sub_qs.filter(is_test=False)
        subs = list(sub_qs.values("id", "ministry_id", "current_stage", "received_at", "updated_at"))

        first_lodged: dict[int, Any] = {}
        returned_ids: set[int] = set()
        first_decided: dict[int, list] = defaultdict(list)
        wanted = [*LODGE_STAGES, WorkflowStage.RETURNED_FOR_CLARIFICATION, *DECISION_STAGES]
        sub_ids = [s["id"] for s in subs]
        for i in range(0, len(sub_ids), _CHUNK):
            chunk = sub_ids[i:i + _CHUNK]
            events = (
                WorkflowEvent.objects.filter(submission_id__in=chunk, new_stage__in=wanted)
                .order_by("created_at")
                .values_list("submission_id", "new_stage", "created_at")
            )
            for sub_id, stage, at in events:
                if stage in LODGE_STAGES:
                    first_lodged.setdefault(sub_id, at)
                elif stage == WorkflowStage.RETURNED_FOR_CLARIFICATION:
                    returned_ids.add(sub_id)
                else:
                    first_decided[sub_id].append(at)

        lodged: Counter = Counter()
        returned: Counter = Counter()
        decided: Counter = Counter()
        stalled: Counter = Counter()
        turnarounds: dict[int, list[float]] = defaultdict(list)
        all_turnarounds: list[float] = []
        lodged_by_month: Counter = Counter()
        stalled_cutoff = now - timedelta(days=STALLED_DRAFT_DAYS)

        for s in subs:
            mid = s["ministry_id"]
            if s["current_stage"] in PRE_LODGE_STAGES and s["updated_at"] and s["updated_at"] < stalled_cutoff:
                stalled[mid] += 1
            lodged_at = first_lodged.get(s["id"])
            if lodged_at is None and s["current_stage"] not in PRE_LODGE_STAGES:
                lodged_at = s["received_at"]
            if lodged_at is None or not in_period(lodged_at, start, end):
                continue
            lodged[mid] += 1
            lodged_by_month[lodged_at.strftime("%Y-%m")] += 1
            if s["id"] in returned_ids:
                returned[mid] += 1
            decisions = [d for d in first_decided.get(s["id"], []) if d >= lodged_at]
            if decisions:
                decided[mid] += 1
                days = (min(decisions) - lodged_at).total_seconds() / 86400
                turnarounds[mid].append(days)
                all_turnarounds.append(days)

        # ── Per-ministry rows ────────────────────────────────────────────────
        rows: list[dict[str, Any]] = []
        for mid in sorted(set(accounts) | set(lodged) | set(stalled), key=lambda m: ministry_names.get(m, "")):
            ftr = _pct(lodged[mid] - returned[mid], lodged[mid])
            rows.append({
                "ministry": ministry_names.get(mid, f"Ministry #{mid}"),
                "accounts": accounts[mid],
                "active_users": active[mid],
                "never_logged_in": never[mid],
                "lodged": lodged[mid],
                "returned": returned[mid],
                "first_time_right_pct": ftr if ftr is not None else "",
                "decided": decided[mid],
                "median_turnaround_days": median(turnarounds[mid]) if turnarounds[mid] else "",
                "stalled_drafts": stalled[mid],
                "status": _status(
                    lodged=lodged[mid], active_users=active[mid],
                    first_time_right=ftr, stalled=stalled[mid],
                ),
            })
        rows.sort(key=lambda r: (_ATTENTION_ORDER.index(r["status"]), r["ministry"]))

        # ── Aggregates ───────────────────────────────────────────────────────
        status_counts = Counter(r["status"] for r in rows)
        total_accounts = sum(accounts.values())
        total_active = sum(active.values())
        total_lodged = sum(lodged.values())
        total_returned = sum(returned.values())

        def top(counter_key: str, n: int = 20) -> list[dict[str, Any]]:
            ranked = sorted(
                ((r["ministry"], r[counter_key]) for r in rows if r[counter_key]),
                key=lambda kv: -kv[1],
            )
            return [{"name": name, "value": val} for name, val in ranked[:n]]

        aggregates = {
            "ministries_total": len(rows),
            "ministries_active": status_counts[STATUS_ACTIVE],
            "ministries_needs_support": status_counts[STATUS_NEEDS_SUPPORT],
            "ministries_not_started": status_counts[STATUS_NOT_STARTED],
            "accounts_total": total_accounts,
            "active_users": total_active,
            "activation_rate": _pct(total_active, total_accounts) or 0,
            "never_logged_in": sum(never.values()),
            "lodged_total": total_lodged,
            "first_time_right_pct": _pct(total_lodged - total_returned, total_lodged) or 0,
            "median_turnaround_days": median(all_turnarounds) or 0,
            "stalled_drafts": sum(stalled.values()),
            "adoption_status": [
                {"name": st, "value": status_counts[st]} for st in STATUS_ORDER if status_counts[st]
            ],
            "lodged_by_ministry": top("lodged"),
            "active_users_by_ministry": top("active_users"),
            "returns_by_ministry": top("returned"),
            "lodged_by_month": [
                {"name": month, "value": count} for month, count in sorted(lodged_by_month.items())
            ],
        }

        meta = {
            "row_count": len(rows),
            "rows_shown": len(rows),
            "truncated": False,
            "scope": "pilot_adoption",
            "filters": {k: v for k, v in params.items() if v not in (None, "")},
            "generated_at": timezone.localtime().strftime("%d %B %Y %H:%M"),
            "notes": [
                f"Active users are accounts that signed in during the {ACTIVE_WINDOW_DAYS} days up to "
                f"{timezone.localtime(act_end).strftime('%d %B %Y')}; the date filter does not change this window.",
                "Lodged counts matters that reached the PSC within the date range. OPSC-internal "
                "submissions and attached child forms are excluded."
                + (" Test submissions are included." if include_test else " Test submissions are excluded."),
                "First-time-right is the share of lodged matters never returned for clarification.",
                "Median days to decision runs from lodgement to the first Approved, Noted, Not Approved "
                "or Rejected outcome.",
                f"Stalled drafts are ministry-side drafts untouched for {STALLED_DRAFT_DAYS}+ days.",
                f"Status: Not started = nothing lodged and nobody active; Onboarding = people signing in "
                f"but nothing lodged; Needs support = first-time-right below {LOW_FIRST_TIME_RIGHT_PCT:.0f}% "
                f"or {STALLED_DRAFTS_NEEDING_SUPPORT}+ stalled drafts; otherwise Active.",
            ],
        }
        return ResolvedDataset(rows=rows, aggregates=aggregates, meta=meta)


register_resolver(PilotAdoptionResolver())

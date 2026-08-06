"""
Staff workload rollup — submissions and tasks per officer/unit, age-weighted.

Feeds the Workload Dashboard and the "assign to unit principal" decision:
the assignable-officers list is enriched with each candidate's current load
so allocation happens with the numbers in view.

Weighting: an active submission contributes 1 + min(age_days, 21) / 7 to its
officer's weighted load — a fresh paper counts 1, a three-week-old paper
counts 4. Co-assignments count at half weight. The formula is intentionally
simple enough to explain in one sentence to a unit manager.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

from django.utils import timezone

DURATION_WINDOW_DAYS = 180

# Stages that constitute "active" PSC-side work (matches workload_officers_view)
ACTIVE_STAGES = [
    "submitted",
    "secretary_review",
    "manager_checklist_review",
    "under_assessment",
    "forwarded_to_commission",
]

OPEN_TASK_STATUSES = ["open", "in_progress"]


def _age_days(submission_row, now) -> int:
    anchor = submission_row["assigned_at"] or submission_row["received_at"]
    if not anchor:
        return 0
    return max(0, (now - anchor).days)


def _age_weight(age_days: int) -> float:
    return 1.0 + min(age_days, 21) / 7.0


def _age_bucket(age_days: int) -> str:
    if age_days < 7:
        return "fresh"
    if age_days <= 21:
        return "aging"
    return "stale"


def _round(value: float) -> float:
    return round(value, 1)


def officer_load_index(user_ids=None) -> dict[int, dict]:
    """Current load per officer: active submissions (age-weighted),
    co-assignments, and open post-decision tasks.

    Returns {user_id: {active_count, weighted_load, co_assigned_count,
    open_tasks, overdue_tasks, buckets}} — only users with any load appear.
    """
    from tracker.models import CommissionTask, Submission, SubmissionCoAssignment

    now = timezone.now()
    today = now.date()
    index: dict[int, dict] = defaultdict(lambda: {
        "active_count": 0,
        "weighted_load": 0.0,
        "co_assigned_count": 0,
        "open_tasks": 0,
        "overdue_tasks": 0,
        "buckets": {"fresh": 0, "aging": 0, "stale": 0},
    })

    primary = Submission.objects.filter(
        current_stage__in=ACTIVE_STAGES,
        assigned_to_id__isnull=False,
        is_attachment=False,
    )
    if user_ids is not None:
        primary = primary.filter(assigned_to_id__in=user_ids)
    for row in primary.values("assigned_to_id", "assigned_at", "received_at"):
        age = _age_days(row, now)
        entry = index[row["assigned_to_id"]]
        entry["active_count"] += 1
        entry["weighted_load"] += _age_weight(age)
        entry["buckets"][_age_bucket(age)] += 1

    co = SubmissionCoAssignment.objects.filter(
        submission__current_stage__in=ACTIVE_STAGES,
        submission__is_attachment=False,
    )
    if user_ids is not None:
        co = co.filter(principal_id__in=user_ids)
    for row in co.values(
        "principal_id", "submission__assigned_at", "submission__received_at",
    ):
        age = _age_days(
            {"assigned_at": row["submission__assigned_at"],
             "received_at": row["submission__received_at"]},
            now,
        )
        entry = index[row["principal_id"]]
        entry["co_assigned_count"] += 1
        entry["weighted_load"] += _age_weight(age) / 2.0

    # Open tasks: a task loads everyone actively responsible for it —
    # the m2m staff (or legacy single staff), and the manager.
    tasks = CommissionTask.objects.filter(status__in=OPEN_TASK_STATUSES)
    task_rows = list(
        tasks.values("id", "assigned_manager_id", "assigned_staff_id", "due_date")
    )
    m2m = defaultdict(set)
    through = CommissionTask.assigned_staff_m2m.through
    for task_id, uid in through.objects.filter(
        commissiontask_id__in=[t["id"] for t in task_rows]
    ).values_list("commissiontask_id", "user_id"):
        m2m[task_id].add(uid)

    for row in task_rows:
        responsible = set(m2m.get(row["id"], set()))
        if not responsible and row["assigned_staff_id"]:
            responsible.add(row["assigned_staff_id"])
        responsible.add(row["assigned_manager_id"])
        overdue = bool(row["due_date"] and row["due_date"] < today)
        for uid in responsible:
            if uid is None or (user_ids is not None and uid not in user_ids):
                continue
            index[uid]["open_tasks"] += 1
            if overdue:
                index[uid]["overdue_tasks"] += 1

    for entry in index.values():
        entry["weighted_load"] = _round(entry["weighted_load"])
    return dict(index)


def _assessment_durations(cutoff) -> tuple[dict[int, list], dict[str, list]]:
    """Days from assessment start to leaving under_assessment, grouped by
    assigned officer and by routed unit, for assessments completed since
    ``cutoff``."""
    from tracker.models import WorkflowEvent

    by_officer: dict[int, list] = defaultdict(list)
    by_unit: dict[str, list] = defaultdict(list)

    events = (
        WorkflowEvent.objects.filter(
            previous_stage="under_assessment",
            created_at__gte=cutoff,
        )
        .exclude(new_stage="under_assessment")
        .select_related("submission")
        .order_by("submission_id", "created_at")
    )
    seen = set()
    for event in events:
        if event.submission_id in seen:
            continue  # first exit per submission only
        seen.add(event.submission_id)
        sub = event.submission
        if not sub.assessment_started_at:
            continue
        days = max(0, (event.created_at - sub.assessment_started_at).days)
        if sub.assigned_to_id:
            by_officer[sub.assigned_to_id].append(days)
        if sub.routed_unit:
            by_unit[sub.routed_unit].append(days)
    return by_officer, by_unit


def _avg(values: list) -> float | None:
    if not values:
        return None
    return _round(sum(values) / len(values))


def build_workload_summary() -> dict:
    """Full dashboard payload: per-officer and per-unit load + durations."""
    from django.contrib.auth import get_user_model

    from tracker.models import CommissionTask, Role, Submission

    User = get_user_model()
    now = timezone.now()
    cutoff = now - timedelta(days=DURATION_WINDOW_DAYS)

    staff_roles = [
        Role.PSC_OFFICER, Role.PSC_ADMIN, Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER,
        Role.PSC_MANAGER, Role.PRINCIPAL_OFFICER, Role.SENIOR_OFFICER,
        Role.VIPAM_PRINCIPAL, Role.HR_UNIT_PRINCIPAL, Role.ODU_PRINCIPAL,
        Role.COMPLIANCE_PRINCIPAL,
        Role.VIPAM_MANAGER, Role.HR_UNIT_MANAGER, Role.ODU_MANAGER,
        Role.COMPLIANCE_MANAGER, Role.COMPLIANCE_SENIOR, Role.CSU_MANAGER,
    ]
    staff = list(
        User.objects.filter(is_active=True, psc_profile__role__in=staff_roles)
        .select_related("psc_profile")
        .order_by("first_name", "username")
    )
    loads = officer_load_index()
    dur_by_officer, dur_by_unit = _assessment_durations(cutoff)

    # Task completion time (approximation: created → last update on completion)
    completed_tasks = CommissionTask.objects.filter(
        status="completed", updated_at__gte=cutoff,
    ).values("created_at", "updated_at")
    task_days = [
        max(0, (t["updated_at"] - t["created_at"]).days) for t in completed_tasks
    ]

    officers = []
    for user in staff:
        load = loads.get(user.id, {})
        if not load and not dur_by_officer.get(user.id):
            # Surface everyone assignable even with zero load — an empty
            # plate is exactly what a manager wants to see.
            load = {}
        officers.append({
            "id": user.id,
            "username": user.username,
            "full_name": user.get_full_name() or user.username,
            "role": user.psc_profile.role,
            "active_count": load.get("active_count", 0),
            "co_assigned_count": load.get("co_assigned_count", 0),
            "weighted_load": load.get("weighted_load", 0.0),
            "buckets": load.get("buckets", {"fresh": 0, "aging": 0, "stale": 0}),
            "open_tasks": load.get("open_tasks", 0),
            "overdue_tasks": load.get("overdue_tasks", 0),
            "avg_assessment_days": _avg(dur_by_officer.get(user.id, [])),
            "assessments_completed": len(dur_by_officer.get(user.id, [])),
        })
    officers.sort(key=lambda o: o["weighted_load"], reverse=True)

    # Per-unit rollup over active submissions
    unit_rows = Submission.objects.filter(
        current_stage__in=ACTIVE_STAGES, is_attachment=False,
    ).exclude(routed_unit="").values(
        "routed_unit", "assigned_to_id", "assigned_at", "received_at",
    )
    units: dict[str, dict] = {}
    for row in unit_rows:
        unit = units.setdefault(row["routed_unit"], {
            "unit": row["routed_unit"],
            "active_count": 0,
            "weighted_load": 0.0,
            "unassigned": 0,
            "buckets": {"fresh": 0, "aging": 0, "stale": 0},
        })
        age = _age_days(row, now)
        unit["active_count"] += 1
        unit["weighted_load"] += _age_weight(age)
        unit["buckets"][_age_bucket(age)] += 1
        if not row["assigned_to_id"]:
            unit["unassigned"] += 1
    for code, unit in units.items():
        unit["weighted_load"] = _round(unit["weighted_load"])
        unit["avg_assessment_days"] = _avg(dur_by_unit.get(code, []))
        unit["assessments_completed"] = len(dur_by_unit.get(code, []))

    all_durations = [d for ds in dur_by_officer.values() for d in ds]
    active_all = Submission.objects.filter(
        current_stage__in=ACTIVE_STAGES, is_attachment=False,
    )
    return {
        "generated_at": now.isoformat(),
        "weighting": "1 + min(age_days, 21)/7 per active submission; co-assignments at half weight.",
        "duration_window_days": DURATION_WINDOW_DAYS,
        "officers": officers,
        "units": sorted(units.values(), key=lambda u: u["weighted_load"], reverse=True),
        "totals": {
            "active_submissions": active_all.count(),
            "unassigned": active_all.filter(assigned_to_id__isnull=True).count(),
            "open_tasks": CommissionTask.objects.filter(status__in=["open", "in_progress"]).count(),
            "overdue_tasks": CommissionTask.objects.filter(
                status__in=["open", "in_progress"], due_date__lt=now.date(),
            ).count(),
            "avg_assessment_days": _avg(all_durations),
            "avg_task_completion_days": _avg(task_days),
        },
    }

"""Gather data for staff and manager daily briefs."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.utils import timezone

from tracker.models import (
    CommissionTask,
    CommissionTaskStatus,
    Meeting,
    MeetingStatus,
    Notification,
    Role,
    Submission,
    WorkflowStage,
)

def _submission_queryset_for(user):
    from tracker.views import _submission_queryset_for as _fn

    return _fn(user)


def _commission_task_queryset_for(user):
    from tracker.views import _commission_task_queryset_for as _fn

    return _fn(user)


def _profile(user):
    from tracker.views import _profile as _fn

    return _fn(user)

# Terminal workflow stages (not "open" for manager KPIs / staff attention)
TERMINAL_SUBMISSION_STAGES = {
    WorkflowStage.DRAFT,
    WorkflowStage.APPROVED,
    WorkflowStage.REJECTED,
}

OPEN_TASK_STATUSES = {
    CommissionTaskStatus.OPEN,
    CommissionTaskStatus.IN_PROGRESS,
}

# Ministry-facing roles excluded from staff brief recipient pool
_STAFF_EXCLUDED_ROLES = {
    Role.MINISTRY_HR,
    Role.HEAD_OF_AGENCY,
    Role.DEPT_ADMIN,
}


def _today_local():
    return timezone.localdate()


def _tasks_assigned_to_user(user):
    return Q(assigned_manager=user) | Q(assigned_staff=user) | Q(assigned_staff_m2m=user)


def _commission_tasks_for_user(user):
    return _commission_task_queryset_for(user).filter(status__in=OPEN_TASK_STATUSES)


def collect_staff_brief(user: User) -> dict[str, Any]:
    """Return section payloads for one staff user (may all be empty)."""
    today = _today_local()
    base_tasks = _commission_tasks_for_user(user)

    overdue_tasks = list(
        base_tasks.filter(due_date__lt=today, due_date__isnull=False)
        .select_related("submission", "assigned_manager")
        .order_by("due_date")[:25]
    )
    due_today_tasks = list(
        base_tasks.filter(due_date=today)
        .select_related("submission", "assigned_manager")
        .order_by("title")[:25]
    )

    submissions_attention = list(
        _submissions_needing_attention(user)[:25]
    )
    unread_notifications = list(
        Notification.objects.filter(recipient=user, is_read=False)
        .select_related("submission")
        .order_by("-created_at")[:10]
    )

    todays_meetings = []
    if _user_can_see_meetings(user):
        todays_meetings = list(
            Meeting.objects.filter(date=today, status=MeetingStatus.SCHEDULED)
            .order_by("time")[:20]
        )

    return {
        "overdue_tasks": overdue_tasks,
        "due_today_tasks": due_today_tasks,
        "submissions_attention": submissions_attention,
        "unread_notifications": unread_notifications,
        "todays_meetings": todays_meetings,
    }


def _submissions_needing_attention(user: User):
    base = _submission_queryset_for(user).exclude(
        current_stage__in=TERMINAL_SUBMISSION_STAGES
    )
    queue = Q(assigned_to=user)
    try:
        role = _profile(user).role
    except Exception:
        role = None
    if role == Role.PSC_SECRETARY:
        queue |= Q(current_stage=WorkflowStage.SECRETARY_REVIEW)
    elif role in {
        Role.PSC_OFFICER,
        Role.SENIOR_ADMIN_OFFICER,
        Role.PSC_MANAGER,
    }:
        queue |= Q(
            current_stage__in=[
                WorkflowStage.SUBMITTED,
                WorkflowStage.RECEIVED_BY_PSC,
                WorkflowStage.REGISTERED_ROUTED,
            ]
        )
    elif role in {
        Role.ODU_MANAGER,
        Role.HR_UNIT_MANAGER,
        Role.VIPAM_MANAGER,
        Role.COMPLIANCE_MANAGER,
        Role.CSU_MANAGER,
    }:
        queue |= Q(
            current_stage__in=[
                WorkflowStage.MANAGER_CHECKLIST_REVIEW,
                WorkflowStage.SUBMITTED,
                WorkflowStage.REGISTERED_ROUTED,
            ]
        )
    elif role in {
        Role.PSC_COMMISSIONER,
        Role.CHAIRPERSON,
    }:
        queue |= Q(
            current_stage__in=[
                WorkflowStage.FORWARDED_TO_COMMISSION,
                WorkflowStage.COMMISSION_SITTING,
            ]
        )
    return base.filter(queue).distinct().order_by("-received_at")


def _user_can_see_meetings(user: User) -> bool:
    if user.is_superuser or user.is_staff:
        return True
    from tracker.rbac import rbac_user_has_permission

    if rbac_user_has_permission(user, "manage_meetings"):
        return True
    try:
        role = _profile(user).role
    except Exception:
        return False
    return role in {
        Role.PSC_SECRETARY,
        Role.SENIOR_ADMIN_OFFICER,
        Role.PSC_ADMIN,
        Role.PSC_COMMISSIONER,
        Role.CHAIRPERSON,
        Role.PSC_OFFICER,
        Role.PSC_MANAGER,
    }


def collect_manager_brief() -> dict[str, Any]:
    """Company-wide manager digest data."""
    today = _today_local()
    since_24h = timezone.now() - timedelta(hours=24)

    overdue_qs = (
        CommissionTask.objects.filter(
            status__in=OPEN_TASK_STATUSES,
            due_date__lt=today,
            due_date__isnull=False,
        )
        .select_related("submission", "assigned_manager")
        .order_by("due_date")
    )
    overdue_count = overdue_qs.count()
    overdue_top = list(overdue_qs[:5])

    open_submissions = Submission.objects.exclude(
        current_stage__in=TERMINAL_SUBMISSION_STAGES
    )
    stage_counts = list(
        open_submissions.values("current_stage")
        .annotate(count=Count("id"))
        .order_by("-count")
    )

    new_submissions_qs = Submission.objects.filter(
        Q(registered_at__gte=since_24h) | Q(received_at__gte=since_24h)
    ).exclude(current_stage=WorkflowStage.DRAFT).order_by("-received_at")
    new_count = new_submissions_qs.count()
    new_list = list(new_submissions_qs[:10])

    meetings_today = Meeting.objects.filter(
        date=today, status=MeetingStatus.SCHEDULED
    ).order_by("time")
    meetings_count = meetings_today.count()
    meetings_list = list(meetings_today[:10])

    return {
        "overdue_count": overdue_count,
        "overdue_top": overdue_top,
        "stage_counts": stage_counts,
        "new_count": new_count,
        "new_list": new_list,
        "meetings_count": meetings_count,
        "meetings_list": meetings_list,
    }


def staff_brief_is_empty(data: dict[str, Any]) -> bool:
    return not any(
        data.get(key)
        for key in (
            "overdue_tasks",
            "due_today_tasks",
            "submissions_attention",
            "unread_notifications",
            "todays_meetings",
        )
    )


def manager_brief_is_empty(data: dict[str, Any]) -> bool:
    return (
        not data.get("overdue_count")
        and not data.get("stage_counts")
        and not data.get("new_count")
        and not data.get("meetings_count")
    )


def active_staff_users():
    """Users eligible for staff daily briefs."""
    return (
        User.objects.filter(is_active=True, psc_profile__isnull=False)
        .exclude(psc_profile__role__in=_STAFF_EXCLUDED_ROLES)
        .select_related("psc_profile")
        .order_by("username")
    )


def staff_user_enabled(user: User) -> bool:
    from .models import DailyBriefStaffPreference

    pref, _ = DailyBriefStaffPreference.objects.get_or_create(user=user, defaults={"enabled": True})
    return pref.enabled

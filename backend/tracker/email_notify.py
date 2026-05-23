"""Helpers to send workflow, task, and auth emails from database templates."""

from __future__ import annotations

from typing import Iterable

from django.contrib.auth.models import User

from .email_template_defaults import SAMPLE_EMAIL_CONTEXTS
from .email_templates import get_frontend_base_url, send_templated_email
from .models import CommissionSubTask, CommissionTask, Submission, WorkflowStage


def stage_label(stage_code: str) -> str:
    try:
        return WorkflowStage(stage_code).label
    except (ValueError, TypeError):
        if not stage_code:
            return ""
        return str(stage_code).replace("_", " ").title()


def submission_email_context(submission: Submission) -> dict[str, str]:
    base = get_frontend_base_url()
    return {
        "submission_reference": submission.reference_number or str(submission.pk),
        "submission_title": submission.title or "",
        "submission_url": f"{base}/submissions/{submission.pk}",
    }


def task_email_context(task: CommissionTask) -> dict[str, str]:
    base = get_frontend_base_url()
    sub_ref = ""
    if task.submission_id:
        sub_ref = task.submission.reference_number or str(task.submission_id)
    return {
        "task_title": task.title,
        "task_url": f"{base}/secretariat/tasks",
        "submission_reference": sub_ref,
        "due_date": str(task.due_date) if task.due_date else "—",
    }


def subtask_email_context(sub: CommissionSubTask) -> dict[str, str]:
    base = get_frontend_base_url()
    return {
        "task_title": sub.title,
        "parent_task_title": sub.task.title,
        "task_url": f"{base}/secretariat/tasks",
        "due_date": str(sub.due_date) if sub.due_date else "—",
    }


def recipient_name(user: User) -> str:
    return (user.get_full_name() or "").strip() or user.username


def _resolve_firstname(user: User) -> str:
    """First name for salutations — from User.first_name, else first token of full name, else username."""
    first = (user.first_name or "").strip()
    if first:
        return first
    full = (user.get_full_name() or "").strip()
    if full:
        return full.split()[0]
    username = (user.username or "").strip()
    if username:
        return username
    return "Colleague"


def user_recipient_context(user: User | None) -> dict[str, str]:
    """
    Personalization fields for every recipient-specific email.
    Use in templates as {{firstname}} or {firstname}; greeting is e.g. "Dear Herman,".
    """
    if user is None:
        return {
            "firstname": "Colleague",
            "lastname": "",
            "full_name": "Colleague",
            "recipient_name": "Colleague",
            "username": "",
            "email": "",
            "greeting": "Dear Colleague,",
        }
    firstname = _resolve_firstname(user)
    lastname = (user.last_name or "").strip()
    full_name = recipient_name(user)
    return {
        "firstname": firstname,
        "lastname": lastname,
        "full_name": full_name,
        "recipient_name": full_name,
        "username": user.username or "",
        "email": (user.email or "").strip(),
        "greeting": f"Dear {firstname},",
    }


def merge_recipient_context(user: User, **extra: str) -> dict[str, str]:
    """Recipient personalization merged with event-specific placeholder values."""
    return {**user_recipient_context(user), **extra}


def get_transition_email_slug(prev: str, target: str) -> str | None:
    if prev == WorkflowStage.DRAFT and target == WorkflowStage.SUBMITTED:
        return "submission_submitted"
    if target == WorkflowStage.RETURNED_FOR_CLARIFICATION:
        return "submission_returned_clarification"
    if (
        prev == WorkflowStage.RETURNED_FOR_CLARIFICATION
        and target == WorkflowStage.SUBMITTED
    ):
        return "submission_resubmitted"
    if target == WorkflowStage.FORWARDED_TO_COMMISSION:
        return "submission_forwarded_commission"
    if target == WorkflowStage.DEFERRED_BACK_TO_HR:
        return "submission_deferred_back_hr"
    if target == WorkflowStage.APPROVED:
        return "submission_approved"
    if target == WorkflowStage.REJECTED:
        return "submission_rejected"
    if prev != target:
        return "submission_stage_changed"
    return None


def _emails_for_users(users: Iterable[User]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for user in users:
        if not user or not getattr(user, "is_active", True):
            continue
        email = (getattr(user, "email", None) or "").strip()
        if not email or email.lower() in seen:
            continue
        seen.add(email.lower())
        out.append(email)
    return out


def send_transition_emails(
    submission: Submission,
    prev: str,
    target: str,
    users: Iterable[User],
    *,
    decision_label: str = "",
) -> None:
    slug = get_transition_email_slug(prev, target)
    if not slug:
        return
    base_ctx = submission_email_context(submission)
    for user in users:
        email = (getattr(user, "email", None) or "").strip()
        if not email:
            continue
        ctx = merge_recipient_context(
            user,
            previous_stage=stage_label(prev),
            new_stage=stage_label(target),
            **base_ctx,
        )
        if slug in ("submission_approved", "submission_rejected"):
            ctx["decision_label"] = decision_label or (
                "approved" if target == WorkflowStage.APPROVED else "rejected"
            )
        send_templated_email(slug=slug, to=[email], context=ctx)


def notify_task_assigned(task: CommissionTask, users: Iterable[User]) -> None:
    base_ctx = task_email_context(task)
    for user in users:
        email = (getattr(user, "email", None) or "").strip()
        if not email:
            continue
        ctx = merge_recipient_context(user, **base_ctx)
        send_templated_email(slug="task_assigned", to=[email], context=ctx)


def task_assignees(task: CommissionTask) -> list[User]:
    users: list[User] = []
    if task.assigned_manager_id:
        users.append(task.assigned_manager)
    if task.assigned_staff_id:
        users.append(task.assigned_staff)
    users.extend(list(task.assigned_staff_m2m.all()))
    return users


def notify_task_due_soon(
    task: CommissionTask,
    user: User,
    *,
    days_remaining: int,
) -> None:
    email = (getattr(user, "email", None) or "").strip()
    if not email:
        return
    ctx = merge_recipient_context(
        user,
        days_remaining=str(days_remaining),
        **task_email_context(task),
    )
    send_templated_email(slug="task_due_soon", to=[email], context=ctx)


def notify_subtask_due_soon(
    sub: CommissionSubTask,
    user: User,
    *,
    days_remaining: int,
) -> None:
    email = (getattr(user, "email", None) or "").strip()
    if not email:
        return
    ctx = merge_recipient_context(
        user,
        days_remaining=str(days_remaining),
        **subtask_email_context(sub),
    )
    send_templated_email(slug="subtask_due_soon", to=[email], context=ctx)


def sample_context_for_slug(slug: str) -> dict[str, str]:
    from .email_template_defaults import SAMPLE_RECIPIENT

    ctx = dict(SAMPLE_RECIPIENT)
    if slug in SAMPLE_EMAIL_CONTEXTS:
        ctx.update(SAMPLE_EMAIL_CONTEXTS[slug])
    else:
        ctx.update({
            "submission_reference": "PSC-2026-0001",
            "submission_title": "Sample submission",
            "submission_url": f"{get_frontend_base_url()}/submissions/1",
            "new_stage": "Under Assessment",
            "previous_stage": "Submitted to PSC",
        })
    return ctx

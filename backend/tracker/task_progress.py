"""Progress bookkeeping for post-decision commission tasks: one place that
logs a status change, keeps the decision register in step, and tells the
people who allocated or manage the task."""

from django.utils import timezone

from .models import (
    CommissionImplementationStatus,
    CommissionTaskStatus,
    CommissionTaskUpdate,
    Notification,
)

TASKS_LINK = "/secretariat/tasks"


def task_people(task, actor):
    """Manager, allocator and assigned staff, minus the person acting."""
    people = {}
    for u in (task.assigned_manager, task.created_by, task.assigned_staff):
        if u:
            people[u.pk] = u
    for u in task.assigned_staff_m2m.all():
        people[u.pk] = u
    people.pop(getattr(actor, "pk", None), None)
    return [u for u in people.values() if u.is_active]


def notify_task_people(task, actor, title, body, recipients=None):
    for user in recipients if recipients is not None else task_people(task, actor):
        Notification.objects.create(
            recipient=user,
            channel=Notification.Channel.IN_APP,
            title=title[:255],
            body=body,
            submission_id=task.submission_id,
            link=TASKS_LINK,
        )


def record_status_change(task, old_status, actor):
    """Call after a task's status may have changed. No-op if it did not."""
    if task.status == old_status:
        return
    labels = dict(CommissionTaskStatus.choices)
    update_fields = []

    if task.status == CommissionTaskStatus.COMPLETED:
        task.completed_at = timezone.now()
        task.completed_by = actor
        update_fields += ["completed_at", "completed_by"]
        if task.implementation_status != CommissionImplementationStatus.ACTIONED:
            task.implementation_status = CommissionImplementationStatus.ACTIONED
            update_fields.append("implementation_status")
    elif old_status == CommissionTaskStatus.COMPLETED:
        task.completed_at = None
        task.completed_by = None
        update_fields += ["completed_at", "completed_by"]
        if task.implementation_status == CommissionImplementationStatus.ACTIONED:
            task.implementation_status = CommissionImplementationStatus.WITH_UNIT
            update_fields.append("implementation_status")
    if update_fields:
        task.save(update_fields=update_fields)

    message = (
        f"Status changed from {labels.get(old_status, old_status)} "
        f"to {labels.get(task.status, task.status)}."
    )
    CommissionTaskUpdate.objects.create(
        task=task, author=actor, body=message, kind="status",
    )

    if task.status == CommissionTaskStatus.COMPLETED:
        name = getattr(actor, "username", "Someone")
        notify_task_people(
            task, actor,
            title=f"Task completed: {task.title}",
            body=f"{name} marked this decision task as Completed.",
        )

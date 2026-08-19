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
        "tracking_url": f"{base}/track?ref={submission.reference_number or ''}",
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


def notify_external_submission_confirmation(
    submission: Submission, internal_users: Iterable[User]
) -> None:
    """Confirm PSC receipt to the submission's DG/HR contacts and any ad-hoc
    notify_emails — every recipient gets the public tracking link, no login
    needed. Separate from send_transition_emails: these recipients may have
    no User account at all (raw notify_emails strings)."""
    base_ctx = submission_email_context(submission)
    seen: set[str] = set()

    for user in internal_users:
        email = (getattr(user, "email", None) or "").strip().lower()
        if not email or email in seen:
            continue
        seen.add(email)
        ctx = merge_recipient_context(user, **base_ctx)
        send_templated_email(slug="submission_received_confirmation", to=[email], context=ctx)

    for raw_email in submission.notify_emails or []:
        email = (raw_email or "").strip().lower()
        if not email or email in seen:
            continue
        seen.add(email)
        ctx = merge_recipient_context(None, **base_ctx)
        send_templated_email(slug="submission_received_confirmation", to=[email], context=ctx)


def get_transition_email_slug(prev: str, target: str) -> str | None:
    if (
        prev == WorkflowStage.DRAFT
        and target == WorkflowStage.PENDING_DG_ENDORSEMENT
    ):
        return "submission_pending_dg_endorsement"
    if (
        prev == WorkflowStage.PENDING_DG_ENDORSEMENT
        and target == WorkflowStage.DRAFT
    ):
        return "submission_returned_to_hr"
    if (
        prev in (WorkflowStage.DRAFT, WorkflowStage.PENDING_DG_ENDORSEMENT)
        and target == WorkflowStage.SUBMITTED
    ):
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
    remarks: str = "",
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
        if slug == "submission_returned_to_hr":
            ctx["remarks"] = (remarks or "").strip() or "(No comment was provided.)"
        send_templated_email(slug=slug, to=[email], context=ctx)


def send_assignment_email(submission: Submission, assignee: User, *, manager_name: str = "") -> None:
    """Email an officer when a unit manager allocates a submission to them."""
    email = (getattr(assignee, "email", None) or "").strip()
    if not email:
        return
    ctx = merge_recipient_context(
        assignee,
        manager_name=manager_name or "Your unit manager",
        **submission_email_context(submission),
    )
    send_templated_email(slug="submission_assigned_officer", to=[email], context=ctx)


def notify_submission_ready_for_manager(submission: Submission, assignee: User, managers: Iterable[User]) -> None:
    """Email the unit manager(s) when a principal/senior officer hands their
    completed checklist review or assessment back for the manager to advance."""
    assignee_name = assignee.get_full_name() or assignee.username
    work_stage = (
        "checklist review" if submission.current_stage == WorkflowStage.MANAGER_CHECKLIST_REVIEW else "assessment"
    )
    base_ctx = submission_email_context(submission)
    for manager in managers:
        email = (getattr(manager, "email", None) or "").strip()
        if not email:
            continue
        ctx = merge_recipient_context(
            manager,
            assignee_name=assignee_name,
            work_stage=work_stage,
            **base_ctx,
        )
        send_templated_email(slug="submission_ready_for_manager", to=[email], context=ctx)


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


def send_email_to_user(user: User, *, subject: str, body: str) -> bool:
    """
    Send a plain-text transactional email to a single user.
    Used by Celery tasks for escalation / SLA reminder emails that don't
    yet have a dedicated template in the database.
    Falls back gracefully when SMTP is not configured.
    """
    import logging
    from django.core.mail import send_mail
    from .email_templates import get_from_email

    log = logging.getLogger("scdms.app")
    email = (getattr(user, "email", None) or "").strip()
    if not email:
        log.debug("send_email_to_user | no email for user %s", user.username)
        return False
    try:
        send_mail(subject, body, get_from_email(), [email], fail_silently=True)
        log.info("EMAIL_SENT | to=%s | subject=%s", email, subject)
        return True
    except Exception as exc:
        log.warning("EMAIL_FAIL | to=%s | %s", email, exc)
        return False


def find_active_user_by_email(email: str) -> User | None:
    """Return an active user with a non-empty email matching `email` (case-insensitive)."""
    normalized = (email or "").strip().lower()
    if not normalized or "@" not in normalized:
        return None
    return (
        User.objects.filter(is_active=True, email__iexact=normalized)
        .exclude(email="")
        .first()
    )


def send_password_reset_email(*, user: User, reset_url: str, to_email: str) -> bool:
    """
    Send password-reset link to a registered user.
    Returns True when delivery succeeded, False otherwise.
    """
    import logging

    from django.conf import settings
    from django.core.mail import send_mail

    from .email_templates import get_from_email, send_templated_email

    log = logging.getLogger("scdms.security")
    ctx = merge_recipient_context(
        user,
        reset_url=reset_url,
        expiry_hours="1",
        login_url=f"{get_frontend_base_url()}/auth/login",
    )
    if send_templated_email(
        slug="password_reset",
        to=[to_email],
        context=ctx,
        fail_silently=False,
    ):
        log.info("PASSWORD_RESET_EMAIL_SENT | username=%s | to=%s", user.username, to_email)
        return True

    subject = "Reset your password — Commission Decision App"
    message = (
        f"Hello {user.username},\n\n"
        "You requested a password reset for your Commission Decision App account.\n"
        "Open this link to set a new password:\n\n"
        f"{reset_url}\n\n"
        "This link expires in 1 hour.\n\n"
        "If you did not request this, you can ignore this email."
    )
    try:
        send_mail(
            subject,
            message,
            get_from_email(),
            [to_email],
            fail_silently=False,
        )
        log.info("PASSWORD_RESET_EMAIL_SENT | username=%s | to=%s | fallback=plain", user.username, to_email)
        return True
    except Exception:
        log.exception("PASSWORD_RESET_EMAIL_FAILED | username=%s | to=%s", user.username, to_email)
        return False


def _superuser_emails() -> list[str]:
    """Active super administrators' email addresses (for security alerts)."""
    return list(
        User.objects.filter(is_superuser=True, is_active=True)
        .exclude(email="")
        .values_list("email", flat=True)
    )


def notify_account_locked(user: User, *, ip: str = "", hard: bool = False, minutes: int = 0) -> None:
    """
    Notify the affected user and all super administrators that an account was
    locked — temporarily (after the failure limit) or permanently (after a
    repeat lockout). Best-effort; never raises.
    """
    import logging
    from django.utils import timezone

    log = logging.getLogger("scdms.security")
    base = get_frontend_base_url()
    when = timezone.localtime(timezone.now()).strftime("%Y-%m-%d %H:%M %Z")

    if hard:
        lock_summary = (
            "Your account has been permanently locked after repeated failed "
            "sign-in attempts."
        )
        unlock_instructions = (
            "For your security, only a system administrator can unlock it. "
            "Please contact your SCDMS administrator."
        )
        admin_summary = "permanently locked (repeat failed attempts)"
    else:
        lock_summary = (
            f"Your account has been temporarily locked for {minutes} minutes "
            "after several failed sign-in attempts."
        )
        unlock_instructions = (
            f"You can try again after {minutes} minutes. If this was not you, "
            "or you need access sooner, contact your SCDMS administrator."
        )
        admin_summary = f"temporarily locked for {minutes} min"

    # 1) The affected user.
    user_email = (user.email or "").strip()
    if user_email:
        ctx = merge_recipient_context(
            user,
            lock_summary=lock_summary,
            unlock_instructions=unlock_instructions,
            ip_address=ip or "unknown",
            attempt_time=when,
            login_url=f"{base}/auth/login",
        )
        send_templated_email(slug="account_locked_user", to=[user_email], context=ctx)

    # 2) Super administrators.
    admin_emails = _superuser_emails()
    if admin_emails:
        admin_ctx = merge_recipient_context(
            None,
            target_username=user.username,
            target_email=user_email or "—",
            lock_summary=admin_summary,
            ip_address=ip or "unknown",
            attempt_time=when,
            admin_url=f"{base}/admin",
        )
        send_templated_email(slug="account_locked_admin", to=admin_emails, context=admin_ctx)

    log.info(
        "ACCOUNT_LOCK_NOTIFIED | username=%s | hard=%s | user_email=%s | admins=%d",
        user.username, hard, bool(user_email), len(admin_emails),
    )


def notify_account_unlocked(user: User) -> None:
    """
    Notify the affected user that a super administrator unlocked their
    account. Best-effort; never raises.
    """
    import logging
    from django.utils import timezone

    log = logging.getLogger("scdms.security")
    base = get_frontend_base_url()
    when = timezone.localtime(timezone.now()).strftime("%Y-%m-%d %H:%M %Z")

    user_email = (user.email or "").strip()
    if user_email:
        ctx = merge_recipient_context(
            user,
            unlocked_time=when,
            login_url=f"{base}/auth/login",
        )
        send_templated_email(slug="account_unlocked_user", to=[user_email], context=ctx)

    log.info("ACCOUNT_UNLOCK_NOTIFIED | username=%s | user_email=%s", user.username, bool(user_email))


def commission_members() -> list[User]:
    """Active Commission members + Chairperson — recipients of agenda/minutes notices."""
    from .models import Role

    return list(
        User.objects.filter(
            is_active=True,
            psc_profile__role__in=[Role.PSC_COMMISSIONER, Role.CHAIRPERSON],
        ).select_related("psc_profile")
    )


def hr_managers() -> list[User]:
    """Active HR managers — the OPSC HR Unit Manager and ministry HR officers.
    Recipients of the new-sitting notification."""
    from .models import Role

    return list(
        User.objects.filter(
            is_active=True,
            psc_profile__role__in=[Role.HR_UNIT_MANAGER, Role.MINISTRY_HR],
        )
        .exclude(email="")
        .select_related("psc_profile")
    )


def _render_agenda_pdf(meeting) -> bytes | None:
    """Best-effort one-page agenda PDF (sequence / section / reference / title)."""
    import html as _html
    import logging

    try:
        from io import BytesIO

        from weasyprint import HTML

        from .agenda_sections import agenda_section_label
        from .models import PSCFormType

        items = list(meeting.agenda_items.select_related("submission").order_by("category", "sequence"))
        type_labels = dict(
            PSCFormType.objects.filter(
                code__in={i.form_type_code for i in items if i.form_type_code}
            ).values_list("code", "name")
        )

        rows = []
        for item in items:
            sub = item.submission
            ref = _html.escape((getattr(sub, "reference_number", "") or "") if sub else "")
            title = _html.escape((getattr(sub, "title", "") or "") if sub else "")
            section = _html.escape(agenda_section_label(item.category or "") or "Other")
            type_label = _html.escape(type_labels.get(item.form_type_code, item.form_type_code) or "")
            rows.append(
                f"<tr><td>{item.sequence}</td><td>{section}</td><td>{type_label}</td>"
                f"<td>{ref}</td><td>{title}</td></tr>"
            )
        body_rows = "".join(rows) or "<tr><td colspan='5'>No agenda items.</td></tr>"
        doc = (
            "<html><body style=\"font-family:Arial,sans-serif;font-size:12px;color:#1e293b;\">"
            f"<h2 style=\"margin:0 0 4px 0;\">Agenda — {_html.escape(meeting.reference_number or '')}</h2>"
            f"<p style=\"margin:0 0 12px 0;color:#475569;\">Sitting date: {meeting.date or ''}</p>"
            "<table cellspacing=\"0\" cellpadding=\"6\" style=\"border-collapse:collapse;width:100%;border:1px solid #cbd5e1;\">"
            "<thead><tr style=\"background:#f1f5f9;\">"
            "<th style=\"border:1px solid #cbd5e1;text-align:left;\">#</th>"
            "<th style=\"border:1px solid #cbd5e1;text-align:left;\">Section</th>"
            "<th style=\"border:1px solid #cbd5e1;text-align:left;\">Type</th>"
            "<th style=\"border:1px solid #cbd5e1;text-align:left;\">Reference</th>"
            "<th style=\"border:1px solid #cbd5e1;text-align:left;\">Title</th>"
            "</tr></thead>"
            f"<tbody>{body_rows}</tbody></table>"
            "</body></html>"
        )
        buf = BytesIO()
        HTML(string=doc).write_pdf(buf)
        return buf.getvalue()
    except Exception:
        logging.getLogger("scdms.app").warning(
            "Agenda PDF render failed for meeting %s", getattr(meeting, "id", None)
        )
        return None


def notify_agenda_circulated(meeting) -> None:
    """Tell every Commission member + the Chairperson that an approved agenda has
    been circulated. In-app + push notification, plus a templated email carrying
    the agenda PDF (the digital equivalent of the hand-delivered copy). Best-effort."""
    import logging
    from django.utils import timezone

    from .models import Notification

    members = commission_members()
    if not members:
        return

    base = get_frontend_base_url()
    when = (
        timezone.localtime(timezone.now()).strftime("%d %B %Y")
        if meeting.date is None
        else meeting.date.strftime("%d %B %Y")
    )
    pdf = _render_agenda_pdf(meeting)
    attachments = (
        [(f"agenda_{(meeting.reference_number or 'meeting')}.pdf", pdf, "application/pdf")]
        if pdf
        else None
    )

    for user in members:
        Notification.objects.create(
            recipient=user,
            channel=Notification.Channel.IN_APP,  # email sent separately (templated)
            push=True,
            title=f"Agenda circulated — {meeting.reference_number or ''}".strip(),
            body=(
                f"The Chairman has endorsed the agenda for the sitting on {when}. "
                "You can now view it in the Agenda menu."
            ),
            link="/secretariat/agenda",
        )
        email = (user.email or "").strip()
        if email:
            ctx = merge_recipient_context(
                user,
                meeting_reference=meeting.reference_number or "",
                meeting_date=when,
                agenda_url=f"{base}/secretariat/agenda",
            )
            send_templated_email(
                slug="agenda_circulated", to=[email], context=ctx, attachments=attachments
            )

    logging.getLogger("scdms.app").info(
        "AGENDA_CIRCULATED_NOTIFIED | meeting=%s | members=%d",
        meeting.reference_number, len(members),
    )


def notify_meeting_scheduled(meeting) -> None:
    """Tell every HR manager (OPSC HR Unit Manager + ministry HR officers) that a
    new Commission sitting has been scheduled, with the meeting date and the
    submission deadline (due date). In-app + push + templated email. Best-effort."""
    import logging
    from django.utils import timezone

    from .models import Notification

    recipients = hr_managers()
    if not recipients:
        return

    base = get_frontend_base_url()
    meeting_date = meeting.date.strftime("%d %B %Y") if meeting.date else "—"
    meeting_time = meeting.time.strftime("%H:%M") if meeting.time else "—"
    cutoff = getattr(meeting, "effective_cutoff", None)
    submission_deadline = (
        timezone.localtime(cutoff).strftime("%d %B %Y") if cutoff else "—"
    )
    meeting_url = f"{base}/secretariat/agenda"

    for user in recipients:
        Notification.objects.create(
            recipient=user,
            channel=Notification.Channel.IN_APP,  # email sent separately (templated)
            push=True,
            title=f"New sitting scheduled — {meeting.reference_number or ''}".strip(),
            body=(
                f"A Commission sitting is set for {meeting_date}. "
                f"Submission deadline: {submission_deadline}."
            ),
            link="/secretariat/agenda",
        )
        email = (user.email or "").strip()
        if email:
            ctx = merge_recipient_context(
                user,
                meeting_reference=meeting.reference_number or "",
                meeting_title=meeting.title or "",
                meeting_date=meeting_date,
                meeting_time=meeting_time,
                meeting_venue=meeting.venue or "—",
                submission_deadline=submission_deadline,
                meeting_url=meeting_url,
            )
            send_templated_email(slug="meeting_scheduled", to=[email], context=ctx)

    logging.getLogger("scdms.app").info(
        "MEETING_SCHEDULED_NOTIFIED | meeting=%s | hr_managers=%d",
        meeting.reference_number, len(recipients),
    )


def notify_meeting_postponed(meeting, old_date, old_time, old_cutoff) -> None:
    """Tell every HR manager that a Commission sitting's date/time changed —
    this also moves the submission deadline, earlier or later. In-app + push +
    templated email. Best-effort."""
    import logging
    from django.utils import timezone

    from .models import Notification

    recipients = hr_managers()
    if not recipients:
        return

    base = get_frontend_base_url()
    old_meeting_date = old_date.strftime("%d %B %Y") if old_date else "—"
    old_meeting_time = old_time.strftime("%H:%M") if old_time else "—"
    new_meeting_date = meeting.date.strftime("%d %B %Y") if meeting.date else "—"
    new_meeting_time = meeting.time.strftime("%H:%M") if meeting.time else "—"
    old_submission_deadline = (
        timezone.localtime(old_cutoff).strftime("%d %B %Y") if old_cutoff else "—"
    )
    new_cutoff = getattr(meeting, "effective_cutoff", None)
    new_submission_deadline = (
        timezone.localtime(new_cutoff).strftime("%d %B %Y") if new_cutoff else "—"
    )

    if old_cutoff and new_cutoff:
        if new_cutoff > old_cutoff:
            deadline_change_note = (
                "The submission deadline has moved later — you now have more time "
                "to lodge submissions for this sitting."
            )
        elif new_cutoff < old_cutoff:
            deadline_change_note = (
                "The submission deadline has moved earlier — please lodge any "
                "outstanding submissions for this sitting as soon as possible."
            )
        else:
            deadline_change_note = "The submission deadline is unchanged."
    else:
        deadline_change_note = ""

    meeting_url = f"{base}/secretariat/agenda"

    for user in recipients:
        Notification.objects.create(
            recipient=user,
            channel=Notification.Channel.IN_APP,  # email sent separately (templated)
            push=True,
            title=f"Sitting postponed — {meeting.reference_number or ''}".strip(),
            body=(
                f"{meeting.reference_number or 'A Commission sitting'} moved from "
                f"{old_meeting_date} to {new_meeting_date}. "
                f"New submission deadline: {new_submission_deadline}."
            ),
            link="/secretariat/agenda",
        )
        email = (user.email or "").strip()
        if email:
            ctx = merge_recipient_context(
                user,
                meeting_reference=meeting.reference_number or "",
                meeting_title=meeting.title or "",
                old_meeting_date=old_meeting_date,
                old_meeting_time=old_meeting_time,
                new_meeting_date=new_meeting_date,
                new_meeting_time=new_meeting_time,
                meeting_venue=meeting.venue or "—",
                old_submission_deadline=old_submission_deadline,
                new_submission_deadline=new_submission_deadline,
                deadline_change_note=deadline_change_note,
                meeting_url=meeting_url,
            )
            send_templated_email(slug="meeting_postponed", to=[email], context=ctx)

    logging.getLogger("scdms.app").info(
        "MEETING_POSTPONED_NOTIFIED | meeting=%s | hr_managers=%d",
        meeting.reference_number, len(recipients),
    )


def notify_minutes_signed(minutes) -> None:
    """Tell every Commission member + the Chairperson that the signed minutes are
    now the official record and available to view. In-app + push + templated email.
    Best-effort."""
    import logging

    from .models import Notification

    members = commission_members()
    if not members:
        return

    meeting = minutes.meeting
    base = get_frontend_base_url()
    when = meeting.date.strftime("%d %B %Y") if meeting and meeting.date else ""
    ref = (meeting.reference_number or "") if meeting else ""

    for user in members:
        Notification.objects.create(
            recipient=user,
            channel=Notification.Channel.IN_APP,
            push=True,
            title=f"Signed minutes on record — {ref}".strip(),
            body=(
                f"The signed minutes for the sitting of {when or ref} have been uploaded "
                "and are now the official record. You can view them in the Minutes menu."
            ),
            link="/secretariat/minutes",
        )
        email = (user.email or "").strip()
        if email:
            ctx = merge_recipient_context(
                user,
                meeting_reference=ref,
                meeting_date=when,
                minutes_url=f"{base}/secretariat/minutes",
            )
            send_templated_email(slug="minutes_signed", to=[email], context=ctx)

    logging.getLogger("scdms.app").info(
        "MINUTES_SIGNED_NOTIFIED | meeting=%s | members=%d", ref, len(members),
    )


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
    # Sample URLs in SAMPLE_EMAIL_CONTEXTS are authored against a placeholder
    # localhost origin; swap in the real configured frontend origin so admin
    # template previews reflect the actual deployed domain.
    base = get_frontend_base_url()
    placeholder = "http://localhost:8080"
    for key, value in ctx.items():
        if isinstance(value, str) and value.startswith(placeholder):
            ctx[key] = base + value[len(placeholder):]
    from urllib.parse import urlparse
    ctx.setdefault("portal_domain", urlparse(base).netloc or base)
    return ctx

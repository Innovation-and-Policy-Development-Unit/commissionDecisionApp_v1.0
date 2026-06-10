"""
Formal decision service + acknowledgement.

The Secretariat serves the Commission's outcome letter on the ministry as an
immutable snapshot (text + WeasyPrint PDF + SHA-256); ministry users must
acknowledge receipt in-system. Everything is timestamped and audited, closing
the "we never received it" gap.
"""

from __future__ import annotations

import hashlib
import json
import logging

from django.utils import timezone

logger = logging.getLogger("scdms.app")

# Stages from which a decision can be formally served
SERVABLE_STAGES = frozenset({
    "approved",
    "rejected",
    "minutes_drafted_signed",
    "decision_entered_assigned",
    "under_implementation",
    "implementation_report",
})

MINISTRY_ACK_ROLES = frozenset({"ministry_hr", "dept_admin", "head_of_agency"})


def ministry_recipients(submission):
    """Active ministry-side users who receive (and may acknowledge) service:
    the ministry's HR officers and Head of Agency."""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    if not submission.ministry_id:
        return User.objects.none()
    return User.objects.filter(
        is_active=True,
        psc_profile__role__in=list(MINISTRY_ACK_ROLES),
        psc_profile__ministry_id=submission.ministry_id,
    ).select_related("psc_profile")


def _service_payload(submission, *, outcome, subject, body, served_by) -> dict:
    return {
        "v": 1,
        "submission_id": submission.id,
        "reference_number": submission.reference_number or "",
        "ministry_id": submission.ministry_id,
        "decision_outcome": outcome,
        "letter_subject": subject,
        "letter_body": body,
        "served_by_id": served_by.id,
        "served_by_username": served_by.username,
        "served_at": timezone.now().isoformat(),
    }


def _hash_payload(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def derive_decision_outcome(submission) -> str:
    """Stage value of the recorded Commission decision (approved/rejected/…),
    from the latest decision-stage WorkflowEvent, falling back to the
    current stage."""
    from .models import WorkflowEvent

    last_decision = (
        WorkflowEvent.objects.filter(
            submission=submission,
            new_stage__in=["approved", "rejected", "returned"],
        )
        .order_by("-created_at")
        .first()
    )
    if last_decision:
        return last_decision.new_stage
    return submission.current_stage


def render_service_letter_pdf(service) -> None:
    """Render the served letter as a formal PDF and attach it to the record."""
    from io import BytesIO

    from django.core.files.base import ContentFile
    from django.template.loader import render_to_string
    from weasyprint import HTML

    from .models import WorkflowStage

    stage_labels = dict(WorkflowStage.choices)
    html = render_to_string("tracker/decision_service_letter_pdf.html", {
        "service": service,
        "submission": service.submission,
        "outcome_label": stage_labels.get(service.decision_outcome, service.decision_outcome),
        "served_on": timezone.localtime(service.served_at or timezone.now()),
    })

    buf = BytesIO()
    HTML(string=html).write_pdf(buf)
    buf.seek(0)

    filename = f"decision_service_{service.submission.reference_number}_{service.pk}.pdf"
    service.letter_pdf.save(filename.replace("/", "-"), ContentFile(buf.read()), save=False)
    service.save(update_fields=["letter_pdf"])


def serve_decision(submission, *, served_by, letter_subject: str, letter_body: str):
    """Create the immutable service record, render the PDF, supersede any
    earlier unacknowledged service, and notify the ministry. Returns the
    DecisionService row."""
    from .email_notify import send_email_to_user
    from .models import DecisionService, Notification

    outcome = derive_decision_outcome(submission)
    payload = _service_payload(
        submission, outcome=outcome, subject=letter_subject,
        body=letter_body, served_by=served_by,
    )

    # A corrected letter supersedes earlier unacknowledged services; an
    # acknowledged service is history and stays untouched.
    DecisionService.objects.filter(
        submission=submission, acknowledged_at__isnull=True, superseded=False,
    ).update(superseded=True)

    service = DecisionService.objects.create(
        submission=submission,
        ministry=submission.ministry,
        decision_outcome=outcome,
        letter_subject=letter_subject,
        letter_body=letter_body,
        content_hash=_hash_payload(payload),
        proof_payload=payload,
        served_by=served_by,
    )
    render_service_letter_pdf(service)

    outcome_label = outcome.replace("_", " ").title()
    for user in ministry_recipients(submission):
        Notification.objects.create(
            recipient=user,
            submission=submission,
            channel=Notification.Channel.BOTH,
            title=f"Commission decision served: {submission.reference_number}",
            body=(
                f'The Commission\'s decision on "{submission.title}" '
                f"({outcome_label}) has been formally served on your ministry. "
                f"Please open the submission and acknowledge receipt."
            ),
        )
        send_email_to_user(
            user,
            subject=f"[ACTION REQUIRED] Commission decision served — {submission.reference_number}",
            body=(
                f"Dear {user.get_full_name() or user.username},\n\n"
                f'The Public Service Commission\'s decision on "{submission.title}" '
                f"({submission.reference_number}) has been formally served on your ministry.\n\n"
                f"Outcome: {outcome_label}\n"
                f"Subject: {letter_subject or '—'}\n\n"
                f"Please log in to SCDMS, review the outcome letter, and acknowledge "
                f"receipt. The acknowledgement is recorded with your name and a timestamp.\n"
            ),
        )

    logger.info(
        "DECISION_SERVED | %s | service #%s | hash %s",
        submission.reference_number, service.id, service.content_hash[:16],
    )
    return service


def acknowledge_service(service, *, user, note: str = ""):
    """Record the ministry's acknowledgement and notify the Secretariat."""
    from .email_notify import send_email_to_user
    from .models import Notification

    service.acknowledged_by = user
    service.acknowledged_at = timezone.now()
    service.acknowledgement_note = note
    service.save(update_fields=["acknowledged_by", "acknowledged_at", "acknowledgement_note"])

    submission = service.submission
    Notification.objects.create(
        recipient=service.served_by,
        submission=submission,
        channel=Notification.Channel.BOTH,
        title=f"Decision service acknowledged: {submission.reference_number}",
        body=(
            f"{user.get_full_name() or user.username} acknowledged receipt of the "
            f'decision on "{submission.title}"'
            + (f' — "{note}"' if note else ".")
        ),
    )
    send_email_to_user(
        service.served_by,
        subject=f"Decision service acknowledged — {submission.reference_number}",
        body=(
            f"{user.get_full_name() or user.username} ({submission.ministry.name}) "
            f"acknowledged receipt of the served decision on "
            f"{timezone.localtime(service.acknowledged_at):%d %B %Y at %H:%M}."
            + (f"\n\nNote from the ministry: {note}" if note else "")
        ),
    )

    logger.info(
        "DECISION_ACKNOWLEDGED | %s | service #%s | by %s",
        submission.reference_number, service.id, user.username,
    )
    return service

"""
Director-General approval by emailed link.

HR sends a ministry paper to the DG (Draft -> Pending DG Endorsement). The DG gets
an email with a single-use link; the link opens a public page where the DG reviews
the paper and approves it or returns it to HR, confirming with their session PIN.
Approval hands the paper to PSC the same way the in-app /endorse/ action does.

This module holds the rules (switch, who the DG is, token lifecycle). The state
changes themselves live on SubmissionViewSet (`_complete_dg_endorsement`,
`_return_from_dg`) so the in-app and emailed routes share one implementation.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password
from django.utils import timezone

from .models import DGApprovalToken, Profile, Role, SystemSetting, WorkflowStage

logger = logging.getLogger("scdms.app")

SETTING_ENABLED = "DG_EMAIL_APPROVAL_ENABLED"
# Comma-separated ministry codes the feature is limited to; blank = every ministry.
SETTING_MINISTRIES = "DG_EMAIL_APPROVAL_MINISTRIES"
SETTING_REQUIRE_PIN = "DG_APPROVAL_REQUIRE_PIN"

TOKEN_TTL_DAYS = 7
MAX_PIN_ATTEMPTS = 5
REMINDER_AFTER_DAYS = 3


class DGApprovalError(Exception):
    """A reason a paper cannot go to the DG, worded for HR."""


def email_approval_enabled() -> bool:
    return SystemSetting.get_bool(SETTING_ENABLED, default=False)


def pin_required() -> bool:
    return SystemSetting.get_bool(SETTING_REQUIRE_PIN, default=True)


def _allowed_ministry_codes() -> set[str]:
    raw = SystemSetting.get_val(SETTING_MINISTRIES) or ""
    return {c.strip().upper() for c in raw.split(",") if c.strip()}


def is_ministry_paper(submission) -> bool:
    """Only ministry-origin papers carry a DG approval; OPSC-internal, secretary-only
    and scanned-lodged papers never go through the DG."""
    return not (submission.is_internal or submission.secretary_only or submission.lodged_from_paper)


def resolve_dg(submission):
    """The one active Director-General account for the paper's ministry.

    Exactly one active Head of Agency with an email address must exist. When the
    DG is absent, OPSC enables the acting DG's account (and disables the DG's), so
    there is never a second person to ask and never a fallback address.
    """
    if not submission.ministry_id:
        raise DGApprovalError("This submission has no ministry, so there is no Director-General to approve it.")
    dgs = list(
        Profile.objects.filter(
            role=Role.HEAD_OF_AGENCY, ministry_id=submission.ministry_id, user__is_active=True,
        ).select_related("user")
    )
    if not dgs:
        raise DGApprovalError(
            "Your ministry has no active Director-General account in SCDMS. Ask OPSC to create "
            "one (or the acting DG's), or use 'DG signed on paper'."
        )
    if len(dgs) > 1:
        raise DGApprovalError(
            "Your ministry has more than one active Director-General account. Ask OPSC to "
            "leave only the current (or acting) DG active, or use 'DG signed on paper'."
        )
    user = dgs[0].user
    if not (user.email or "").strip():
        raise DGApprovalError(
            "The Director-General's account has no email address. Ask OPSC to add it, or use "
            "'DG signed on paper'."
        )
    return user


def feature_active_for(submission) -> bool:
    """Whether the emailed approval is switched on for this paper's ministry. Separate
    from can_send_to_dg so the UI can say nothing while the feature is off, and explain
    what is missing (e.g. no DG account) once it is on."""
    if not email_approval_enabled():
        return False
    codes = _allowed_ministry_codes()
    if codes and (not submission.ministry_id or submission.ministry.code.upper() not in codes):
        return False
    return is_ministry_paper(submission)


def can_send_to_dg(submission) -> tuple[bool, str]:
    """(ok, reason) for the 'Send to DG' action — used to hide it and to enforce it."""
    if not email_approval_enabled():
        return False, "Sending to the Director-General for approval is not enabled yet."
    codes = _allowed_ministry_codes()
    if codes and (not submission.ministry_id or submission.ministry.code.upper() not in codes):
        return False, "Sending to the Director-General for approval is not enabled for your ministry yet."
    if not is_ministry_paper(submission):
        return False, "Only ministry papers go to a Director-General for approval."
    try:
        resolve_dg(submission)
    except DGApprovalError as exc:
        return False, str(exc)
    return True, ""


# ── tokens ───────────────────────────────────────────────────────────────────

def _hash(raw: str) -> str:
    return hashlib.sha256((raw or "").encode()).hexdigest()


def cancel_tokens(submission) -> int:
    """Cancel every live link for the paper (resend, recall, return, approval)."""
    return DGApprovalToken.objects.filter(
        submission=submission, used_at__isnull=True, cancelled_at__isnull=True,
    ).update(cancelled_at=timezone.now())


def issue_token(submission, dg_user) -> tuple[DGApprovalToken, str]:
    """Create a fresh link, cancelling any earlier one. Returns (row, raw token);
    the raw token exists only here and in the email."""
    cancel_tokens(submission)
    raw = secrets.token_urlsafe(32)
    row = DGApprovalToken.objects.create(
        submission=submission, dg_user=dg_user, token_hash=_hash(raw),
        expires_at=timezone.now() + timedelta(days=TOKEN_TTL_DAYS),
    )
    return row, raw


def find_live_token(raw: str) -> DGApprovalToken | None:
    """The usable token for a raw link value, or None for anything else (unknown,
    used, cancelled, expired, or the paper is no longer awaiting the DG). Callers
    must give the same reply for all of those."""
    if not raw or len(raw) > 128:
        return None
    row = (
        DGApprovalToken.objects.select_related("submission", "dg_user")
        .filter(token_hash=_hash(raw)).first()
    )
    if row is None or not row.is_active():
        return None
    if row.submission.current_stage != WorkflowStage.PENDING_DG_ENDORSEMENT:
        return None
    if not row.dg_user.is_active:
        return None
    return row


def check_pin(token: DGApprovalToken, pin: str) -> tuple[bool, str]:
    """Verify the DG's session PIN for an approve/return. Five wrong PINs cancel the
    link (HR must resend), so a stolen email cannot be used to guess the PIN."""
    if not pin_required():
        return True, ""
    profile = getattr(token.dg_user, "psc_profile", None)
    if profile is None or not profile.session_pin:
        return False, "no_pin"
    if check_password((pin or "").strip(), profile.session_pin):
        return True, ""
    token.failed_pin_attempts += 1
    if token.failed_pin_attempts >= MAX_PIN_ATTEMPTS:
        token.cancelled_at = timezone.now()
        token.expiry_notified_at = token.cancelled_at
        token.save(update_fields=["failed_pin_attempts", "cancelled_at", "expiry_notified_at"])
        try:
            notify_hr_link_dead(token.submission, reason="was cancelled after too many wrong PINs")
        except Exception:
            logger.exception("DG lock-out notice failed for %s", token.submission.reference_number)
        return False, "locked"
    token.save(update_fields=["failed_pin_attempts"])
    return False, "wrong_pin"


def consume(token: DGApprovalToken, outcome: str, ip: str | None, user_agent: str) -> None:
    token.used_at = timezone.now()
    token.outcome = outcome
    token.used_ip = ip or None
    token.used_user_agent = (user_agent or "")[:512]
    token.save(update_fields=["used_at", "outcome", "used_ip", "used_user_agent"])


# ── the record of the approval, for printed papers ──────────────────────────────

def approval_statement(submission) -> str:
    """One plain sentence stating how the Director-General approved, for the printed
    submission summary. Electronic approvals say so (and that no handwritten signature
    exists); papers approved on paper repeat HR's attestation as such."""
    name = (submission.dg_approval_name or "").strip()
    if not name:
        return ""
    method = submission.dg_approval_method
    if method in ("email_link", "in_app") and submission.dg_endorsed_at:
        when = timezone.localtime(submission.dg_endorsed_at)
        how = (
            "by emailed link, confirmed with the Director-General's SCDMS PIN"
            if method == "email_link" else "while signed in to SCDMS"
        )
        ministry = submission.ministry.name if submission.ministry_id else "the ministry"
        return (
            f"Approved electronically by {name}, Director-General, {ministry}, on "
            f"{when:%d %B %Y} at {when:%H:%M} ({how}). This is a system record; the paper "
            "carries no handwritten signature."
        )
    if submission.dg_approval_date:
        return (
            f"Director-General approval: {name}, signed on paper on {submission.dg_approval_date:%d %B %Y} "
            "(recorded by ministry HR when the paper was submitted)."
        )
    return ""


# ── email ────────────────────────────────────────────────────────────────────

def approval_url(raw: str) -> str:
    from .email_templates import get_frontend_base_url

    return f"{get_frontend_base_url()}/dg-approval/{raw}"


def send_approval_email(submission, dg_user, raw: str, *, reminder: bool = False) -> bool:
    from .email_notify import merge_recipient_context, submission_email_context
    from .email_templates import send_templated_email

    ctx = merge_recipient_context(
        dg_user,
        **submission_email_context(submission),
        approval_url=approval_url(raw),
        expiry_days=str(TOKEN_TTL_DAYS),
        reminder_note=(
            "Reminder: this is waiting for your approval, and this link replaces the one we "
            "sent earlier. " if reminder else ""
        ),
    )
    return send_templated_email(slug="submission_dg_approval_link", to=[dg_user.email.strip()], context=ctx)


def issue_and_send(submission, *, reminder: bool = False) -> bool:
    """Issue a new link to the ministry's DG and email it. Returns whether the email
    was handed to the mail backend; the link exists either way, so HR can resend."""
    dg = resolve_dg(submission)
    row, raw = issue_token(submission, dg)
    try:
        # The page works without the summary, so a failure here must never stop the link.
        from .tasks import queue_dg_brief

        queue_dg_brief(submission.id)
    except Exception:
        logger.exception("DG summary could not be queued for %s", submission.reference_number)
    if reminder:
        # Marks the paper as reminded: the new token carries it, so the daily job
        # sends one reminder per paper, not one every few days.
        row.last_reminded_at = timezone.now()
        row.save(update_fields=["last_reminded_at"])
    return send_approval_email(submission, dg, raw, reminder=reminder)


# ── follow-ups: day-3 reminder to the DG, expiry / lock-out notice to HR ─────────

def _hr_user(submission):
    user = submission.created_by
    return user if user is not None and user.is_active else None


def notify_hr_link_dead(submission, *, reason: str) -> None:
    """Tell HR the DG's link no longer works, so the paper is not left waiting on a
    dead link. In-app notice plus an email; `reason` is a short phrase for both."""
    from .email_notify import merge_recipient_context, submission_email_context
    from .email_templates import send_templated_email
    from .models import Notification

    hr = _hr_user(submission)
    if hr is None:
        return
    dg = (
        DGApprovalToken.objects.filter(submission=submission).select_related("dg_user")
        .order_by("-created_at").first()
    )
    dg_name = (dg.dg_user.get_full_name() or dg.dg_user.username) if dg else "the Director-General"
    Notification.objects.create(
        recipient=hr, submission=submission, channel=Notification.Channel.BOTH,
        title=f"DG approval link needs resending: {submission.reference_number}",
        body=(
            f"The approval link sent to {dg_name} for '{submission.title}' {reason}. "
            "Open the submission and use Resend link to DG — or the DG can sign in and approve."
        ),
    )
    send_templated_email(
        slug="submission_dg_link_expired", to=[hr.email.strip()] if (hr.email or "").strip() else [],
        context=merge_recipient_context(
            hr, **submission_email_context(submission), dg_name=dg_name, reason=reason,
        ),
    )


def run_follow_ups(now=None) -> dict:
    """The daily job. (1) One reminder to the DG for a paper still waiting after
    REMINDER_AFTER_DAYS — a fresh link, since the first can't be shown again.
    (2) One notice to HR for a paper whose latest link has expired unused."""
    now = now or timezone.now()
    reminded = expired = 0

    cutoff = now - timedelta(days=REMINDER_AFTER_DAYS)
    due = (
        DGApprovalToken.objects.filter(
            used_at__isnull=True, cancelled_at__isnull=True, expires_at__gt=now,
            created_at__lte=cutoff, submission__current_stage=WorkflowStage.PENDING_DG_ENDORSEMENT,
        ).select_related("submission")
    )
    for token in due:
        submission = token.submission
        if DGApprovalToken.objects.filter(submission=submission, last_reminded_at__isnull=False).exists():
            continue
        try:
            issue_and_send(submission, reminder=True)
            reminded += 1
        except DGApprovalError:
            logger.warning("DG reminder skipped for %s: no usable DG", submission.reference_number)
        except Exception:
            logger.exception("DG reminder failed for %s", submission.reference_number)

    lapsed = (
        DGApprovalToken.objects.filter(
            used_at__isnull=True, cancelled_at__isnull=True, expires_at__lte=now,
            expiry_notified_at__isnull=True,
            submission__current_stage=WorkflowStage.PENDING_DG_ENDORSEMENT,
        ).select_related("submission")
    )
    for token in lapsed:
        latest = (
            DGApprovalToken.objects.filter(submission=token.submission).order_by("-created_at").first()
        )
        token.expiry_notified_at = now
        token.save(update_fields=["expiry_notified_at"])
        if latest and latest.pk == token.pk:
            try:
                notify_hr_link_dead(token.submission, reason="has expired")
                expired += 1
            except Exception:
                logger.exception("DG expiry notice failed for %s", token.submission.reference_number)
    return {"reminded": reminded, "expired": expired}

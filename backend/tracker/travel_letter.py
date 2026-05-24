"""Generate official travel approval letters (PSC Forms 4.5 & 4.6)."""

from __future__ import annotations

from django.utils import timezone

from .models import FormSectionSignature, TravelApprovalLetter


def _form_data(submission) -> dict:
    try:
        return submission.dynamic_form_response.data or {}
    except Exception:
        return {}


def build_travel_approval_letter(submission, *, secretary_user) -> TravelApprovalLetter:
    data = _form_data(submission)
    ref = submission.reference_number
    form_code = submission.form_type_code or ""
    today = timezone.localdate().strftime("%d %B %Y")

    if form_code == "PSC 4.5":
        subject = f"Overseas travel approval — {data.get('applicant_name', submission.title)} ({ref})"
        purpose = data.get("travel_purpose", submission.title)
        duration = f"{data.get('duration_from', '')} to {data.get('duration_to', '')}"
        body_text = (
            f"PUBLIC SERVICE COMMISSION\n"
            f"Port Vila, Vanuatu\n"
            f"Date: {today}\n\n"
            f"Reference: {ref}\n\n"
            f"TO: {data.get('ministry_name', submission.ministry.name if submission.ministry_id else 'Ministry')}\n"
            f"    {data.get('department_name', '')}\n\n"
            f"RE: Approval for overseas travel — {data.get('applicant_name', '')}\n\n"
            f"I refer to PSC Form 4.5 submitted for the above-named officer.\n\n"
            f"Purpose: {purpose}\n"
            f"Duration: {duration}\n\n"
            f"The Public Service Commission APPROVES the proposed overseas travel, "
            f"subject to the conditions stated in the submitted application and applicable "
            f"Public Service regulations.\n\n"
            f"The officer is required to submit a detailed report on the benefits to Vanuatu "
            f"to their Director and Director-General within one week of return.\n\n"
            f"Yours faithfully,\n\n"
            f"_________________________\n"
            f"Secretary to the Public Service Commission\n"
        )
    else:
        subject = f"Mission group overseas travel approval ({ref})"
        purpose = data.get("mission_purpose", submission.title)
        body_text = (
            f"PUBLIC SERVICE COMMISSION\n"
            f"Port Vila, Vanuatu\n"
            f"Date: {today}\n\n"
            f"Reference: {ref}\n\n"
            f"RE: Approval for mission group overseas travel\n\n"
            f"I refer to PSC Form 4.6 submitted by {submission.created_by.get_full_name() or submission.created_by.username}.\n\n"
            f"Mission purpose: {purpose}\n\n"
            f"The Public Service Commission APPROVES the proposed mission group overseas travel, "
            f"subject to the conditions stated in the submitted application.\n\n"
            f"The mission leader shall coordinate a detailed report on the benefits to Vanuatu "
            f"to the relevant Director and Director-General within one week of the group's return.\n\n"
            f"Yours faithfully,\n\n"
            f"_________________________\n"
            f"Secretary to the Public Service Commission\n"
        )

    body_html = f"<pre style=\"font-family:serif;white-space:pre-wrap\">{body_text}</pre>"

    letter, _ = TravelApprovalLetter.objects.update_or_create(
        submission=submission,
        defaults={
            "subject": subject,
            "body_text": body_text,
            "body_html": body_html,
            "issued_by": secretary_user,
        },
    )
    return letter


def secretary_decision_record(submission) -> FormSectionSignature | None:
    return (
        FormSectionSignature.objects.filter(
            submission=submission, section_key="secretary_decision"
        )
        .select_related("signed_by")
        .first()
    )

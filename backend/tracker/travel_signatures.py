"""Travel form endorsement signature helpers."""

from __future__ import annotations

from django.core.files.base import ContentFile

from .models import FormSectionSignature, Notification
from .travel_forms import (
    endorsement_sections,
    recipient_for_signer_slot,
    secretary_decision_section,
    sync_travel_endorsers_from_roles,
    user_may_sign_section,
)


def signed_section_keys(submission) -> set[str]:
    return set(
        FormSectionSignature.objects.filter(submission=submission).values_list(
            "section_key", flat=True
        )
    )


def endorsements_complete(submission) -> bool:
    if not submission.secretary_only:
        return True
    signed = signed_section_keys(submission)
    for section in endorsement_sections(submission.form_type_code or "", submission):
        if section["key"] not in signed:
            return False
    return True


def copy_profile_signature(profile) -> ContentFile | None:
    if not profile or not profile.signature:
        return None
    try:
        profile.signature.open("rb")
        data = profile.signature.read()
        profile.signature.close()
        if not data:
            return None
        return ContentFile(data, name=profile.signature.name.split("/")[-1])
    except Exception:
        return None


def sign_travel_section(
    *,
    submission,
    user,
    section_key: str,
    approved: bool | None = None,
    remarks: str = "",
) -> FormSectionSignature:
    from .travel_forms import is_travel_form_code

    if not submission.secretary_only or not is_travel_form_code(submission.form_type_code):
        raise ValueError("Not a travel submission.")

    sections = endorsement_sections(submission.form_type_code, submission)
    sec = secretary_decision_section(submission.form_type_code)
    if sec and sec["key"] == section_key:
        section = sec
    else:
        section = next((s for s in sections if s["key"] == section_key), None)
    if not section:
        raise ValueError(f"Unknown endorsement section: {section_key}")

    endorsers = submission.travel_endorsers or {}
    if not user_may_sign_section(
        section=section, user=user, submission=submission, endorsers=endorsers
    ):
        from django.core.exceptions import PermissionDenied

        raise PermissionDenied("You are not authorised to sign this section.")

    try:
        profile = user.psc_profile
    except Exception:
        profile = None

    sig_file = copy_profile_signature(profile)
    obj, _ = FormSectionSignature.objects.update_or_create(
        submission=submission,
        section_key=section_key,
        defaults={
            "signed_by": user,
            "signer_name": user.get_full_name() or user.username,
            "approved": approved,
            "remarks": remarks,
        },
    )
    if sig_file:
        obj.signature_image.save(sig_file.name, sig_file, save=True)

    if section_key != "secretary_decision":
        _notify_next_endorser(submission, section_key)
    return obj


def notify_first_pending_endorser(submission) -> None:
    """Tell the first unsigned ministry endorser their signature is required."""
    signed = signed_section_keys(submission)
    for section in endorsement_sections(submission.form_type_code or "", submission):
        if section["key"] in signed:
            continue
        recipient = recipient_for_signer_slot(submission, section.get("signer"))
        if recipient:
            Notification.objects.create(
                recipient=recipient,
                title=f"Travel form endorsement required ({submission.reference_number})",
                body=f"Please digitally sign “{section['label']}” for {submission.title}.",
                submission=submission,
            )
        break


def _notify_next_endorser(submission, completed_key: str) -> None:
    sections = endorsement_sections(submission.form_type_code, submission)
    keys = [s["key"] for s in sections]
    if completed_key not in keys:
        return
    idx = keys.index(completed_key)
    signed = signed_section_keys(submission)
    for nxt in sections[idx + 1 :]:
        if nxt["key"] in signed:
            continue
        recipient = recipient_for_signer_slot(submission, nxt.get("signer"))
        if not recipient:
            endorsers = submission.travel_endorsers or {}
            uid = endorsers.get(nxt["signer"]) or endorsers.get(f"{nxt['signer']}_id")
            if uid:
                from django.contrib.auth.models import User

                recipient = User.objects.filter(pk=uid, is_active=True).first()
        if recipient:
            Notification.objects.create(
                recipient=recipient,
                title=f"Travel form endorsement required ({submission.reference_number})",
                body=f"Please digitally sign the “{nxt['label']}” section for {submission.title}.",
                submission=submission,
            )
        break


def ensure_travel_endorsers_synced(submission) -> None:
    """After create/update, align travel_endorsers with role-based routing."""
    if not submission.secretary_only:
        return
    endorsers = sync_travel_endorsers_from_roles(submission)
    if endorsers != (submission.travel_endorsers or {}):
        submission.travel_endorsers = endorsers
        submission.save(update_fields=["travel_endorsers", "updated_at"])

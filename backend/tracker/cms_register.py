"""Create CDP submissions from CMS cases (CMS-first compliance workflow)."""

from __future__ import annotations

import logging

from django.contrib.auth import get_user_model
from django.utils import timezone

from .compliance_forms import (
    COMPLIANCE_CATEGORY_CODE,
    COMPLIANCE_FORM_CODES,
    form_type_for_cms_case,
)
from .models import (
    FormCategory,
    Ministry,
    PSCFormType,
    Role,
    RoutedUnit,
    Submission,
    WorkflowEvent,
    WorkflowStage,
)

logger = logging.getLogger(__name__)

CMS_ORIGIN_MESSAGE = (
    "Compliance cases must be created in the Case Management System. "
    "Register the case with the Commission Portal from CMS when it is ready for Secretary review."
)


def _resolve_opsc_ministry_id():
    ministry = Ministry.objects.filter(code__iexact="OPSC").first()
    if ministry:
        return ministry.pk
    ministry = Ministry.objects.filter(name__icontains="Public Service Commission").first()
    return ministry.pk if ministry else None


def _resolve_created_by(username: str | None):
    User = get_user_model()
    if username:
        user = User.objects.filter(username=username).first()
        if user:
            return user
    user = (
        User.objects.filter(psc_profile__role=Role.COMPLIANCE_MANAGER, is_active=True).first()
        or User.objects.filter(psc_profile__role=Role.PSC_ADMIN, is_active=True).first()
        or User.objects.filter(is_superuser=True).first()
    )
    if not user:
        raise ValueError("No active user available to attribute CMS-registered submission.")
    return user


def register_submission_from_cms(*, payload: dict) -> Submission:
    """
    Idempotent: if cms_case_id already linked, return existing submission.

    Expected payload keys:
      cms_case_id, cms_case_reference, title, case_family, form_type_code (optional),
      subject_ministry, notes, registered_by (username, optional)
    """
    cms_case_id = str(payload.get("cms_case_id", "")).strip()
    if not cms_case_id:
        raise ValueError("cms_case_id is required.")

    existing = Submission.objects.filter(cms_case_id=cms_case_id).first()
    if existing:
        return existing

    form_type_code = form_type_for_cms_case(
        payload.get("case_family", ""),
        payload.get("form_type_code"),
    )
    if form_type_code not in COMPLIANCE_FORM_CODES:
        raise ValueError(f"Unsupported compliance form type: {form_type_code}")

    form_type = PSCFormType.objects.filter(code=form_type_code, is_active=True).select_related(
        "form_category"
    ).first()
    if not form_type:
        raise ValueError(f"Form type {form_type_code} is not configured in the portal.")

    ministry_id = _resolve_opsc_ministry_id()
    if not ministry_id:
        raise ValueError("OPSC ministry is not configured in the portal.")

    user = _resolve_created_by(payload.get("registered_by"))
    cdp_base = payload.get("cdp_callback_url") or ""
    if not cdp_base:
        from django.conf import settings
        cdp_base = getattr(settings, "CDP_BASE_URL", "").rstrip("/")
    callback_url = f"{cdp_base}/api/webhooks/cms-signoff/" if cdp_base else ""

    category = form_type.form_category
    if not category:
        category = FormCategory.objects.filter(code=COMPLIANCE_CATEGORY_CODE).first()

    title = (payload.get("title") or payload.get("description") or form_type.name).strip()
    if not title:
        title = form_type.name

    initial_stage = WorkflowStage.SECRETARY_REVIEW
    sub = Submission(
        title=title[:255],
        form_type_code=form_type_code,
        form_category=category,
        ministry_id=ministry_id,
        routed_unit=RoutedUnit.COMPLIANCE,
        is_internal=True,
        current_stage=initial_stage,
        received_at=timezone.now(),
        notes=(payload.get("notes") or "").strip(),
        cms_case_id=cms_case_id,
        cms_case_reference=(payload.get("cms_case_reference") or "").strip(),
        cms_dispatched_at=timezone.now(),
        created_by=user,
    )
    sub.save()
    WorkflowEvent.objects.create(
        submission=sub,
        actor=user,
        actor_label=f"CMS / {payload.get('registered_by') or user.username}",
        previous_stage=WorkflowStage.SUBMITTED,
        new_stage=initial_stage,
        remarks=(
            f"Registered from CMS case {payload.get('cms_case_reference') or cms_case_id}. "
            "Manager-approved compliance submission — Secretary review."
        ).strip(),
    )
    logger.info(
        "register_submission_from_cms: CMS case %s → CDP %s at %s",
        cms_case_id,
        sub.reference_number,
        initial_stage,
    )
    return sub

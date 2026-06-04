"""
Compliance workflow actions — create a case, run manager approval, triage complaints.

A compliance matter is a :class:`tracker.models.Submission` (OPSC-internal, routed to
the Compliance unit) with a one-to-one :class:`ComplianceCase` carrying subject/family/
statutory data. Senior/Principal-created cases require Compliance Manager approval
before they reach Secretary review; Manager-created cases go straight to the Secretary.
All of this runs inside SCDMS — there is no external system.
"""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from .compliance_forms import COMPLIANCE_CATEGORY_CODE
from .compliance_models import ComplaintStatus, ComplianceCase
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

MANAGER_ROLES = frozenset({Role.COMPLIANCE_MANAGER, Role.PSC_ADMIN})
SENIOR_PRINCIPAL_ROLES = frozenset({Role.COMPLIANCE_SENIOR, Role.COMPLIANCE_PRINCIPAL})


def requires_manager_approval(role: str) -> bool:
    """Senior/Principal-created cases need Compliance Manager sign-off; Managers don't."""
    return role in SENIOR_PRINCIPAL_ROLES


def _opsc_ministry():
    return (
        Ministry.objects.filter(code__iexact="OPSC").first()
        or Ministry.objects.filter(name__icontains="Public Service Commission").first()
    )


def _log_move(sub, actor, new_stage, remarks):
    prev = sub.current_stage
    sub.current_stage = new_stage
    sub.save(update_fields=["current_stage"])
    WorkflowEvent.objects.create(
        submission=sub,
        actor=actor,
        actor_label=getattr(actor, "username", "") or "compliance",
        previous_stage=prev,
        new_stage=new_stage,
        remarks=remarks,
    )


@transaction.atomic
def create_compliance_case(
    *,
    creator,
    case_family,
    subject_name,
    subject_position="",
    subject_ministry="",
    is_senior_executive=False,
    form_type_code="COMP-SMDR",
    title="",
    description="",
    complaint=None,
) -> ComplianceCase:
    """Create the linked Submission (DRAFT, internal, Compliance) + ComplianceCase.

    Statutory stages are materialised by the ComplianceCase post_save signal.
    If ``complaint`` is given, it is linked and marked converted.
    """
    ministry = _opsc_ministry()
    if not ministry:
        raise ValueError("OPSC ministry is not configured in the system.")

    ft = (
        PSCFormType.objects.filter(code=form_type_code, is_active=True)
        .select_related("form_category")
        .first()
    )
    category = ft.form_category if ft else FormCategory.objects.filter(code=COMPLIANCE_CATEGORY_CODE).first()

    sub = Submission.objects.create(
        title=(title or subject_name or "Compliance matter")[:255],
        form_type_code=form_type_code,
        form_category=category,
        ministry=ministry,
        routed_unit=RoutedUnit.COMPLIANCE,
        is_internal=True,
        current_stage=WorkflowStage.DRAFT,
        received_at=timezone.now(),
        notes=description or "",
        created_by=creator,
        agenda_category="discipline_compliance",
    )
    case = ComplianceCase.objects.create(
        submission=sub,
        case_family=case_family,
        subject_name=subject_name,
        subject_position=subject_position,
        subject_ministry=subject_ministry,
        is_senior_executive=is_senior_executive,
        description=description,
    )
    if complaint is not None:
        complaint.compliance_case = case
        complaint.status = ComplaintStatus.CONVERTED
        complaint.triaged_at = timezone.now()
        complaint.save(update_fields=["compliance_case", "status", "triaged_at"])
    return case


def submit_compliance_case(case: ComplianceCase, actor, actor_role: str) -> ComplianceCase:
    """Senior/Principal → Pending Manager Approval; Manager → straight to Secretary."""
    sub = case.submission
    if requires_manager_approval(actor_role):
        _log_move(sub, actor, WorkflowStage.PENDING_MANAGER_APPROVAL,
                  "Submitted for Compliance Manager approval.")
    else:
        _log_move(sub, actor, WorkflowStage.SECRETARY_REVIEW,
                  "Compliance Manager submitted the case to Secretary review.")
    return case


def approve_compliance_case(case: ComplianceCase, manager) -> ComplianceCase:
    """Compliance Manager approves → forwarded to Secretary review."""
    _log_move(case.submission, manager, WorkflowStage.SECRETARY_REVIEW,
              "Approved by Compliance Manager — forwarded to Secretary review.")
    return case


def return_compliance_case(case: ComplianceCase, manager, reason="") -> ComplianceCase:
    """Compliance Manager returns the case to the originating officer for changes."""
    remark = "Returned by Compliance Manager for changes."
    if reason:
        remark += f" Reason: {reason}"
    _log_move(case.submission, manager, WorkflowStage.DRAFT, remark)
    return case

"""OPSC-internal papers authored by the HR Unit itself.

The SEO Performance Agreement progress report is HRM's own paper: nobody outside OPSC
lodges it, so it is created in SCDMS by the HR Unit, kept PSC-staff-only
(``is_internal=True``) and routed to the HR Unit from the start. It climbs the same
Senior -> Principal -> Manager ladder Compliance uses and the Manager's approval lands
at the Secretary Approval Gate, with no separate HR checklist review (the unit wrote it).

Every other HR Unit submission type is still lodged by ministries, and HR staff cannot
create those.
"""

from __future__ import annotations

from .models import Role

HR_INTERNAL_FORM_CODES = frozenset({"SEO-PA-REPORT"})

HR_UNIT_AUTHOR_ROLES = frozenset({
    Role.HR_UNIT_SENIOR,
    Role.HR_UNIT_PRINCIPAL,
    Role.HR_UNIT_MANAGER,
})

# Everyone who authors an OPSC-internal paper of their own and climbs the ladder:
# HR (the SEO report) and VIPAM, alongside Compliance (which lists its own roles).
UNIT_AUTHOR_ROLES = HR_UNIT_AUTHOR_ROLES | frozenset({
    Role.VIPAM_SENIOR,
    Role.VIPAM_PRINCIPAL,
    Role.VIPAM_MANAGER,
})

# Who is told when a paper reaches each rung of the ladder, by routed unit.
UNIT_REVIEW_ROLES = {
    "compliance": {"principal": Role.COMPLIANCE_PRINCIPAL, "manager": Role.COMPLIANCE_MANAGER},
    "hr": {"principal": Role.HR_UNIT_PRINCIPAL, "manager": Role.HR_UNIT_MANAGER},
    "vipam": {"principal": Role.VIPAM_PRINCIPAL, "manager": Role.VIPAM_MANAGER},
}


def unit_may_work_on_internal_paper(role, submission) -> bool:
    """A unit's own staff may add to an OPSC-internal paper their unit is drafting.

    True for a Manager, Principal or Senior of the unit that owns an internal paper
    (``routed_unit`` of the paper, or - while that is still blank on a draft - the unit
    its creator belongs to). Papers lodged through the normal route (CSU lodging an
    HR-type paper) belong to the creator until they reach the unit, so are excluded.
    """
    from .models import WorkflowStage
    from .opsc_access import UNIT_STAFF_ROLE_TO_ROUTED_UNIT

    if not submission.is_internal or submission.follows_normal_route:
        return False
    if submission.current_stage not in (
        WorkflowStage.DRAFT, WorkflowStage.RETURNED_FOR_CLARIFICATION,
    ):
        return False
    unit = UNIT_STAFF_ROLE_TO_ROUTED_UNIT.get(role)
    if not unit:
        return False
    if submission.routed_unit:
        return submission.routed_unit == unit
    creator = getattr(submission.created_by, "psc_profile", None)
    return UNIT_STAFF_ROLE_TO_ROUTED_UNIT.get(getattr(creator, "role", None)) == unit

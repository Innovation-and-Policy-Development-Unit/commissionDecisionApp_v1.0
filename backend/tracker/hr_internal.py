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

# ODU's own papers to the Commission, created inside OPSC and walked up the same ladder, with
# the report itself attached as the paper's required document:
#   ODU-TRAVEL-REPORT        overseas travel (total trips, total cost, ...)
#   ODU-OPA-FEEDBACK-REPORT  Organisation Performance Assessment Feedback Report: one paper
#                            covering all ministries, for the Commission to note. ODU's
#                            general submission template (subject, issue, discussion,
#                            recommendation) plus the report.
ODU_TRAVEL_REPORT_CODE = "ODU-TRAVEL-REPORT"
ODU_OPA_FEEDBACK_REPORT_CODE = "ODU-OPA-FEEDBACK-REPORT"
#   ODU-BUSINESS-PLANS / ODU-CORPORATE-PLANS / ODU-ANNUAL-REPORTS
#                            ODU's one paper per type to the Commission, covering every ministry
#                            plan or report ODU has noted (see odu_consolidation.py).
from .odu_checklist_rules import ODU_CONSOLIDATED_FORM_CODES  # noqa: E402

ODU_INTERNAL_FORM_CODES = frozenset({
    ODU_TRAVEL_REPORT_CODE, ODU_OPA_FEEDBACK_REPORT_CODE,
}) | ODU_CONSOLIDATED_FORM_CODES

ODU_UNIT_AUTHOR_ROLES = frozenset({
    Role.ODU_SENIOR,
    Role.ODU_PRINCIPAL,
    Role.ODU_MANAGER,
})

# ODU papers on the general template (Subject, Issue, Discussion, Recommendation) that the AI can
# draft the text of: the three consolidated papers and the Performance Assessment Feedback Report.
ODU_TEMPLATE_DRAFT_FORM_CODES = ODU_CONSOLIDATED_FORM_CODES | frozenset({ODU_OPA_FEEDBACK_REPORT_CODE})

# Internal papers whose required documents are listed and enforced before the author
# sends the paper up the ladder (ministry papers have their own submit gate).
INTERNAL_PAPERS_WITH_REQUIRED_DOCUMENTS = ODU_INTERNAL_FORM_CODES

# Everyone who authors an OPSC-internal paper of their own and climbs the ladder:
# HR (the SEO report), VIPAM and ODU, alongside Compliance (which lists its own roles).
UNIT_AUTHOR_ROLES = HR_UNIT_AUTHOR_ROLES | ODU_UNIT_AUTHOR_ROLES | frozenset({
    Role.VIPAM_SENIOR,
    Role.VIPAM_PRINCIPAL,
    Role.VIPAM_MANAGER,
})

# Who is told when a paper reaches each rung of the ladder, by routed unit.
UNIT_REVIEW_ROLES = {
    "compliance": {"principal": Role.COMPLIANCE_PRINCIPAL, "manager": Role.COMPLIANCE_MANAGER},
    "hr": {"principal": Role.HR_UNIT_PRINCIPAL, "manager": Role.HR_UNIT_MANAGER},
    "vipam": {"principal": Role.VIPAM_PRINCIPAL, "manager": Role.VIPAM_MANAGER},
    "odu": {"principal": Role.ODU_PRINCIPAL, "manager": Role.ODU_MANAGER},
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

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

# Who is told when a paper reaches each rung of the ladder, by routed unit.
UNIT_REVIEW_ROLES = {
    "compliance": {"principal": Role.COMPLIANCE_PRINCIPAL, "manager": Role.COMPLIANCE_MANAGER},
    "hr": {"principal": Role.HR_UNIT_PRINCIPAL, "manager": Role.HR_UNIT_MANAGER},
}

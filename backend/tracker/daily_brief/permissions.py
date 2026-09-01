"""Daily brief API permissions (avoid importing tracker.views)."""

from rest_framework import permissions

from tracker.models import Role
from tracker.rbac import rbac_can_access_admin_panel, rbac_user_can_manage_roles

# OPSC-side roles only — post-decision task processing and checklist review.
# Deliberately excludes ministry-side roles (Head of Agency, Ministry HR,
# Dept Admin) and front-of-house/decision-body roles (Receptionist, PSC
# Officer, Commissioner, Chairperson) that weren't named for this feature.
INBOX_BRIEF_ROLES = {
    Role.PSC_ADMIN,
    Role.PSC_SECRETARY,
    Role.SECRETARY_OPSC,
    Role.PSC_MANAGER,
    Role.VIPAM_MANAGER,
    Role.HR_UNIT_MANAGER,
    Role.ODU_MANAGER,
    Role.COMPLIANCE_MANAGER,
    Role.CSU_MANAGER,
    Role.IPDU_MANAGER,
    Role.PRINCIPAL_OFFICER,
    Role.VIPAM_PRINCIPAL,
    Role.HR_UNIT_PRINCIPAL,
    Role.ODU_PRINCIPAL,
    Role.COMPLIANCE_PRINCIPAL,
    Role.SENIOR_OFFICER,
    Role.VIPAM_SENIOR,
    Role.HR_UNIT_SENIOR,
    Role.ODU_SENIOR,
    Role.CSU_SENIOR,
    Role.COMPLIANCE_SENIOR,
}


class HasAdminPanelAccess(permissions.BasePermission):
    message = "Admin panel access required."

    def has_permission(self, request, view):
        return rbac_can_access_admin_panel(request.user)


class HasManageRoles(permissions.BasePermission):
    message = "You need manage_roles permission, staff/superuser access, or PSC Administrator role."

    def has_permission(self, request, view):
        return rbac_user_can_manage_roles(request.user)


class HasInboxBriefAccess(permissions.BasePermission):
    message = "Inbox brief is available to OPSC unit staff only."

    def has_permission(self, request, view):
        if request.user.is_superuser:
            return True
        profile = getattr(request.user, "psc_profile", None)
        return bool(profile and profile.role in INBOX_BRIEF_ROLES)

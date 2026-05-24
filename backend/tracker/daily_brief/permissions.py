"""Daily brief API permissions (avoid importing tracker.views)."""

from rest_framework import permissions

from tracker.rbac import rbac_can_access_admin_panel, rbac_user_can_manage_roles


class HasAdminPanelAccess(permissions.BasePermission):
    message = "Admin panel access required."

    def has_permission(self, request, view):
        return rbac_can_access_admin_panel(request.user)


class HasManageRoles(permissions.BasePermission):
    message = "You need manage_roles permission, staff/superuser access, or PSC Administrator role."

    def has_permission(self, request, view):
        return rbac_user_can_manage_roles(request.user)

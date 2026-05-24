"""Role / permission checks for API authorization (no Django auth Group)."""
from django.contrib.auth.models import User

from .models import Profile, Role, RoleDefinition


def rbac_user_can_manage_users(user: User) -> bool:
    if not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    try:
        prof = user.psc_profile
    except Profile.DoesNotExist:
        return False
    if prof.role == Role.PSC_ADMIN:
        return True
    rd = RoleDefinition.objects.filter(role=prof.role).prefetch_related("permissions").first()
    return bool(rd and rd.permissions.filter(code="manage_users").exists())


def rbac_user_can_manage_roles(user: User) -> bool:
    if not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    try:
        prof = user.psc_profile
    except Profile.DoesNotExist:
        return False
    if prof.role == Role.PSC_ADMIN:
        return True
    rd = RoleDefinition.objects.filter(role=prof.role).prefetch_related("permissions").first()
    return bool(rd and rd.permissions.filter(code="manage_roles").exists())


def rbac_can_access_admin_panel(user: User) -> bool:
    return rbac_user_can_manage_users(user) or rbac_user_can_manage_roles(user)


def rbac_can_mutate_ministry_department(user: User) -> bool:
    """Create/update/delete ministries or departments."""
    return rbac_user_can_manage_users(user) or rbac_user_can_manage_roles(user)


def rbac_user_has_permission(user: User, perm_code: str) -> bool:
    """True if staff/superuser, PSC Admin role, or the user's RoleDefinition includes ``perm_code``."""
    if not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    try:
        prof = user.psc_profile
    except Profile.DoesNotExist:
        return False
    if prof.role == Role.PSC_ADMIN:
        return True
    rd = RoleDefinition.objects.filter(role=prof.role).prefetch_related("permissions").first()
    return bool(rd and rd.permissions.filter(code=perm_code).exists())


def rbac_user_can_manage_translations(user: User) -> bool:
    return rbac_user_has_permission(user, "manage_ui_translations")


def rbac_user_can_view_audit_log(user: User) -> bool:
    """True if admin/staff/superuser or has the view_audit_trail permission."""
    if not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    try:
        prof = user.psc_profile
    except Profile.DoesNotExist:
        return False
    if prof.role == Role.PSC_ADMIN:
        return True
    rd = RoleDefinition.objects.filter(role=prof.role).prefetch_related("permissions").first()
    return bool(rd and rd.permissions.filter(code="view_audit_trail").exists())

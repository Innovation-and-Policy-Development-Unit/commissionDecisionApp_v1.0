"""OPSC unit roles and Commission Decision (minutes / tasks) access helpers."""

from __future__ import annotations

from django.contrib.auth.models import User

from .models import CommissionTask, Profile, Role
from .rbac import rbac_user_has_permission

# ── Unit roles (each OPSC unit has its own manager + principal) ───────────────

OPSC_UNIT_MANAGER_ROLES: frozenset[str] = frozenset({
    Role.VIPAM_MANAGER,
    Role.HR_UNIT_MANAGER,
    Role.ODU_MANAGER,
    Role.COMPLIANCE_MANAGER,
    Role.CSU_MANAGER,
})

OPSC_UNIT_PRINCIPAL_ROLES: frozenset[str] = frozenset({
    Role.VIPAM_PRINCIPAL,
    Role.HR_UNIT_PRINCIPAL,
    Role.ODU_PRINCIPAL,
    Role.COMPLIANCE_PRINCIPAL,
})

OPSC_POST_DECISION_ROLES: frozenset[str] = frozenset({
    Role.PSC_MANAGER,
    Role.PRINCIPAL_OFFICER,
    Role.SENIOR_OFFICER,
})

# Managers + principals + legacy post-decision execution roles
COMMISSION_DECISION_VIEW_ROLES: frozenset[str] = (
    OPSC_UNIT_MANAGER_ROLES | OPSC_UNIT_PRINCIPAL_ROLES | OPSC_POST_DECISION_ROLES
)

MANAGER_ROLE_TO_ROUTED_UNIT: dict[str, str] = {
    Role.ODU_MANAGER: "odu",
    Role.VIPAM_MANAGER: "vipam",
    Role.HR_UNIT_MANAGER: "hr",
    Role.COMPLIANCE_MANAGER: "compliance",
    Role.CSU_MANAGER: "csu",
}

MANAGER_ROLE_TO_PRINCIPAL_ROLE: dict[str, str] = {
    Role.ODU_MANAGER: Role.ODU_PRINCIPAL,
    Role.VIPAM_MANAGER: Role.VIPAM_PRINCIPAL,
    Role.HR_UNIT_MANAGER: Role.HR_UNIT_PRINCIPAL,
    Role.COMPLIANCE_MANAGER: Role.COMPLIANCE_PRINCIPAL,
}

# Roles that may be assigned as commission-task managers (secretariat allocates)
COMMISSION_TASK_MANAGER_ROLES: frozenset[str] = OPSC_UNIT_MANAGER_ROLES | frozenset({Role.PSC_MANAGER})

# Roles that may be assigned as commission-task implementers
COMMISSION_TASK_STAFF_ROLES: frozenset[str] = (
    OPSC_UNIT_PRINCIPAL_ROLES | frozenset({Role.PRINCIPAL_OFFICER, Role.SENIOR_OFFICER})
)


def profile_role(user: User) -> str | None:
    if not user.is_authenticated:
        return None
    try:
        return user.psc_profile.role
    except Profile.DoesNotExist:
        return None


def user_has_commission_decision_view(role: str | None) -> bool:
    return bool(role and role in COMMISSION_DECISION_VIEW_ROLES)


def user_can_view_commission_minutes(user: User) -> bool:
    if user.is_superuser or user.is_staff:
        return True
    role = profile_role(user)
    if role == Role.PSC_ADMIN:
        return True
    if rbac_user_has_permission(user, "view_commission_minutes"):
        return True
    if user_has_commission_decision_view(role):
        return True
    return rbac_user_has_permission(user, "manage_meetings")


def user_can_view_all_commission_tasks(user: User) -> bool:
    """See the full task register (read-only except on allocated rows)."""
    if user.is_superuser or user.is_staff:
        return True
    role = profile_role(user)
    if role == Role.PSC_ADMIN:
        return True
    if rbac_user_has_permission(user, "allocate_decision"):
        return True
    if rbac_user_has_permission(user, "view_commission_tasks"):
        return True
    return user_has_commission_decision_view(role)


def user_can_work_commission_task(user: User, task: CommissionTask) -> bool:
    """Update task fields, subtasks, or status on this row."""
    if user.is_superuser or user.is_staff:
        return True
    if rbac_user_has_permission(user, "allocate_decision"):
        return True
    if task.assigned_manager_id == user.id and rbac_user_has_permission(user, "assign_task"):
        return True
    if task.assigned_staff_id == user.id and rbac_user_has_permission(user, "update_implementation"):
        return True
    if task.assigned_staff_m2m.filter(id=user.id).exists() and rbac_user_has_permission(
        user, "update_implementation"
    ):
        return True
    return False

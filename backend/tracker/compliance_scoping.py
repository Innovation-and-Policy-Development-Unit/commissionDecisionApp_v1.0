"""
Central visibility scoping for the compliance module — the firewall.

Single source of truth for *who can see compliance data*. Used by the compliance
viewsets, serializers, and tests so the rule is enforced in one place.

Rules
-----
* Compliance staff (manager / senior / principal) and site admins: full access to
  cases, stages, litigation, notes, and the complaints register.
* Ministry staff (Head of Agency / HR / Dept Admin): may lodge a complaint and read
  ONLY their own complaint (status + closed reason). They never see a ComplianceCase,
  its stages, decision, litigation, or the linked submission reference.
* Everyone else: nothing.
"""

from __future__ import annotations

from .models import Role

# Roles that operate the compliance module.
COMPLIANCE_STAFF_ROLES = frozenset({
    Role.COMPLIANCE_MANAGER,
    Role.COMPLIANCE_SENIOR,
    Role.COMPLIANCE_PRINCIPAL,
    Role.PSC_ADMIN,
})

# Compliance Manager (+ admin) — the approval authority.
COMPLIANCE_MANAGER_ROLES = frozenset({Role.COMPLIANCE_MANAGER, Role.PSC_ADMIN})

# Ministry roles that may lodge a complaint.
MINISTRY_LODGE_ROLES = frozenset({
    Role.HEAD_OF_AGENCY,
    Role.MINISTRY_HR,
    Role.DEPT_ADMIN,
})


def _role(user) -> str | None:
    from .profile_utils import ensure_psc_profile

    try:
        return ensure_psc_profile(user).role
    except Exception:
        return None


def user_is_admin(user) -> bool:
    return bool(user and (user.is_superuser or user.is_staff))


def user_can_view_compliance(user) -> bool:
    """True if the user may see compliance case data."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return user_is_admin(user) or _role(user) in COMPLIANCE_STAFF_ROLES


def user_is_compliance_manager(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return user_is_admin(user) or _role(user) in COMPLIANCE_MANAGER_ROLES


def user_can_lodge_complaint(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return user_can_view_compliance(user) or _role(user) in MINISTRY_LODGE_ROLES


def compliance_case_queryset(user, base_qs):
    """Scope a ComplianceCase queryset: compliance staff see all, everyone else none."""
    if user_can_view_compliance(user):
        return base_qs
    return base_qs.none()


def complaint_queryset(user, base_qs):
    """Scope a Complaint queryset: compliance staff → all; ministry → own; else none."""
    if user_can_view_compliance(user):
        return base_qs
    if not user or not getattr(user, "is_authenticated", False):
        return base_qs.none()
    if _role(user) in MINISTRY_LODGE_ROLES:
        return base_qs.filter(lodged_by=user)
    return base_qs.none()

"""
Central visibility scoping for the compliance module — the firewall.

Single source of truth for *who can see compliance data*. Used by the compliance
viewsets, serializers, and tests so the rule is enforced in one place.

Rules (FR-05)
-----
* Compliance staff (manager / senior / principal): full read/write on all cases.
* Secretary OPSC: full read on all cases; write (mediator, decision) on senior-family cases.
* Commission member: read-all cases; write: record decisions only.
* Investigation panel member: read only cases where they are assigned as a stage responsible.
  For MVP this is treated as read-all (panel assignment tracking is future work).
* DG / Director: read cases where subject_ministry matches their ministry profile.
* Ministry staff (Head of Agency / HR / Dept Admin): lodge + view ONLY their own complaint.
* Everyone else: nothing.
"""

from __future__ import annotations

from .models import Role

# Full compliance unit staff — read/write everything.
COMPLIANCE_STAFF_ROLES = frozenset({
    Role.COMPLIANCE_MANAGER,
    Role.COMPLIANCE_SENIOR,
    Role.COMPLIANCE_PRINCIPAL,
    Role.PSC_ADMIN,
})

# Roles that get full read access (but limited write).
COMPLIANCE_READ_ROLES = frozenset({
    Role.SECRETARY_OPSC,
    Role.COMMISSION_MEMBER,
    Role.PANEL_MEMBER,
    Role.DG_DIRECTOR,
})

# All roles that may view compliance case data at all.
COMPLIANCE_VIEW_ROLES = COMPLIANCE_STAFF_ROLES | COMPLIANCE_READ_ROLES

# Compliance Manager (+ admin) — the general approval authority.
COMPLIANCE_MANAGER_ROLES = frozenset({Role.COMPLIANCE_MANAGER, Role.PSC_ADMIN})

# Roles that may record decisions (Commission/PSDB outcomes).
DECISION_RECORDING_ROLES = frozenset({
    Role.COMPLIANCE_MANAGER,
    Role.PSC_ADMIN,
    Role.COMMISSION_MEMBER,
    Role.SECRETARY_OPSC,
})

# Roles that may appoint mediators (grievance) or manage senior-executive matters.
SENIOR_CASE_AUTHORITY_ROLES = frozenset({
    Role.COMPLIANCE_MANAGER,
    Role.PSC_ADMIN,
    Role.SECRETARY_OPSC,
})

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


def _ministry(user) -> str | None:
    """Return the ministry name from the user's PSC profile, if any."""
    from .profile_utils import ensure_psc_profile

    try:
        profile = ensure_psc_profile(user)
        # PSC profiles store ministry via a FK; fall back to ministry name text.
        m = getattr(profile, "ministry", None)
        return m.name if m and hasattr(m, "name") else getattr(profile, "ministry_name", None)
    except Exception:
        return None


def user_is_admin(user) -> bool:
    return bool(user and (user.is_superuser or user.is_staff))


def user_can_view_compliance(user) -> bool:
    """True if the user may see compliance case data (any level)."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return user_is_admin(user) or _role(user) in COMPLIANCE_VIEW_ROLES


def user_is_compliance_manager(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return user_is_admin(user) or _role(user) in COMPLIANCE_MANAGER_ROLES


def user_can_record_decision(user) -> bool:
    """True if the user may POST to /decisions/ on a compliance case."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return user_is_admin(user) or _role(user) in DECISION_RECORDING_ROLES


def user_can_manage_senior_cases(user) -> bool:
    """True if the user may appoint mediators or manage senior-family actions."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return user_is_admin(user) or _role(user) in SENIOR_CASE_AUTHORITY_ROLES


def user_can_lodge_complaint(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return user_can_view_compliance(user) or _role(user) in MINISTRY_LODGE_ROLES


def user_is_dg_director(user) -> bool:
    return bool(user and getattr(user, "is_authenticated", False) and _role(user) == Role.DG_DIRECTOR)


def compliance_case_queryset(user, base_qs):
    """Scope a ComplianceCase queryset.

    - Compliance staff / secretary / commission / panel → all cases
    - DG/Director → cases where subject_ministry matches their ministry
    - Everyone else → none
    """
    if not user or not getattr(user, "is_authenticated", False):
        return base_qs.none()
    if user_is_admin(user):
        return base_qs
    role = _role(user)
    if role in COMPLIANCE_STAFF_ROLES:
        return base_qs
    if role in (Role.SECRETARY_OPSC, Role.COMMISSION_MEMBER, Role.PANEL_MEMBER):
        return base_qs
    if role == Role.DG_DIRECTOR:
        ministry = _ministry(user)
        if ministry:
            return base_qs.filter(subject_ministry__icontains=ministry)
        return base_qs.none()
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

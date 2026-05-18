"""Workflow transition rules for the Commission Decision Management System."""

from django.core.exceptions import PermissionDenied

from .models import Role, WorkflowStage, MeetingType

# ---------------------------------------------------------------------------
# Stage graph — maps every stage to its legal successor stages
# ---------------------------------------------------------------------------
_STAGE_GRAPH = {
    # ── Ministry pre-submission ────────────────────────────────────────────
    WorkflowStage.DRAFT: [
        WorkflowStage.SUBMITTED,
    ],
    WorkflowStage.SUBMITTED: [
        WorkflowStage.MANAGER_CHECKLIST_REVIEW,
    ],
    WorkflowStage.RETURNED_FOR_CLARIFICATION: [
        WorkflowStage.SUBMITTED,
        WorkflowStage.DRAFT,
    ],
    # ── Manager checklist review ──────────────────────────────────────────
    WorkflowStage.MANAGER_CHECKLIST_REVIEW: [
        WorkflowStage.UNDER_ASSESSMENT,
        WorkflowStage.RETURNED_FOR_CLARIFICATION,
    ],
    # ── Assessment ─────────────────────────────────────────────────────────
    WorkflowStage.UNDER_ASSESSMENT: [
        WorkflowStage.FORWARDED_TO_COMMISSION,
        WorkflowStage.RETURNED_FOR_CLARIFICATION,
        WorkflowStage.AWAITING_LEGAL_ADVICE,
    ],
    # ── Hold / deferral states ────────────────────────────────────────────
    WorkflowStage.DEFERRED: [
        WorkflowStage.MANAGER_CHECKLIST_REVIEW,
    ],
    WorkflowStage.DEFERRED_BACK_TO_HR: [
        WorkflowStage.SUBMITTED,
        WorkflowStage.DRAFT,
        WorkflowStage.MATTERS_ARISING,
    ],
    WorkflowStage.TABLED: [
        WorkflowStage.COMMISSION_SITTING,
        WorkflowStage.AWAITING_LEGAL_ADVICE,
        WorkflowStage.MATTERS_ARISING,
    ],
    WorkflowStage.AWAITING_LEGAL_ADVICE: [
        WorkflowStage.UNDER_ASSESSMENT,
        WorkflowStage.FORWARDED_TO_COMMISSION,
        WorkflowStage.COMMISSION_SITTING,
        WorkflowStage.DEFERRED,
    ],
    # ── Commission ────────────────────────────────────────────────────────
    WorkflowStage.FORWARDED_TO_COMMISSION: [
        WorkflowStage.COMMISSION_SITTING,
        WorkflowStage.TABLED,
        WorkflowStage.UNDER_ASSESSMENT,
        WorkflowStage.DEFERRED,
    ],
    WorkflowStage.COMMISSION_SITTING: [
        WorkflowStage.APPROVED,
        WorkflowStage.REJECTED,
        WorkflowStage.DEFERRED_BACK_TO_HR,
        WorkflowStage.TABLED,
        WorkflowStage.AWAITING_LEGAL_ADVICE,
        WorkflowStage.MINUTES_DRAFTED_SIGNED,
    ],
    # ── Matters Arising (previously deliberated matters returning for further consideration) ──
    WorkflowStage.MATTERS_ARISING: [
        WorkflowStage.COMMISSION_SITTING,
        WorkflowStage.FORWARDED_TO_COMMISSION,
    ],
    WorkflowStage.APPROVED: [
        WorkflowStage.MINUTES_DRAFTED_SIGNED,
        WorkflowStage.DECISION_ENTERED_ASSIGNED,
        WorkflowStage.UNDER_IMPLEMENTATION,
    ],
    WorkflowStage.REJECTED: [
        WorkflowStage.MINUTES_DRAFTED_SIGNED,
        WorkflowStage.DECISION_ENTERED_ASSIGNED,
    ],
    # ── Post-decision ─────────────────────────────────────────────────────
    WorkflowStage.MINUTES_DRAFTED_SIGNED: [
        WorkflowStage.DECISION_ENTERED_ASSIGNED,
        WorkflowStage.UNDER_IMPLEMENTATION,
    ],
    WorkflowStage.DECISION_ENTERED_ASSIGNED: [
        WorkflowStage.UNDER_IMPLEMENTATION,
        WorkflowStage.IMPLEMENTATION_REPORT,
    ],
    WorkflowStage.UNDER_IMPLEMENTATION: [
        WorkflowStage.IMPLEMENTATION_REPORT,
        WorkflowStage.DECISION_ENTERED_ASSIGNED,
    ],
    WorkflowStage.IMPLEMENTATION_REPORT: [
        WorkflowStage.UNDER_IMPLEMENTATION,
    ],
}

# ---------------------------------------------------------------------------
# Role-based target restrictions
# ---------------------------------------------------------------------------

# Ministry users may only submit drafts or respond to clarifications / deferrals
_MINISTRY_ALLOWED = {
    (WorkflowStage.DRAFT,                WorkflowStage.SUBMITTED),
    (WorkflowStage.RETURNED_FOR_CLARIFICATION, WorkflowStage.SUBMITTED),
    (WorkflowStage.RETURNED_FOR_CLARIFICATION, WorkflowStage.DRAFT),
    (WorkflowStage.DEFERRED_BACK_TO_HR,  WorkflowStage.SUBMITTED),
    (WorkflowStage.DEFERRED_BACK_TO_HR,  WorkflowStage.DRAFT),
    (WorkflowStage.DEFERRED_BACK_TO_HR,  WorkflowStage.MATTERS_ARISING),
}

# OPSC Unit Managers handle the checklist review stage only
_UNIT_MANAGER_ROLES = {
    Role.VIPAM_MANAGER,
    Role.HR_UNIT_MANAGER,
    Role.ODU_MANAGER,
    Role.COMPLIANCE_MANAGER,
}

_UNIT_MANAGER_STAGES = {
    WorkflowStage.MANAGER_CHECKLIST_REVIEW,
}

# OPSC Unit Principals work on submissions assigned to them by their manager.
# They can do checklist review AND assessment; assignment enforcement happens in views.py.
_UNIT_PRINCIPAL_ROLES = {
    Role.ODU_PRINCIPAL,
    Role.HR_UNIT_PRINCIPAL,
    Role.VIPAM_PRINCIPAL,
    Role.COMPLIANCE_PRINCIPAL,
}

_UNIT_PRINCIPAL_STAGES = {
    WorkflowStage.MANAGER_CHECKLIST_REVIEW,
    WorkflowStage.UNDER_ASSESSMENT,
}

_COMMISSIONER_TARGETS = {
    WorkflowStage.APPROVED,
    WorkflowStage.REJECTED,
    WorkflowStage.DEFERRED_BACK_TO_HR,
    WorkflowStage.TABLED,
    WorkflowStage.AWAITING_LEGAL_ADVICE,
    WorkflowStage.MINUTES_DRAFTED_SIGNED,
}

_COMMISSIONER_SOURCES = {
    WorkflowStage.COMMISSION_SITTING,
    WorkflowStage.FORWARDED_TO_COMMISSION,
    WorkflowStage.AWAITING_LEGAL_ADVICE,
    WorkflowStage.TABLED,
    WorkflowStage.MATTERS_ARISING,
}

_OFFICER_FORBIDDEN = {
    WorkflowStage.APPROVED,
    WorkflowStage.REJECTED,
    WorkflowStage.FORWARDED_TO_COMMISSION,
    WorkflowStage.COMMISSION_SITTING,
    WorkflowStage.MINUTES_DRAFTED_SIGNED,
    WorkflowStage.DECISION_ENTERED_ASSIGNED,
    WorkflowStage.IMPLEMENTATION_REPORT,
    WorkflowStage.TABLED,
    WorkflowStage.DEFERRED_BACK_TO_HR,
}

_MANAGER_STAGES = {
    WorkflowStage.DECISION_ENTERED_ASSIGNED,
    WorkflowStage.UNDER_IMPLEMENTATION,
    WorkflowStage.IMPLEMENTATION_REPORT,
}

_STAFF_STAGES = {
    WorkflowStage.UNDER_IMPLEMENTATION,
    WorkflowStage.IMPLEMENTATION_REPORT,
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def assert_transition_allowed(*, role: str, current_stage: str, target_stage: str) -> None:
    """Raise PermissionDenied if the role cannot move current_stage → target_stage."""

    # ── Ministry roles ───────────────────────────────────────────────────────
    if role in {Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY}:
        if (current_stage, target_stage) not in _MINISTRY_ALLOWED:
            raise PermissionDenied(
                "Ministry users can only submit a draft, respond to clarification requests, "
                "or respond to a commission deferral."
            )
        return

    # ── OPSC Unit Managers — checklist review only ──────────────────────────
    if role in _UNIT_MANAGER_ROLES:
        if current_stage not in _UNIT_MANAGER_STAGES:
            raise PermissionDenied("Unit managers can only act at the Manager Checklist Review stage.")
        return

    # ── OPSC Unit Principals — checklist review and assessment ──────────────
    # Assignment enforcement (assigned_to == request.user) is done in views.py.
    if role in _UNIT_PRINCIPAL_ROLES:
        if current_stage not in _UNIT_PRINCIPAL_STAGES:
            raise PermissionDenied(
                "Unit principals can only act at the Checklist Review and Under Assessment stages."
            )
        return

    # ── Validate graph edge ──────────────────────────────────────────────────
    if target_stage not in _STAGE_GRAPH.get(current_stage, []) and role != Role.PSC_ADMIN:
        raise PermissionDenied("That workflow transition is not allowed from the current stage.")

    # ── Admin overrides all role checks ─────────────────────────────────────
    if role == Role.PSC_ADMIN:
        return

    # ── Commissioner ────────────────────────────────────────────────────────
    if role == Role.PSC_COMMISSIONER:
        if target_stage not in _COMMISSIONER_TARGETS:
            raise PermissionDenied(
                "Commissioners record decisions: approve, reject, defer back to HR, "
                "table, or refer for advice."
            )
        if current_stage not in _COMMISSIONER_SOURCES:
            raise PermissionDenied(
                "Commission decisions apply only while an item is with the Commission or in a hold state."
            )
        return

    # ── Secretary ───────────────────────────────────────────────────────────
    if role == Role.PSC_SECRETARY:
        if target_stage in {WorkflowStage.APPROVED, WorkflowStage.REJECTED}:
            raise PermissionDenied("Recording approval or rejection is for Commissioners.")
        return

    # ── Senior Administration Officer (SOP Section 6) ──────────────────────
    if role == Role.SENIOR_ADMIN_OFFICER:
        if target_stage in {WorkflowStage.APPROVED, WorkflowStage.REJECTED}:
            raise PermissionDenied("Recording approval or rejection is for Commissioners.")
        return

    # ── Chairperson (SOP Section 6 — Chairman) ─────────────────────────────
    if role == Role.CHAIRPERSON:
        if target_stage not in _COMMISSIONER_TARGETS:
            raise PermissionDenied(
                "Chairperson records decisions: approve, reject, defer back to HR, "
                "table, or refer for advice."
            )
        if current_stage not in _COMMISSIONER_SOURCES:
            raise PermissionDenied(
                "Chairperson decisions apply only while an item is with the Commission."
            )
        return

    # ── PSC Officer ─────────────────────────────────────────────────────────
    if role == Role.PSC_OFFICER:
        if target_stage in _OFFICER_FORBIDDEN:
            raise PermissionDenied(
                "PSC Officers handle assessment; Commission stages are restricted."
            )
        return

    # ── OPSC Manager ────────────────────────────────────────────────────────
    if role == Role.PSC_MANAGER:
        if target_stage not in _MANAGER_STAGES:
            raise PermissionDenied(
                "OPSC Managers operate post-decision stages: "
                "Decision Entered & Assigned → Under Implementation → Implementation Report."
            )
        return

    # ── Principal / Senior Officer ──────────────────────────────────────────
    if role in {Role.PRINCIPAL_OFFICER, Role.SENIOR_OFFICER}:
        if target_stage not in _STAFF_STAGES:
            raise PermissionDenied(
                "Officers update implementation stages: Under Implementation and Implementation Report."
            )
        return


def iter_allowed_targets(role: str, current_stage: str) -> list:
    """Return all stage values the role may transition to from current_stage."""
    if role == Role.PSC_ADMIN:
        return [m.value for m in WorkflowStage]
    if role in {Role.MINISTRY_HR, Role.DEPT_ADMIN, Role.HEAD_OF_AGENCY}:
        return [t.value for (s, t) in _MINISTRY_ALLOWED if s == current_stage]
    if role in _UNIT_MANAGER_ROLES:
        if current_stage in _UNIT_MANAGER_STAGES:
            return _STAGE_GRAPH.get(current_stage, [])
        return []
    if role in _UNIT_PRINCIPAL_ROLES:
        if current_stage in _UNIT_PRINCIPAL_STAGES:
            return _STAGE_GRAPH.get(current_stage, [])
        return []
    if role in {Role.SENIOR_ADMIN_OFFICER, Role.PSC_SECRETARY}:
        targets = []
        for target in _STAGE_GRAPH.get(current_stage, []):
            try:
                assert_transition_allowed(role=role, current_stage=current_stage, target_stage=target)
                targets.append(target)
            except PermissionDenied:
                continue
        return targets
    if role == Role.CHAIRPERSON:
        if current_stage not in _COMMISSIONER_SOURCES:
            return []
        return [t.value for t in _STAGE_GRAPH.get(current_stage, []) if t in _COMMISSIONER_TARGETS]
    targets = []
    for target in _STAGE_GRAPH.get(current_stage, []):
        try:
            assert_transition_allowed(role=role, current_stage=current_stage, target_stage=target)
            targets.append(target)
        except PermissionDenied:
            continue
    return targets

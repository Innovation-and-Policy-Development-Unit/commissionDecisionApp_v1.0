"""Workflow transition rules for the Commission Decision Management System."""

from django.core.exceptions import PermissionDenied

from .models import Role, WorkflowStage, MeetingType
from .opsc_access import OPSC_UNIT_MANAGER_ROLES

# ---------------------------------------------------------------------------
# Internal submission roles — only unit managers (not principals) create submissions
# ---------------------------------------------------------------------------
INTERNAL_SUBMITTER_ROLES = {
    Role.CSU_MANAGER,
    Role.ODU_MANAGER,
}

TRAVELLER_SUBMITTER_ROLES = {
    Role.TRAVELLER,
}

# Secretary-only travel (4.4–4.6): lodged by ministry HR, not public servants.
SECRETARY_TRAVEL_SUBMITTER_ROLES = {
    Role.MINISTRY_HR,
    Role.PSC_OFFICER,
    Role.PSC_ADMIN,
    Role.PSC_SECRETARY,
}

_COMPLIANCE_SUBMITTER_ROLES = {
    Role.COMPLIANCE_SENIOR,
    Role.COMPLIANCE_PRINCIPAL,
    Role.COMPLIANCE_MANAGER,
}

_COMPLIANCE_CREATOR_ALLOWED = {
    (WorkflowStage.DRAFT, WorkflowStage.SUBMITTED),
    (WorkflowStage.RETURNED_FOR_CLARIFICATION, WorkflowStage.SUBMITTED),
    (WorkflowStage.RETURNED_FOR_CLARIFICATION, WorkflowStage.DRAFT),
}

# ---------------------------------------------------------------------------
# Internal stage graph — short 4-stage workflow for OPSC internal submissions
# DRAFT → SUBMITTED → SECRETARY_REVIEW → APPROVED / REJECTED
# ---------------------------------------------------------------------------
_INTERNAL_STAGE_GRAPH = {
    WorkflowStage.DRAFT: [
        WorkflowStage.SUBMITTED,
    ],
    WorkflowStage.SUBMITTED: [
        WorkflowStage.SECRETARY_REVIEW,
    ],
    WorkflowStage.SECRETARY_REVIEW: [
        WorkflowStage.APPROVED,
        WorkflowStage.REJECTED,
    ],
    # Allow Secretary to push back for correction
    WorkflowStage.REJECTED: [
        WorkflowStage.DRAFT,
    ],
}

# Ministry travel forms (4.4–4.6): traveller + endorsements → Secretary only
_SECRETARY_ONLY_STAGE_GRAPH = {
    WorkflowStage.DRAFT: [
        WorkflowStage.SUBMITTED,
    ],
    WorkflowStage.SUBMITTED: [
        WorkflowStage.MANAGER_CHECKLIST_REVIEW,
    ],
    WorkflowStage.MANAGER_CHECKLIST_REVIEW: [
        WorkflowStage.SECRETARY_REVIEW,
        WorkflowStage.RETURNED_FOR_CLARIFICATION,
    ],
    WorkflowStage.SECRETARY_REVIEW: [
        WorkflowStage.APPROVED,
        WorkflowStage.REJECTED,
        WorkflowStage.RETURNED_FOR_CLARIFICATION,
    ],
    WorkflowStage.RETURNED_FOR_CLARIFICATION: [
        WorkflowStage.DRAFT,
        WorkflowStage.SUBMITTED,
    ],
    WorkflowStage.REJECTED: [
        WorkflowStage.DRAFT,
    ],
}

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
        WorkflowStage.COMPLIANCE_UNDER_REVIEW,
    ],
    # ── CMS compliance routing ─────────────────────────────────────────────
    # Outbound: Compliance Manager dispatches to CMS (auto-fires API call).
    # Inbound (SECRETARY_REVIEW): set programmatically by the CMS callback webhook,
    # not by a user transition, so it does not need a graph entry here.
    WorkflowStage.COMPLIANCE_UNDER_REVIEW: [
        WorkflowStage.SECRETARY_REVIEW,
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
    (WorkflowStage.DEFERRED_BACK_TO_HR,  WorkflowStage.MATTERS_ARISING),
    (WorkflowStage.DEFERRED_BACK_TO_HR,  WorkflowStage.DRAFT),
}

# OPSC Unit Managers handle the checklist review stage only
_UNIT_MANAGER_ROLES = OPSC_UNIT_MANAGER_ROLES

_UNIT_MANAGER_STAGES = {
    WorkflowStage.MANAGER_CHECKLIST_REVIEW,
}

# OPSC Unit Principals work on submissions assigned to them by their manager.
# They can do checklist review AND assessment; assignment enforcement happens in views.py.
_UNIT_PRINCIPAL_ROLES = {
    Role.ODU_PRINCIPAL,
    Role.PRINCIPAL_ORG_DEV_ANALYST,
    Role.PRINCIPAL_JOB_ANALYST,
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
    WorkflowStage.COMPLIANCE_UNDER_REVIEW,
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

def assert_transition_allowed(
    *,
    role: str,
    current_stage: str,
    target_stage: str,
    is_internal: bool = False,
    secretary_only: bool = False,
) -> None:
    """Raise PermissionDenied if the role cannot move current_stage → target_stage.

    Pass is_internal=True for OPSC-internal submissions (CSU/ODU → Secretary workflow).
    Pass secretary_only=True for ministry travel forms (4.4–4.6).
    """

    # ── Travel / secretary-only workflow (ministry origin) ─────────────────
    if secretary_only:
        graph = _SECRETARY_ONLY_STAGE_GRAPH
        allowed_targets = graph.get(current_stage, [])
        if target_stage not in allowed_targets and role != Role.PSC_ADMIN:
            raise PermissionDenied("That transition is not allowed in the travel submission workflow.")

        if role in SECRETARY_TRAVEL_SUBMITTER_ROLES:
            allowed_pairs = {
                (WorkflowStage.DRAFT, WorkflowStage.SUBMITTED),
                (WorkflowStage.RETURNED_FOR_CLARIFICATION, WorkflowStage.SUBMITTED),
                (WorkflowStage.RETURNED_FOR_CLARIFICATION, WorkflowStage.DRAFT),
            }
            if (current_stage, target_stage) not in allowed_pairs:
                raise PermissionDenied(
                    "Ministry HR can submit travel requests or respond to clarification requests."
                )
            return

        if role in {Role.ODU_MANAGER}:
            allowed_pairs = {
                (WorkflowStage.SUBMITTED, WorkflowStage.MANAGER_CHECKLIST_REVIEW),
                (WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.SECRETARY_REVIEW),
                (WorkflowStage.MANAGER_CHECKLIST_REVIEW, WorkflowStage.RETURNED_FOR_CLARIFICATION),
            }
            if (current_stage, target_stage) in allowed_pairs:
                return
            raise PermissionDenied("ODU Manager can review and forward travel submissions to the Secretary.")

        if role in {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER}:
            if current_stage == WorkflowStage.SECRETARY_REVIEW and target_stage in {
                WorkflowStage.APPROVED,
                WorkflowStage.REJECTED,
                WorkflowStage.RETURNED_FOR_CLARIFICATION,
            }:
                return
            raise PermissionDenied(
                "Secretary can decide travel submissions from the Secretary Review stage."
            )

        if role == Role.PSC_OFFICER:
            raise PermissionDenied("Travel submissions are routed to ODU Manager before Secretary review.")

        if role == Role.PSC_ADMIN:
            return

        raise PermissionDenied(
            "Only ministry HR, PSC Officers, or the Secretary may act on travel submissions."
        )

    # ── Internal submission workflow ─────────────────────────────────────────
    if is_internal:
        graph = _INTERNAL_STAGE_GRAPH
        allowed_targets = graph.get(current_stage, [])
        if target_stage not in allowed_targets and role != Role.PSC_ADMIN:
            raise PermissionDenied("That transition is not allowed in the internal submission workflow.")

        # Compliance unit creators (internal OPSC submissions)
        if role in _COMPLIANCE_SUBMITTER_ROLES:
            if (current_stage, target_stage) in _COMPLIANCE_CREATOR_ALLOWED:
                return
            raise PermissionDenied(
                "Compliance staff can submit a draft or respond to a clarification request."
            )

        # Internal submitters (CSU/ODU managers) can only submit their own draft
        if role in INTERNAL_SUBMITTER_ROLES:
            if (current_stage, target_stage) != (WorkflowStage.DRAFT, WorkflowStage.SUBMITTED):
                raise PermissionDenied("CSU/ODU users can only submit their draft.")
            return

        # Secretary and Admin handle review/decision
        if role in {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER}:
            if current_stage == WorkflowStage.SUBMITTED and target_stage == WorkflowStage.SECRETARY_REVIEW:
                return
            if current_stage == WorkflowStage.SECRETARY_REVIEW and target_stage in {
                WorkflowStage.APPROVED, WorkflowStage.REJECTED
            }:
                return
            raise PermissionDenied("Secretary can move internal submissions: Submitted→Secretary Review, or Secretary Review→Approved/Rejected.")

        if role == Role.PSC_ADMIN:
            return

        raise PermissionDenied("Only the submitter or Secretary may act on internal submissions.")

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


def iter_allowed_targets(
    role: str, current_stage: str, is_internal: bool = False, secretary_only: bool = False
) -> list:
    """Return all stage values the role may transition to from current_stage."""
    if secretary_only:
        if role == Role.PSC_ADMIN:
            return list(_SECRETARY_ONLY_STAGE_GRAPH.get(current_stage, []))
        if role in SECRETARY_TRAVEL_SUBMITTER_ROLES:
            if current_stage == WorkflowStage.DRAFT:
                return [WorkflowStage.SUBMITTED]
            if current_stage == WorkflowStage.RETURNED_FOR_CLARIFICATION:
                return [WorkflowStage.SUBMITTED, WorkflowStage.DRAFT]
            return []
        if role == Role.ODU_MANAGER:
            return list(_SECRETARY_ONLY_STAGE_GRAPH.get(current_stage, []))
        if role in {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER}:
            if current_stage == WorkflowStage.SECRETARY_REVIEW:
                return list(_SECRETARY_ONLY_STAGE_GRAPH.get(current_stage, []))
            return []
        return []

    if is_internal:
        if role == Role.PSC_ADMIN:
            return list(_INTERNAL_STAGE_GRAPH.get(current_stage, []))
        if role in _COMPLIANCE_SUBMITTER_ROLES:
            return [
                t.value for (s, t) in _COMPLIANCE_CREATOR_ALLOWED if s == current_stage
            ]
        if role in INTERNAL_SUBMITTER_ROLES:
            if current_stage == WorkflowStage.DRAFT:
                return [WorkflowStage.SUBMITTED]
            return []
        if role in {Role.PSC_SECRETARY, Role.SENIOR_ADMIN_OFFICER}:
            return list(_INTERNAL_STAGE_GRAPH.get(current_stage, []))
        return []

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

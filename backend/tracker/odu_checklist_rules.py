"""When the ODU Restructure Submission Checklist applies."""

from __future__ import annotations

from .models import RoutedUnit, Submission, WorkflowStage

# Organisation restructure / establishment variation (includes regrading via PSC 2-1)
ODU_RESTRUCTURE_CHECKLIST_FORM_CODES = frozenset({"ORG-3.1", "PSC 2-1"})

# ODU manager checklist review (workflow diagram: Manager ODU checklist review)
ODU_CHECKLIST_REVIEW_STAGES = frozenset({WorkflowStage.MANAGER_CHECKLIST_REVIEW})

# Stages AFTER checklist review where the completed checklist stays visible
# (read-only) so the verification record remains accessible downstream.
ODU_CHECKLIST_VIEW_STAGES = frozenset({
    WorkflowStage.UNDER_ASSESSMENT,
    WorkflowStage.SECRETARY_REVIEW,
    WorkflowStage.RETURNED_FOR_CLARIFICATION,
    WorkflowStage.DEFERRED,
    WorkflowStage.TABLED,
    WorkflowStage.AWAITING_LEGAL_ADVICE,
    WorkflowStage.AWAITING_CABINET_DECISION,
    WorkflowStage.RESUBMITTED,
    WorkflowStage.FORWARDED_TO_COMMISSION,
    WorkflowStage.COMMISSION_SITTING,
    WorkflowStage.MATTERS_ARISING,
    WorkflowStage.APPROVED,
    WorkflowStage.REJECTED,
    WorkflowStage.RETURNED,
    WorkflowStage.DEFERRED_BACK_TO_HR,
    WorkflowStage.MINUTES_DRAFTED_SIGNED,
    WorkflowStage.DECISION_ENTERED_ASSIGNED,
    WorkflowStage.UNDER_IMPLEMENTATION,
    WorkflowStage.IMPLEMENTATION_REPORT,
})

ODU_CHECKLIST_ROLES = frozenset({
    "odu_principal",
    "principal_org_dev_analyst",
    "principal_job_analyst",
    "odu_manager",
})

# Roles allowed to VIEW (read-only) the completed checklist after the ODU
# review stage. ODU roles plus the PSC reviewers who handle later stages.
ODU_CHECKLIST_VIEW_ROLES = ODU_CHECKLIST_ROLES | frozenset({
    "psc_officer",
    "psc_secretary",
    "senior_admin_officer",
    "psc_manager",
    "psc_admin",
    # Commissioners need to see the checklist/assessment work that led to
    # the recommendation they are voting on during Commission Sitting.
    "psc_commissioner",
    "chairperson",
})

ODU_PRINCIPAL_WORKER_ROLES = frozenset({
    "odu_principal",
    "principal_org_dev_analyst",
    "principal_job_analyst",
})


def user_is_odu_principal_worker(role: str | None) -> bool:
    return bool(role and role in ODU_PRINCIPAL_WORKER_ROLES)


def submission_uses_odu_restructure_checklist(submission: Submission) -> bool:
    return (submission.form_type_code or "") in ODU_RESTRUCTURE_CHECKLIST_FORM_CODES


def submission_in_odu_review_phase(submission: Submission) -> bool:
    """Submission is with ODU for manager checklist review."""
    return (
        submission.routed_unit == RoutedUnit.ODU
        and submission.current_stage in ODU_CHECKLIST_REVIEW_STAGES
    )


def submission_eligible_for_odu_checklist(submission: Submission) -> bool:
    return (
        submission_uses_odu_restructure_checklist(submission)
        and submission_in_odu_review_phase(submission)
    )


def submission_in_odu_view_phase(submission: Submission) -> bool:
    """Submission has passed checklist review but the record stays viewable."""
    return (
        submission.routed_unit == RoutedUnit.ODU
        and submission.current_stage in ODU_CHECKLIST_VIEW_STAGES
    )


def submission_viewable_odu_checklist(submission: Submission) -> bool:
    """Checklist can be shown (editable in review phase, read-only afterwards)."""
    return submission_uses_odu_restructure_checklist(submission) and (
        submission_in_odu_review_phase(submission)
        or submission_in_odu_view_phase(submission)
    )


# ── ODU Board Paper (the Commission-facing submission ODU prepares) ───────────

# Editable while ODU is actively working the case: their own checklist review,
# then their assessment phase where they draft the board paper itself.
BOARD_PAPER_EDIT_STAGES = frozenset({
    WorkflowStage.MANAGER_CHECKLIST_REVIEW,
    WorkflowStage.UNDER_ASSESSMENT,
})


def submission_in_board_paper_edit_phase(submission: Submission) -> bool:
    return (
        submission.routed_unit == RoutedUnit.ODU
        and submission.current_stage in BOARD_PAPER_EDIT_STAGES
    )


def submission_eligible_for_board_paper(submission: Submission) -> bool:
    return (
        submission_uses_odu_restructure_checklist(submission)
        and submission_in_board_paper_edit_phase(submission)
    )


def submission_in_board_paper_view_phase(submission: Submission) -> bool:
    """Board paper has left ODU's hands but the record stays viewable."""
    return (
        submission.routed_unit == RoutedUnit.ODU
        and submission.current_stage in ODU_CHECKLIST_VIEW_STAGES
        and submission.current_stage not in BOARD_PAPER_EDIT_STAGES
    )


def submission_viewable_board_paper(submission: Submission) -> bool:
    """Board paper can be shown (editable while ODU is working it, read-only after)."""
    return submission_uses_odu_restructure_checklist(submission) and (
        submission_in_board_paper_edit_phase(submission)
        or submission_in_board_paper_view_phase(submission)
    )

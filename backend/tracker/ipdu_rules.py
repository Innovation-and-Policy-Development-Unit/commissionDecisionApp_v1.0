"""When the IPDU Board Paper (Task Force / Allowance Payment submission) applies.

Mirrors odu_checklist_rules.py's board-paper half only — IPDU has no
separate "checklist" stage (see IPDUBoardPaper's docstring in models.py):
Manager IPDU authors the whole paper themselves, straight to the Secretary.
"""

from __future__ import annotations

from .models import RoutedUnit, Submission, WorkflowStage

# Task Force governance and Allowance Payment submissions — both share one
# IPDUBoardPaper model (see models.py), differing only in RequiredDocument
# checklist and display label.
IPDU_BOARD_PAPER_FORM_CODES = frozenset({"IPDU-TASKFORCE", "IPDU-ALLOWANCE"})

# No principal/senior tier — Manager IPDU is the only role that authors and
# reviews the board paper themselves.
IPDU_BOARD_PAPER_ROLES = frozenset({"ipdu_manager"})

# Roles allowed to VIEW (read-only) the board paper after it leaves Manager
# IPDU's hands — same broader PSC-reviewer set ODU exposes.
IPDU_BOARD_PAPER_VIEW_ROLES = IPDU_BOARD_PAPER_ROLES | frozenset({
    "psc_officer",
    "psc_secretary",
    "senior_admin_officer",
    "psc_manager",
    "psc_admin",
    "psc_commissioner",
    "chairperson",
})

# Editable while Manager IPDU is actively working the case: checklist review,
# then the assessment phase where the board paper itself gets drafted — same
# two stages as ODU's board paper (BOARD_PAPER_EDIT_STAGES).
BOARD_PAPER_EDIT_STAGES = frozenset({
    WorkflowStage.MANAGER_CHECKLIST_REVIEW,
    WorkflowStage.UNDER_ASSESSMENT,
})


def submission_uses_ipdu_board_paper(submission: Submission) -> bool:
    return (submission.form_type_code or "") in IPDU_BOARD_PAPER_FORM_CODES


def submission_in_board_paper_edit_phase(submission: Submission) -> bool:
    # Unlike ODU (ministry drafts PSC 2-1/ORG-3.1 first; ODU only authors the
    # board paper once it reaches them at Manager Checklist Review), Manager
    # IPDU is the sole author from the very start — there's no separate
    # ministry-drafting phase to wait out. Gate Draft on form type alone:
    # routed_unit is still blank at that point (only auto-derived once
    # submitted), so the routed_unit check below would otherwise always fail
    # and leave the board paper invisible for the entire time it's actually
    # being written.
    if submission.current_stage == WorkflowStage.DRAFT:
        return submission_uses_ipdu_board_paper(submission)
    return (
        submission.routed_unit == RoutedUnit.IPDU
        and submission.current_stage in BOARD_PAPER_EDIT_STAGES
    )


def submission_eligible_for_board_paper(submission: Submission) -> bool:
    return (
        submission_uses_ipdu_board_paper(submission)
        and submission_in_board_paper_edit_phase(submission)
    )


def submission_in_board_paper_view_phase(submission: Submission) -> bool:
    """Board paper has left Manager IPDU's hands but the record stays viewable."""
    return (
        submission.routed_unit == RoutedUnit.IPDU
        and submission.current_stage not in BOARD_PAPER_EDIT_STAGES
    )


def submission_viewable_board_paper(submission: Submission) -> bool:
    """Board paper can be shown (editable while Manager IPDU is working it,
    read-only after)."""
    return submission_uses_ipdu_board_paper(submission) and (
        submission_in_board_paper_edit_phase(submission)
        or submission_in_board_paper_view_phase(submission)
    )


def user_can_view_ipdu_board_paper(submission: Submission, role: str | None, *, is_admin: bool = False) -> bool:
    if not submission_uses_ipdu_board_paper(submission):
        return False
    if is_admin:
        return True
    if submission_in_board_paper_edit_phase(submission):
        return role in IPDU_BOARD_PAPER_ROLES
    if submission_in_board_paper_view_phase(submission):
        return role in IPDU_BOARD_PAPER_VIEW_ROLES
    return False

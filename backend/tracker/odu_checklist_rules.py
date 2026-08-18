"""When the ODU Restructure Submission Checklist applies."""

from __future__ import annotations

from .models import RoutedUnit, Submission, WorkflowStage

# Organisation restructure / establishment variation (includes regrading via PSC 2-1)
ODU_RESTRUCTURE_CHECKLIST_FORM_CODES = frozenset({"ORG-3.1", "PSC 2-1"})

# Form types where the assigned ODU Principal sends "Return for Clarification"
# straight to Ministry HR from Manager Checklist Review, without routing
# through the Manager ODU first — every ODU submission type: restructure/
# variance (PSC 2-1/ORG-3.1), Job Description (PSC 2-2), Business Plan,
# Corporate Plan, and Annual Report. The Manager's own action at that stage
# is then just "Approve & Submit to Secretary". Confirmed workflow; extended
# to PSC 2-2 2026-08-10, then to Business Plan/Corporate Plan/Annual Report
# the same day once those three were built, for consistency across every ODU
# submission type. Kept separate from ODU_RESTRUCTURE_CHECKLIST_FORM_CODES
# above since only PSC 2-1/ORG-3.1 have the 20-item checklist / board paper.
ODU_PRINCIPAL_DIRECT_CLARIFICATION_FORM_CODES = ODU_RESTRUCTURE_CHECKLIST_FORM_CODES | frozenset({
    "PSC 2-2", "BUSINESS-PLAN", "CORPORATE-PLAN", "ANNUAL-REPORT",
})

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
    "odu_senior",
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
    "odu_senior",
})

# Roles that draft/own the ministry's submission (same set the digitized
# ORG-3.1/PSC 2-1 form itself is editable by — see canEditForm37 in
# SubmissionDetail.jsx). These are who now fills in the 20-item checklist,
# confirmed by ODU (2026-08-06): the ministry completes it as part of their
# own submission; ODU reviews what they submitted rather than authoring it.
CHECKLIST_MINISTRY_ROLES = frozenset({
    "ministry_hr",
    "dept_admin",
    "psc_admin",
    "psc_officer",
    "psc_secretary",
    "csu_manager",
})

# The 16 items that are the ministry's to answer (system-verified where a
# submitted fact exists, self-certified otherwise). Items 17-20 describe
# ODU's own subsequent work and are never required from the ministry — see
# odu_checklist_prefill.py for which of these 16 get auto-verified.
CHECKLIST_MINISTRY_REQUIRED_FIELDS = frozenset({
    "b1_cover_letter", "b2_org_chart", "b3_positions_list", "b4_jds_attached",
    "b5_rationale_stated", "b6_mandate_alignment", "b7_reporting_lines",
    "b8_no_duplication", "b9_span_of_control", "b10_job_purpose_linked",
    "b11_kra_kta_kpi", "b12_competencies", "b13_qual_experience",
    "b14_cost_analysis", "b15_grt_mapping", "b16_consultation",
})

# Fields the ministry may write while the checklist is Draft. Everything
# else in Section A (ministry_department, division_unit, odu_officer_assigned,
# manager_odu) is either auto-derived from the Submission for display
# (ministry_department/division_unit — see ODURestructureChecklistForm.jsx)
# or ODU-internal routing info the ministry should never see, let alone
# write (odu_officer_assigned, manager_odu).
CHECKLIST_MINISTRY_ALLOWED_FIELDS = frozenset({"submission_type"}) | CHECKLIST_MINISTRY_REQUIRED_FIELDS

# Fields ODU may write once the ministry has submitted the checklist:
# Section C (recommendation/comments), Section D (sign-off), and items
# 17-20 (Groups 6-7) which describe ODU's own process, not the ministry's.
# Section A (submission info) and items 1-16 are the ministry's answers and
# stay locked to ODU.
CHECKLIST_ODU_REVIEW_FIELDS = frozenset({
    "recommendation", "officer_comments",
    "verifying_officer_name", "verifying_officer_date",
    "manager_verifier_name", "manager_verifier_date",
    "b17_odu_analysis", "b18_feedback_provided",
    "b19_final_docs_ready", "b20_manager_final_check",
})

# Subset of CHECKLIST_ODU_REVIEW_FIELDS that certifies the Manager ODU's own
# final sign-off specifically — an odu_principal does the rest of Section
# C/D and Groups 6-7, but must not be able to write these, matching the
# frontend's disabled={!isOduManager} gate on the same three fields
# (ODURestructureChecklistForm.jsx). Without this, a principal could bypass
# that UI-only gate via a direct API call.
CHECKLIST_ODU_MANAGER_ONLY_FIELDS = frozenset({
    "manager_verifier_name", "manager_verifier_date", "b20_manager_final_check",
})

# The 3 Groups 6-7 items that are the assigned Principal/Senior's own to
# answer (b20 is Manager ODU's final check — see CHECKLIST_ODU_MANAGER_ONLY_FIELDS
# — so it's deliberately excluded here; a principal can never satisfy it).
# Used to gate "Submit back to Manager": a principal must not be able to hand
# the submission back while their own part of the checklist is still blank —
# see submit_to_manager() in views.py.
CHECKLIST_ODU_PRINCIPAL_REQUIRED_FIELDS = frozenset({
    "b17_odu_analysis", "b18_feedback_provided", "b19_final_docs_ready",
})


def odu_checklist_principal_review_complete(checklist) -> bool:
    """True once the assigned Principal/Senior has answered every Groups 6-7
    item that's theirs to answer (b20, Manager ODU's own check, doesn't
    count). `checklist` is an ODURestructureChecklist instance or None."""
    if checklist is None:
        return False
    return all(
        getattr(checklist, field) is not None
        for field in CHECKLIST_ODU_PRINCIPAL_REQUIRED_FIELDS
    )


def user_is_odu_principal_worker(role: str | None) -> bool:
    return bool(role and role in ODU_PRINCIPAL_WORKER_ROLES)


def submission_uses_odu_restructure_checklist(submission: Submission) -> bool:
    return (submission.form_type_code or "") in ODU_RESTRUCTURE_CHECKLIST_FORM_CODES


def submission_in_checklist_draft_phase(submission: Submission) -> bool:
    """Submission is still with the ministry, drafting before OPSC ever sees it."""
    return submission.current_stage == WorkflowStage.DRAFT


def submission_eligible_for_checklist_draft(submission: Submission) -> bool:
    return (
        submission_uses_odu_restructure_checklist(submission)
        and submission_in_checklist_draft_phase(submission)
    )


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
    """Checklist can be shown: ministry drafting it, ODU reviewing it, or
    read-only afterwards."""
    return submission_uses_odu_restructure_checklist(submission) and (
        submission_in_checklist_draft_phase(submission)
        or submission_in_odu_review_phase(submission)
        or submission_in_odu_view_phase(submission)
    )


def user_can_view_odu_checklist(submission: Submission, role: str | None, *, is_admin: bool = False) -> bool:
    """Role-AND-phase-aware visibility check — unlike submission_viewable_odu_checklist()
    above (phase-only), this also restricts *who* can see it at each phase:
    ministry roles only while it's still theirs to fill in, ODU roles only
    during their review, broader roles only once review has concluded.

    Backend mirror of canShowOduChecklist() in
    frontend/src/utils/oduChecklist.js — keep both in sync.
    """
    if not submission_uses_odu_restructure_checklist(submission):
        return False
    if is_admin:
        return True
    if submission_in_checklist_draft_phase(submission):
        return role in CHECKLIST_MINISTRY_ROLES
    if submission_in_odu_review_phase(submission):
        return role in ODU_CHECKLIST_ROLES
    if submission_in_odu_view_phase(submission):
        return role in ODU_CHECKLIST_VIEW_ROLES
    return False


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

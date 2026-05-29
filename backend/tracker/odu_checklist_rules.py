"""When the ODU Restructure Submission Checklist applies."""

from __future__ import annotations

from .models import RoutedUnit, Submission, WorkflowStage

# Organisation restructure / establishment variation (includes regrading via PSC 2-1)
ODU_RESTRUCTURE_CHECKLIST_FORM_CODES = frozenset({"ORG-3.1", "PSC 2-1"})

# ODU manager checklist review (workflow diagram: Manager ODU checklist review)
ODU_CHECKLIST_REVIEW_STAGES = frozenset({WorkflowStage.MANAGER_CHECKLIST_REVIEW})

ODU_CHECKLIST_ROLES = frozenset({
    "odu_principal",
    "principal_org_dev_analyst",
    "principal_job_analyst",
    "odu_manager",
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

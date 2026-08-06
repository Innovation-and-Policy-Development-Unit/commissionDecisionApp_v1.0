/**
 * ODU Restructure Submission Checklist — visibility and eligibility.
 */

export const ODU_RESTRUCTURE_CHECKLIST_FORM_CODES = ['ORG-3.1', 'PSC 2-1']

export const ODU_CHECKLIST_REVIEW_STAGE = 'manager_checklist_review'

// Stages after checklist review where the completed checklist stays visible (read-only).
export const ODU_CHECKLIST_VIEW_STAGES = [
  'under_assessment',
  'secretary_review',
  'returned_for_clarification',
  'deferred',
  'tabled',
  'awaiting_legal_advice',
  'awaiting_cabinet_decision',
  'resubmitted',
  'forwarded_to_commission',
  'commission_sitting',
  'matters_arising',
  'approved',
  'rejected',
  'returned',
  'deferred_back_to_hr',
  'minutes_drafted_signed',
  'decision_entered_assigned',
  'under_implementation',
  'implementation_report',
]

export const ODU_ROUTED_UNIT = 'odu'

export const ODU_PRINCIPAL_WORKER_ROLES = [
  'odu_principal',
]

export const ODU_CHECKLIST_ROLES = [...ODU_PRINCIPAL_WORKER_ROLES, 'odu_manager']

// Roles allowed to view (read-only) the completed checklist after review.
export const ODU_CHECKLIST_VIEW_ROLES = [
  ...ODU_CHECKLIST_ROLES,
  'psc_officer',
  'psc_secretary',
  'senior_admin_officer',
  'psc_manager',
  'psc_admin',
]

// Roles that draft the ministry's submission — same set the digitized
// ORG-3.1/PSC 2-1 form itself is editable by (canEditForm37). They now fill
// in the 20-item checklist themselves; ODU reviews it rather than authoring
// it (confirmed with ODU 2026-08-06).
export const CHECKLIST_MINISTRY_ROLES = [
  'ministry_hr', 'dept_admin', 'psc_admin', 'psc_officer', 'psc_secretary', 'csu_manager',
]

export function userIsOduPrincipalWorker(role) {
  return ODU_PRINCIPAL_WORKER_ROLES.includes(role)
}

export function userIsChecklistMinistryRole(role) {
  return CHECKLIST_MINISTRY_ROLES.includes(role)
}

export function submissionUsesOduRestructureChecklist(submission) {
  const code = submission?.form_type_code || ''
  return ODU_RESTRUCTURE_CHECKLIST_FORM_CODES.includes(code)
}

export function submissionInChecklistDraftPhase(submission) {
  return submission?.current_stage === 'draft'
}

export function submissionInOduReviewPhase(submission) {
  return (
    submission?.routed_unit === ODU_ROUTED_UNIT
    && submission?.current_stage === ODU_CHECKLIST_REVIEW_STAGE
  )
}

export function submissionInOduViewPhase(submission) {
  return (
    submission?.routed_unit === ODU_ROUTED_UNIT
    && ODU_CHECKLIST_VIEW_STAGES.includes(submission?.current_stage)
  )
}

export function canShowOduChecklist(submission, user) {
  if (!user || !submission) return false
  if (!submissionUsesOduRestructureChecklist(submission)) return false
  // Admins / superusers get visibility in every phase for oversight + testing.
  const isAdmin = user.is_superuser || user.role === 'psc_admin'
  // Ministry drafting phase — they fill in the checklist themselves.
  if (
    (isAdmin || CHECKLIST_MINISTRY_ROLES.includes(user.role))
    && submissionInChecklistDraftPhase(submission)
  ) {
    return true
  }
  // Active review phase — ODU manager + principals add their own recommendation.
  if (
    (isAdmin || ODU_CHECKLIST_ROLES.includes(user.role))
    && submissionInOduReviewPhase(submission)
  ) {
    return true
  }
  // Read-only after review — broader reviewer roles keep visibility.
  if (
    (isAdmin || ODU_CHECKLIST_VIEW_ROLES.includes(user.role))
    && submissionInOduViewPhase(submission)
  ) {
    return true
  }
  return false
}

// Roles that can give the final Secretary sign-off on the board paper —
// matches BOARD_PAPER_SECRETARY_ROLES in views.py.
export const BOARD_PAPER_SECRETARY_ROLES = ['psc_secretary', 'senior_admin_officer', 'psc_admin']

export function userIsBoardPaperSecretary(role) {
  return BOARD_PAPER_SECRETARY_ROLES.includes(role)
}

// ── ODU Board Paper (Commission-facing submission ODU prepares) ───────────────

// Editable while ODU is actively working the case: checklist review, then
// their own assessment phase where the board paper itself gets drafted.
export const BOARD_PAPER_EDIT_STAGES = ['manager_checklist_review', 'under_assessment']

export function submissionInBoardPaperEditPhase(submission) {
  return (
    submission?.routed_unit === ODU_ROUTED_UNIT
    && BOARD_PAPER_EDIT_STAGES.includes(submission?.current_stage)
  )
}

export function submissionInBoardPaperViewPhase(submission) {
  return (
    submission?.routed_unit === ODU_ROUTED_UNIT
    && ODU_CHECKLIST_VIEW_STAGES.includes(submission?.current_stage)
    && !BOARD_PAPER_EDIT_STAGES.includes(submission?.current_stage)
  )
}

export function canShowBoardPaper(submission, user) {
  if (!user || !submission) return false
  if (!submissionUsesOduRestructureChecklist(submission)) return false
  const isAdmin = user.is_superuser || user.role === 'psc_admin'
  if (
    (isAdmin || ODU_CHECKLIST_ROLES.includes(user.role))
    && submissionInBoardPaperEditPhase(submission)
  ) {
    return true
  }
  if (
    (isAdmin || ODU_CHECKLIST_VIEW_ROLES.includes(user.role))
    && submissionInBoardPaperViewPhase(submission)
  ) {
    return true
  }
  return false
}

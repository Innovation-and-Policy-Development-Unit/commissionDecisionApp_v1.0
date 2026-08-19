/**
 * IPDU Board Paper — visibility and eligibility.
 *
 * Mirrors the board-paper half of oduChecklist.js — IPDU has no separate
 * "checklist" concept (Manager IPDU drafts the whole board paper
 * themselves, no ministry self-certification step), so this file only
 * covers what ODU's board-paper section covers.
 */

export const IPDU_BOARD_PAPER_FORM_CODES = ['IPDU-TASKFORCE', 'IPDU-ALLOWANCE']

export const IPDU_ROUTED_UNIT = 'ipdu'

// No principal/senior tier — Manager IPDU is the only role that drafts and
// submits the board paper.
export const IPDU_BOARD_PAPER_ROLES = ['ipdu_manager']

// Roles allowed to view (read-only) the board paper after it leaves
// Manager IPDU's hands.
export const IPDU_BOARD_PAPER_VIEW_ROLES = [
  ...IPDU_BOARD_PAPER_ROLES,
  'psc_officer',
  'psc_secretary',
  'senior_admin_officer',
  'psc_manager',
  'psc_admin',
  'psc_commissioner',
  'chairperson',
]

// Same final-sign-off roles as ODU's board paper — matches
// BOARD_PAPER_SECRETARY_ROLES in views.py.
export const BOARD_PAPER_SECRETARY_ROLES = ['psc_secretary', 'senior_admin_officer', 'psc_admin']

export function userIsIpduBoardPaperSecretary(role) {
  return BOARD_PAPER_SECRETARY_ROLES.includes(role)
}

export function userIsIpduManager(role) {
  return role === 'ipdu_manager'
}

export function submissionUsesIpduBoardPaper(submission) {
  const code = submission?.form_type_code || ''
  return IPDU_BOARD_PAPER_FORM_CODES.includes(code)
}

// Editable while Manager IPDU is actively working the case: checklist
// review, then the assessment phase where the board paper itself gets
// drafted — same two stages as ODU's board paper.
export const BOARD_PAPER_EDIT_STAGES = ['manager_checklist_review', 'under_assessment']

// Stages after the board paper has left Manager IPDU's hands where it
// stays visible (read-only) — same set ODU's board paper uses.
export const BOARD_PAPER_VIEW_STAGES = [
  'pending_secretary_approval',
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

export function submissionInIpduBoardPaperEditPhase(submission) {
  // Manager IPDU is the sole author from the very start (no separate
  // ministry-drafting phase like ODU's PSC 2-1/ORG-3.1) — gate Draft on
  // form type alone, since routed_unit is still blank at that point (only
  // auto-derived once submitted). Mirrors ipdu_rules.py's
  // submission_in_board_paper_edit_phase — keep both in sync.
  if (submission?.current_stage === 'draft') {
    return submissionUsesIpduBoardPaper(submission)
  }
  return (
    submission?.routed_unit === IPDU_ROUTED_UNIT
    && BOARD_PAPER_EDIT_STAGES.includes(submission?.current_stage)
  )
}

export function submissionInIpduBoardPaperViewPhase(submission) {
  return (
    submission?.routed_unit === IPDU_ROUTED_UNIT
    && BOARD_PAPER_VIEW_STAGES.includes(submission?.current_stage)
    && !BOARD_PAPER_EDIT_STAGES.includes(submission?.current_stage)
  )
}

export function canShowIpduBoardPaper(submission, user) {
  if (!user || !submission) return false
  if (!submissionUsesIpduBoardPaper(submission)) return false
  const isAdmin = user.is_superuser || user.role === 'psc_admin'
  if (
    (isAdmin || IPDU_BOARD_PAPER_ROLES.includes(user.role))
    && submissionInIpduBoardPaperEditPhase(submission)
  ) {
    return true
  }
  if (
    (isAdmin || IPDU_BOARD_PAPER_VIEW_ROLES.includes(user.role))
    && submissionInIpduBoardPaperViewPhase(submission)
  ) {
    return true
  }
  return false
}

/**
 * ODU Restructure Submission Checklist — visibility and eligibility.
 */

export const ODU_RESTRUCTURE_CHECKLIST_FORM_CODES = ['ORG-3.1', 'PSC 2-1']

export const ODU_CHECKLIST_REVIEW_STAGE = 'manager_checklist_review'

export const ODU_ROUTED_UNIT = 'odu'

export const ODU_CHECKLIST_ROLES = ['odu_principal', 'odu_manager']

export function submissionUsesOduRestructureChecklist(submission) {
  const code = submission?.form_type_code || ''
  return ODU_RESTRUCTURE_CHECKLIST_FORM_CODES.includes(code)
}

export function submissionInOduReviewPhase(submission) {
  return (
    submission?.routed_unit === ODU_ROUTED_UNIT
    && submission?.current_stage === ODU_CHECKLIST_REVIEW_STAGE
  )
}

export function canShowOduChecklist(submission, user) {
  if (!user || !ODU_CHECKLIST_ROLES.includes(user.role)) return false
  return submissionUsesOduRestructureChecklist(submission) && submissionInOduReviewPhase(submission)
}

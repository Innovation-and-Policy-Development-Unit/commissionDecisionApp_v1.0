/**
 * Form types that require the ODU Restructure Submission Checklist (20-item verification).
 * Not shown for appointments, travel, discipline, VIPAM matters, etc.
 */
export const ODU_RESTRUCTURE_CHECKLIST_FORM_CODES = ['ORG-3.1', 'PSC 2-1']

export function submissionUsesOduRestructureChecklist(submission) {
  const code = submission?.form_type_code || ''
  return ODU_RESTRUCTURE_CHECKLIST_FORM_CODES.includes(code)
}

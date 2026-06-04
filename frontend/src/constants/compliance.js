/**
 * Compliance roles, COMP-* form codes, and case families (mirror backend
 * compliance_forms.py / compliance_models.py).
 *
 * Compliance is fully merged into SCDMS: cases are created here, run through the
 * manager-approval chain, then Secretary and Commission stages — no external system.
 */

export const COMPLIANCE_ROLES = ['compliance_senior', 'compliance_principal', 'compliance_manager']

export const COMPLIANCE_PSA_ROLES = ['compliance_principal', 'compliance_manager']

/** Ministry roles that may lodge a complaint with the Compliance unit. */
export const MINISTRY_LODGE_ROLES = ['head_of_agency', 'ministry_hr', 'dept_admin']

export const COMPLIANCE_FORM_CODES = [
  'COMP-SMDR',
  'COMP-PAR',
  'COMP-PSDB',
  'COMP-14D',
  'COMP-OMB',
  'COMP-PSA',
]

/** Case families (value → label), mirrors backend CaseFamily. */
export const CASE_FAMILIES = [
  { value: 'employee_disciplinary',       label: 'Employee Internal Disciplinary' },
  { value: 'serious_misconduct_employee', label: 'Serious Misconduct — Employee' },
  { value: 'temporary_suspension',        label: 'Temporary Suspension' },
  { value: 'grievance',                   label: 'Grievance Process' },
  { value: 'senior_serious_misconduct',   label: 'Senior Executive — Serious Misconduct' },
  { value: 'senior_poor_performance',     label: 'Senior Executive — Poor Performance' },
  { value: 'policy_review',               label: 'Policy / PSA Amendment' },
]

export function isComplianceRole(role) {
  return COMPLIANCE_ROLES.includes(role)
}

export function isMinistryLodgeRole(role) {
  return MINISTRY_LODGE_ROLES.includes(role)
}

export function isComplianceFormCode(code) {
  return typeof code === 'string' && code.startsWith('COMP-')
}

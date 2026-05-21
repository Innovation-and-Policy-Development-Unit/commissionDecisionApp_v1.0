/** Compliance unit roles and submission type codes (mirror backend compliance_forms.py). */

export const COMPLIANCE_ROLES = ['compliance_senior', 'compliance_principal', 'compliance_manager']

export const COMPLIANCE_PSA_ROLES = ['compliance_principal', 'compliance_manager']

export const COMPLIANCE_FORM_CODES = [
  'COMP-SMDR',
  'COMP-PAR',
  'COMP-PSDB',
  'COMP-14D',
  'COMP-OMB',
  'COMP-PSA',
]

export function isComplianceRole(role) {
  return COMPLIANCE_ROLES.includes(role)
}

export function isComplianceFormCode(code) {
  return typeof code === 'string' && code.startsWith('COMP-')
}

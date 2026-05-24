/**
 * Compliance roles and COMP-* form codes (mirror backend compliance_forms.py).
 * CMS-first: create in CMS → Manager approval → sync to portal → Secretary review.
 * Post-decision tasks in SCDMS; CMS case auto-closes when portal matter is complete.
 */

/** Case Management System URL (configure at build time: VITE_CMS_URL). */
export const CMS_PORTAL_URL = import.meta.env.VITE_CMS_URL || 'http://localhost:5173'

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

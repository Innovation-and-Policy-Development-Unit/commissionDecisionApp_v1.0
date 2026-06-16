/**
 * Compliance roles, COMP-* form codes, and case families (mirror backend
 * compliance_forms.py / compliance_models.py).
 *
 * Compliance is fully merged into SCDMS: cases are created here, run through the
 * manager-approval chain, then Secretary and Commission stages — no external system.
 */

// Full compliance unit staff — read/write
export const COMPLIANCE_STAFF_ROLES = ['compliance_senior', 'compliance_principal', 'compliance_manager']

// FR-05: read-only compliance-adjacent roles
export const COMPLIANCE_READ_ONLY_ROLES = ['secretary_opsc', 'dg_director', 'commission_member', 'panel_member']

// All roles that get any compliance UI (used for routing and menu visibility)
export const COMPLIANCE_ROLES = [...COMPLIANCE_STAFF_ROLES, ...COMPLIANCE_READ_ONLY_ROLES]

// Roles that may record decisions
export const DECISION_RECORDING_ROLES = ['compliance_manager', 'psc_admin', 'commission_member', 'secretary_opsc']

// Roles that may appoint mediators / manage senior matters
export const SENIOR_CASE_AUTHORITY_ROLES = ['compliance_manager', 'psc_admin', 'secretary_opsc']

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

/**
 * High-level pipeline milestones per case family — used to render the
 * workflow route header on the case detail and the stage preview on the
 * new-case form. Must stay in sync with compliance_workflows.py stage codes.
 */
export const WORKFLOW_ROUTES = {
  employee_disciplinary: {
    description: 'Notice of Allegation → Subject Response → Investigation Committee → Investigation → Report → HOD Decision → Outcome Letter',
    milestones: [
      { code: 'allegation_notice',   label: 'Notice of Allegation' },
      { code: 'subject_response',    label: 'Subject Response' },
      { code: 'committee_appointed', label: 'Investigation Committee' },
      { code: 'investigation',       label: 'Investigation' },
      { code: 'hod_decision',        label: 'HOD / PSC Decision' },
      { code: 'outcome_letter',      label: 'Outcome Letter' },
    ],
  },
  serious_misconduct_employee: {
    description: 'Show-Cause Notice → Response → Investigator Appointed → Investigation → Report → PSC Assessment → Hearing → Decision',
    milestones: [
      { code: 'show_cause_notice',      label: 'Show-Cause Notice' },
      { code: 'investigator_appointed', label: 'Investigator Appointed' },
      { code: 'investigation',          label: 'Investigation' },
      { code: 'psc_assessment',         label: 'PSC Assessment' },
      { code: 'psc_hearing',            label: 'Formal Hearing' },
      { code: 'psc_decision',           label: 'PSC Decision' },
      { code: 'outcome_letter',         label: 'Outcome Letter' },
    ],
  },
  temporary_suspension: {
    description: 'Suspension Order → Allegation Notice → Subject Response → Authority Review → Continue/Reinstate Decision → Outcome',
    milestones: [
      { code: 'suspension_order',        label: 'Suspension Order' },
      { code: 'allegation_notice',       label: 'Allegation Notice' },
      { code: 'subject_response',        label: 'Subject Response' },
      { code: 'authority_review',        label: 'Authority Review' },
      { code: 'continuation_decision',   label: 'Continue / Reinstate' },
      { code: 'outcome_letter',          label: 'Outcome' },
    ],
  },
  grievance: {
    description: 'Grievance Lodged → MDC Assessment → Mediation → Outcome (Settled / Not Settled) → PSDB if unresolved',
    milestones: [
      { code: 'grievance_lodged',   label: 'Grievance Lodged' },
      { code: 'mdc_assessment',     label: 'MDC Assessment' },
      { code: 'mediation',          label: 'Mediation' },
      { code: 'mediation_outcome',  label: 'Mediation Outcome' },
      { code: 'psdb_referral',      label: 'PSDB (if unresolved)', optional: true },
      { code: 'outcome_letter',     label: 'Outcome Letter' },
    ],
  },
  senior_serious_misconduct: {
    description: 'Allegation to Commission → Preliminary Assessment → Notice to Executive → Investigation → Commission Deliberation → Determination → Confirmation',
    milestones: [
      { code: 'allegation_referral',      label: 'Allegation to Commission' },
      { code: 'commission_assessment',    label: 'Commission Assessment' },
      { code: 'allegation_notice',        label: 'Notice to Executive' },
      { code: 'investigator_appointed',   label: 'Investigator Appointed' },
      { code: 'investigation',            label: 'Investigation (45 days)' },
      { code: 'commission_deliberation',  label: 'Commission Deliberation' },
      { code: 'commission_determination', label: 'Determination' },
      { code: 'commission_confirmation',  label: 'Confirmation (45 days)' },
      { code: 'decision_implemented',     label: 'Decision Implemented' },
    ],
  },
  senior_poor_performance: {
    description: 'Performance Concerns → PIP Notice → PIP Monitoring (90 days) → PIP Review → Commission → Ministerial Decision → Confirmation',
    milestones: [
      { code: 'performance_concerns',        label: 'Performance Concerns' },
      { code: 'pip_notice',                  label: 'PIP Notice Issued' },
      { code: 'pip_commenced',               label: 'PIP Commenced' },
      { code: 'pip_monitoring',              label: 'PIP Monitoring (90 days)' },
      { code: 'pip_review',                  label: 'PIP Review' },
      { code: 'commission_assessment',       label: 'Commission Assessment' },
      { code: 'commission_recommendation',   label: 'Commission Recommendation' },
      { code: 'ministerial_decision',        label: 'Ministerial Decision' },
      { code: 'commission_confirmation',     label: 'Confirmation (45 days)' },
      { code: 'decision_implemented',        label: 'Decision Implemented' },
    ],
  },
  policy_review: {
    description: 'Policy review and amendment workflow',
    milestones: [],
  },
}

export function isComplianceRole(role) {
  return COMPLIANCE_ROLES.includes(role)
}

export function isComplianceStaffRole(role) {
  return COMPLIANCE_STAFF_ROLES.includes(role)
}

export function isReadOnlyComplianceRole(role) {
  return COMPLIANCE_READ_ONLY_ROLES.includes(role)
}

export function canRecordDecision(role) {
  return DECISION_RECORDING_ROLES.includes(role)
}

export function canManageSeniorCases(role) {
  return SENIOR_CASE_AUTHORITY_ROLES.includes(role)
}

export function isMinistryLodgeRole(role) {
  return MINISTRY_LODGE_ROLES.includes(role)
}

export function isComplianceFormCode(code) {
  return typeof code === 'string' && code.startsWith('COMP-')
}

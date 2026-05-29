/** Mirrors backend tracker.opsc_access role sets for nav and UI gating. */

export const OPSC_UNIT_MANAGER_ROLES = new Set([
  'vipam_manager',
  'hr_unit_manager',
  'odu_manager',
  'compliance_manager',
  'csu_manager',
])

export const OPSC_UNIT_PRINCIPAL_ROLES = new Set([
  'vipam_principal',
  'hr_unit_principal',
  'odu_principal',
  'principal_org_dev_analyst',
  'principal_job_analyst',
  'compliance_principal',
])

export const OPSC_POST_DECISION_ROLES = new Set([
  'psc_manager',
  'principal_officer',
  'senior_officer',
])

export const COMMISSION_DECISION_VIEW_ROLES = new Set([
  ...OPSC_UNIT_MANAGER_ROLES,
  ...OPSC_UNIT_PRINCIPAL_ROLES,
  ...OPSC_POST_DECISION_ROLES,
])

export function userHasCommissionDecisionView(user) {
  return Boolean(user?.role && COMMISSION_DECISION_VIEW_ROLES.has(user.role))
}

export function userIsOpscUnitManager(user) {
  return Boolean(user?.role && OPSC_UNIT_MANAGER_ROLES.has(user.role))
}

export function userIsOpscUnitPrincipal(user) {
  return Boolean(user?.role && OPSC_UNIT_PRINCIPAL_ROLES.has(user.role))
}

export function userCanWorkCommissionTask(user, task) {
  if (!user || !task) return false
  const uid = user.id
  const uname = user.username
  if (task.assigned_manager_username === uname) return true
  if (task.assigned_staff_username === uname) return true
  if (Array.isArray(task.assigned_staff_m2m) && task.assigned_staff_m2m.includes(uid)) {
    return true
  }
  return false
}

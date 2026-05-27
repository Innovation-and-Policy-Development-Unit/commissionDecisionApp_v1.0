import { COMPLIANCE_ROLES } from '../constants/compliance'
import { userIsAdmin } from './adminAccess'
import { COMMISSION_DECISION_VIEW_ROLES, userHasCommissionDecisionView } from './opscAccess'

export function isComplianceRole(role) {
  return COMPLIANCE_ROLES.includes(role)
}

export function userIsComplianceStaff(user) {
  return Boolean(user && isComplianceRole(user.role))
}

const SECRETARIAT_ROLES = new Set([
  'psc_admin',
  'psc_secretary',
  'senior_admin_officer',
  'psc_commissioner',
  'chairperson',
  'psc_officer',
  'psc_manager',
  'principal_officer',
  'senior_officer',
])

/** Full secretariat workflow (meetings, minute intake, allocate tasks). */
export function userIsSecretariatStaff(user) {
  if (!user) return false
  if (userIsAdmin(user)) return true
  return SECRETARIAT_ROLES.has(user.role)
}

/** OPSC unit managers/principals + post-decision staff — minutes & tasks (read-all, work allocated). */
export function userIsCommissionDecisionOps(user) {
  if (!user) return false
  if (userIsAdmin(user)) return true
  return userHasCommissionDecisionView(user)
}

export { COMMISSION_DECISION_VIEW_ROLES }

/** Menu audience tags on nav items / groups */
export function menuItemVisibleForUser(item, user) {
  // Role-gated items: visible only to the listed roles (or site admins)
  if (item.roles && item.roles.length > 0) {
    if (!user) return false
    if (userIsAdmin(user)) return true
    return item.roles.includes(user.role)
  }

  const audience = item.audience ?? 'all'
  if (audience === 'all') return true
  if (!user) return false
  if (audience === 'compliance') return userIsComplianceStaff(user)
  if (audience === 'secretariat') {
    if (userIsAdmin(user)) return true
    return userIsSecretariatStaff(user) && !userIsComplianceStaff(user)
  }
  if (audience === 'commission_decision') {
    if (userIsAdmin(user)) return true
    return userIsCommissionDecisionOps(user) && !userIsComplianceStaff(user)
  }
  if (audience === 'exclude_compliance') return !userIsComplianceStaff(user)
  return true
}

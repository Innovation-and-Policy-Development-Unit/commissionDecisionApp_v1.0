import { COMPLIANCE_ROLES, COMPLIANCE_STAFF_ROLES } from '../constants/compliance'
import { userIsAdmin } from './adminAccess'
import {
  COMMISSION_DECISION_VIEW_ROLES,
  userHasCommissionDecisionView,
  userIsOpscInternal,
} from './opscAccess'

export function isComplianceRole(role) {
  return COMPLIANCE_ROLES.includes(role)
}

/** Full compliance unit staff — read/write access */
export function userIsComplianceStaff(user) {
  return Boolean(user && COMPLIANCE_STAFF_ROLES.includes(user.role))
}

/** Any role with compliance visibility (staff + read-only adjacent roles) */
export function userHasComplianceAccess(user) {
  return Boolean(user && isComplianceRole(user.role))
}

// True secretariat / Commission roles only. OPSC unit managers, principals,
// officers, and post-decision staff are NOT secretariat: they see endorsed
// minutes & agenda (audience 'opsc_internal') and their task register, but
// never the meeting/agenda-building or minute-intake workflow.
const SECRETARIAT_ROLES = new Set([
  'psc_admin',
  'psc_secretary',
  'senior_admin_officer',
  'psc_commissioner',
  'chairperson',
])

/** Full secretariat workflow (meetings, minute intake, allocate tasks). */
export function userIsSecretariatStaff(user) {
  if (!user) return false
  if (userIsAdmin(user)) return true
  return SECRETARIAT_ROLES.has(user.role)
}

// Commission members view meetings/agenda/minutes and receive notifications, but
// do not operate the secretariat tooling (minute intake, decisions register).
const COMMISSION_VIEW_ONLY_ROLES = new Set(['psc_commissioner', 'chairperson'])

/** Secretariat *operators* — secretariat staff excluding view-only Commission roles. */
export function userIsSecretariatOperator(user) {
  if (!user) return false
  if (userIsAdmin(user)) return true
  return SECRETARIAT_ROLES.has(user.role) && !COMMISSION_VIEW_ONLY_ROLES.has(user.role)
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
  // Site admins / superusers see every menu, including compliance.
  if (userIsAdmin(user)) return true
  if (audience === 'compliance') return userHasComplianceAccess(user)
  if (audience === 'secretariat') {
    return userIsSecretariatStaff(user) && !userIsComplianceStaff(user)
  }
  if (audience === 'secretariat_operator') {
    // Operator-only tools (minute intake, decisions register) — excludes
    // view-only Commission members/Chairperson.
    return userIsSecretariatOperator(user) && !userIsComplianceStaff(user)
  }
  if (audience === 'commission_decision') {
    return userIsCommissionDecisionOps(user) && !userIsComplianceStaff(user)
  }
  if (audience === 'opsc_internal') {
    // All OPSC staff (endorsed minutes etc.); compliance keeps its own menu.
    return userIsOpscInternal(user) && !userIsComplianceStaff(user)
  }
  if (audience === 'exclude_compliance') return !userHasComplianceAccess(user)
  return true
}

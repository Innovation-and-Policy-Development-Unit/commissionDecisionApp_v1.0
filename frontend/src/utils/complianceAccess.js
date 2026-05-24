import { COMPLIANCE_ROLES } from '../constants/compliance'
import { userIsAdmin } from './adminAccess'

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

export function userIsSecretariatStaff(user) {
  if (!user) return false
  // Django superuser/staff and PSC Administrator always see Commission nav
  if (userIsAdmin(user)) return true
  return SECRETARIAT_ROLES.has(user.role)
}

/** Menu audience tags on nav items / groups */
export function menuItemVisibleForUser(item, user) {
  const audience = item.audience ?? 'all'
  if (audience === 'all') return true
  if (!user) return false
  if (audience === 'compliance') return userIsComplianceStaff(user)
  if (audience === 'secretariat') {
    // Admins need Commission + Administration; compliance-only roles do not
    if (userIsAdmin(user)) return true
    return userIsSecretariatStaff(user) && !userIsComplianceStaff(user)
  }
  if (audience === 'exclude_compliance') return !userIsComplianceStaff(user)
  return true
}

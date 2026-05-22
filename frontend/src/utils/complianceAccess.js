import { COMPLIANCE_ROLES } from '../constants/compliance'

export function isComplianceRole(role) {
  return COMPLIANCE_ROLES.includes(role)
}

export function userIsComplianceStaff(user) {
  return Boolean(user && isComplianceRole(user.role))
}

const SECRETARIAT_ROLES = new Set([
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
  if (user.is_superuser || user.is_staff) return true
  return SECRETARIAT_ROLES.has(user.role)
}

/** Menu audience tags on nav items / groups */
export function menuItemVisibleForUser(item, user) {
  const audience = item.audience ?? 'all'
  if (audience === 'all') return true
  if (!user) return false
  if (audience === 'compliance') return userIsComplianceStaff(user)
  if (audience === 'secretariat') return userIsSecretariatStaff(user) && !userIsComplianceStaff(user)
  if (audience === 'exclude_compliance') return !userIsComplianceStaff(user)
  return true
}

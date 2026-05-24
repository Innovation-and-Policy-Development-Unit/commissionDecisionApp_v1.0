/**
 * Admin UI access from GET /me/ (with fallbacks if fields are missing).
 */

export function userCanManageUsers(user) {
  if (!user) return false
  if (typeof user.can_manage_users === 'boolean') return user.can_manage_users
  return Boolean(user.is_superuser || user.is_staff || user.role === 'psc_admin')
}

export function userCanManageRoles(user) {
  if (!user) return false
  if (typeof user.can_manage_roles === 'boolean') return user.can_manage_roles
  return Boolean(user.is_superuser || user.is_staff || user.role === 'psc_admin')
}

export function userCanManageTranslations(user) {
  if (!user) return false
  if (typeof user.can_manage_translations === 'boolean') return user.can_manage_translations
  return userCanManageRoles(user)
}

export function userCanAccessAdminPanel(user) {
  if (!user) return false
  if (typeof user.can_access_admin_panel === 'boolean') return user.can_access_admin_panel
  return userCanManageUsers(user) || userCanManageRoles(user)
}

export function userCanViewAuditLog(user) {
  if (!user) return false
  if (typeof user.can_view_audit_log === 'boolean') return user.can_view_audit_log
  // Fallback: admins can always view it
  return userCanManageRoles(user)
}

export function userCanManageFeedback(user) {
  if (!user) return false
  if (typeof user.can_manage_feedback === 'boolean') return user.can_manage_feedback
  return userIsAdmin(user)
}

export function userIsAdmin(user) {
  if (!user) return false
  return Boolean(user.is_superuser || user.is_staff || user.role === 'psc_admin')
}

import { userIsAdmin } from './adminAccess'

/** Mirrors MinutesViewSet.perform_update — who may create/edit minutes.
 *  All other OPSC staff get the read-only view (signed minutes only). */
const MINUTES_EDIT_ROLES = new Set([
  'psc_secretary',
  'psc_admin',
  'chairperson',
  'psc_commissioner',
])

export function userCanEditMinutes(user) {
  if (!user) return false
  if (userIsAdmin(user)) return true
  return MINUTES_EDIT_ROLES.has(user.role)
}

/** PSC travel forms — secretary-only workflow. */

export const TRAVEL_CATEGORY_CODE = 'TRAVEL'

export const FORM_44_CODE = 'PSC 4.4'
export const TRAVEL_FORM_CODES = [FORM_44_CODE, 'PSC 4.5', 'PSC 4.6']
export const TRAVELLER_SECRETARY_FORM_CODES = ['PSC 4.5', 'PSC 4.6']
export const TRAVEL_LETTER_FORM_CODES = ['PSC 4.5', 'PSC 4.6']

export function normalizeTravelFormCode(code) {
  const c = (code || '').trim()
  const compact = c.toUpperCase().replace(/\s/g, '')
  if (compact === 'PSC4.4') return FORM_44_CODE
  if (compact === 'PSC4.5') return 'PSC 4.5'
  if (compact === 'PSC4.6') return 'PSC 4.6'
  return c
}

export function isTravelFormCode(code) {
  return TRAVEL_FORM_CODES.includes(normalizeTravelFormCode(code))
}

export function isForm44Code(code) {
  return normalizeTravelFormCode(code) === FORM_44_CODE
}

export function requiresTravelLetter(code) {
  return TRAVEL_LETTER_FORM_CODES.includes(normalizeTravelFormCode(code))
}

/** Form 4.4 — department director or ministry DG (head_of_agency). */
export function canCreateForm44(user) {
  return user?.role === 'head_of_agency'
}

const DG_ENDORSER_SLOT = {
  key: 'dg',
  label: 'Director-General (or Officer-in-Charge / Acting DG)',
}

const DEPT_ENDORSER_SLOTS = [
  { key: 'director', label: 'Department Director' },
  DG_ENDORSER_SLOT,
]

/**
 * Ministry CSU / central ministry HR (no department on profile or form).
 * 4.5/4.6: DG only → ODU Manager → Secretary.
 */
export function isMinistryCsuInitiator(user, departmentIdOnForm = '') {
  if (!user || user.role === 'head_of_agency') return false
  if (user.role !== 'ministry_hr') return false
  const deptId = departmentIdOnForm || user.department_id
  return !deptId
}

/** Department staff (traveller, dept admin, or ministry HR tied to a department). */
export function isDepartmentStaffInitiator(user, departmentIdOnForm = '') {
  if (!user || user.role === 'head_of_agency') return false
  if (isMinistryCsuInitiator(user, departmentIdOnForm)) return false
  if (user.role === 'traveller' || user.role === 'dept_admin') return true
  if (user.role === 'ministry_hr' && (user.department_id || departmentIdOnForm)) return true
  return false
}

/** Endorser fields shown when creating a secretary travel request. */
export function endorserSlotsForTravelForm(formTypeCode, user, departmentIdOnForm = '') {
  const code = normalizeTravelFormCode(formTypeCode)
  if (isForm44Code(code)) return []
  if (!TRAVELLER_SECRETARY_FORM_CODES.includes(code)) return []
  if (user?.role === 'head_of_agency') return []
  if (isMinistryCsuInitiator(user, departmentIdOnForm)) return [DG_ENDORSER_SLOT]
  if (isDepartmentStaffInitiator(user, departmentIdOnForm)) return DEPT_ENDORSER_SLOTS
  return DEPT_ENDORSER_SLOTS
}

export function isTravellerRole(user) {
  return user?.role === 'traveller'
}

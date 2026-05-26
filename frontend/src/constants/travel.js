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

function resolveDepartmentContext(departmentContext) {
  if (departmentContext && typeof departmentContext === 'object') {
    if ('department' in departmentContext || 'ministries' in departmentContext) {
      return {
        department: departmentContext.department ?? null,
        ministries: departmentContext.ministries ?? [],
        departmentId:
          departmentContext.departmentId
          ?? departmentContext.department?.id
          ?? '',
      }
    }
    return {
      department: departmentContext,
      ministries: [],
      departmentId: departmentContext.id ?? '',
    }
  }
  return { department: null, ministries: [], departmentId: departmentContext || '' }
}

/** Department head title for endorsements (matches backend default_head_position_title). */
export function defaultHeadPositionTitle(department) {
  if (!department) return 'Department head'
  const custom = (department.head_position_title || '').trim()
  if (custom) return custom
  const name = (department.name || '').trim()
  const code = (department.code || '').toUpperCase()
  if (/statistic/i.test(name) || ['VNSO', 'NSO', 'VBS'].includes(code)) {
    return 'Chief Statistician'
  }
  if (name) return `Director, ${name}`
  return 'Director'
}

/** DG of the ministry that owns the selected department. */
export function ministryDgEndorserLabel(department, ministries = []) {
  const ministryName =
    department?.ministry_name
    || ministries.find(m => String(m.id) === String(department?.ministry))?.name
  if (ministryName) {
    return `Director-General — ${ministryName}`
  }
  return 'Director-General (or Officer-in-Charge / Acting DG)'
}

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
export function endorserSlotsForTravelForm(formTypeCode, user, departmentContext = '') {
  const code = normalizeTravelFormCode(formTypeCode)
  if (isForm44Code(code)) return []
  if (!TRAVELLER_SECRETARY_FORM_CODES.includes(code)) return []

  const { department, ministries, departmentId } = resolveDepartmentContext(departmentContext)

  if (user?.role === 'head_of_agency') return []

  const dgSlot = {
    key: 'dg',
    label: ministryDgEndorserLabel(department, ministries),
  }

  if (isMinistryCsuInitiator(user, departmentId)) return [dgSlot]

  if (isDepartmentStaffInitiator(user, departmentId) || department) {
    return [
      { key: 'director', label: defaultHeadPositionTitle(department) },
      dgSlot,
    ]
  }

  return [
    { key: 'director', label: defaultHeadPositionTitle(department) },
    dgSlot,
  ]
}

export function isTravellerRole(user) {
  return user?.role === 'traveller'
}

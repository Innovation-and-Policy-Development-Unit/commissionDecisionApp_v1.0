/** PSC travel forms — secretary-only workflow; ODU Manager → Secretary. */

export const TRAVEL_CATEGORY_CODE = 'TRAVEL'

export const FORM_44_CODE = 'PSC 4.4'
export const TRAVEL_FORM_CODES = [FORM_44_CODE, 'PSC 4.5', 'PSC 4.6']
export const TRAVELLER_SECRETARY_FORM_CODES = ['PSC 4.5', 'PSC 4.6']
export const TRAVEL_LETTER_FORM_CODES = ['PSC 4.5', 'PSC 4.6']

const STAFF_CREATE_ROLES = ['traveller', 'dept_admin', 'ministry_hr', 'head_of_agency']
const PSC_CREATE_ROLES = ['psc_officer', 'psc_admin', 'psc_secretary']

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

export function canCreateSecretaryTravel(user) {
  if (!user?.role) return false
  return user.role === 'ministry_hr' || PSC_CREATE_ROLES.includes(user.role)
}

export function canCreateForm44(user) {
  return canCreateSecretaryTravel(user)
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

export function ministryDgEndorserLabel(department, ministries = []) {
  const ministryName =
    department?.ministry_name
    || ministries.find(m => String(m.id) === String(department?.ministry))?.name
  if (ministryName) {
    return `Director-General — ${ministryName}`
  }
  return 'Director-General (or Officer-in-Charge / Acting DG)'
}

/** Ministry CSU staff — ministry_hr with no department on profile or form. */
export function isMinistryCsuInitiator(user, departmentIdOnForm = '') {
  if (!user || user.role === 'head_of_agency') return false
  if (user.role !== 'ministry_hr') return false
  const deptId = departmentIdOnForm || user.department_id
  return !deptId
}

/** Department staff (traveller, dept admin, ministry HR with a department). */
export function isDepartmentStaffInitiator(user, departmentIdOnForm = '') {
  if (!user || user.role === 'head_of_agency') return false
  if (isMinistryCsuInitiator(user, departmentIdOnForm)) return false
  if (user.role === 'traveller' || user.role === 'dept_admin') return true
  if (user.role === 'ministry_hr' && (user.department_id || departmentIdOnForm)) return true
  return false
}

/** Department director — head_of_agency with a department. */
export function isDeptDirectorInitiator(user) {
  return user?.role === 'head_of_agency' && !!user?.department_id
}

/** Ministry DG — head_of_agency without a department. */
export function isMinistryDgInitiator(user) {
  return user?.role === 'head_of_agency' && !user?.department_id
}

/** Ordered ministry approval steps (labels only; routing is automatic). */
export function travelApprovalRoute(formTypeCode, user, departmentContext = '') {
  return endorserSlotsForTravelForm(formTypeCode, user, departmentContext).map(s => s.label)
}

/** Internal: endorsement slots (matches backend endorsement_sections). */
export function endorserSlotsForTravelForm(formTypeCode, user, departmentContext = '') {
  const code = normalizeTravelFormCode(formTypeCode)
  if (!isTravelFormCode(code)) return []

  const { department, ministries, departmentId } = resolveDepartmentContext(departmentContext)
  const directorSlot = {
    key: 'director',
    label: defaultHeadPositionTitle(department),
  }
  const dgSlot = {
    key: 'dg',
    label: ministryDgEndorserLabel(department, ministries),
  }

  if (isMinistryDgInitiator(user)) return []

  if (isForm44Code(code)) {
    if (isDeptDirectorInitiator(user)) return []
    if (isMinistryCsuInitiator(user, departmentId)) return [dgSlot]
    if (isDepartmentStaffInitiator(user, departmentId)) return [directorSlot]
    return []
  }

  // 4.5 / 4.6
  if (isDeptDirectorInitiator(user) || isMinistryCsuInitiator(user, departmentId)) {
    return [dgSlot]
  }
  if (isDepartmentStaffInitiator(user, departmentId)) {
    return [directorSlot, dgSlot]
  }
  return [directorSlot, dgSlot]
}

/** Short workflow hint on the create form. */
export function travelWorkflowHint(formTypeCode, user, departmentIdOnForm = '') {
  const code = normalizeTravelFormCode(formTypeCode)
  const tail = 'then ODU Manager review and Secretary approval.'
  if (isMinistryDgInitiator(user)) {
    return `As ministry DG you lodge directly — ${tail}`
  }
  if (isForm44Code(code)) {
    if (isDeptDirectorInitiator(user)) {
      return `As department director you lodge directly — ${tail}`
    }
    if (isMinistryCsuInitiator(user, departmentIdOnForm)) {
      return `Ministry CSU: DG endorsement, ${tail}`
    }
    if (isDepartmentStaffInitiator(user, departmentIdOnForm)) {
      return `Department staff: your department head endorses, ${tail}`
    }
    return `Domestic travel allowance (4.4): ${tail}`
  }
  if (isDeptDirectorInitiator(user)) {
    return `Department director: DG endorsement, ${tail}`
  }
  if (isMinistryCsuInitiator(user, departmentIdOnForm)) {
    return `Ministry CSU: DG endorsement, ${tail}`
  }
  if (isDepartmentStaffInitiator(user, departmentIdOnForm)) {
    return `Department staff: department head then DG, ${tail}`
  }
  return `Collect required endorsements, ${tail}`
}

export function isTravellerRole(user) {
  return user?.role === 'traveller'
}

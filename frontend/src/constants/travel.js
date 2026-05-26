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

export const ENDORSER_SLOTS_45_46 = [
  { key: 'director', label: 'Director' },
  { key: 'dg', label: 'Director-General (or Officer-in-Charge / Acting DG)' },
]

/** Endorser fields shown when creating a secretary travel request. */
export function endorserSlotsForTravelForm(formTypeCode, user) {
  const code = normalizeTravelFormCode(formTypeCode)
  if (isForm44Code(code)) {
    return []
  }
  if (code === 'PSC 4.5') {
    if (user?.role === 'head_of_agency') return []
    return ENDORSER_SLOTS_45_46
  }
  if (code === 'PSC 4.6') {
    if (user?.role === 'head_of_agency') return []
    return ENDORSER_SLOTS_45_46
  }
  if (user?.role === 'head_of_agency') return []
  return ENDORSER_SLOTS_45_46
}

export function isTravellerRole(user) {
  return user?.role === 'traveller'
}

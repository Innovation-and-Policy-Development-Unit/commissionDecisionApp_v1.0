/** PSC travel forms — secretary-only workflow (4.4, 4.5, 4.6). */

export const TRAVEL_CATEGORY_CODE = 'TRAVEL'

export const TRAVEL_FORM_CODES = ['PSC 4.4', 'PSC 4.5', 'PSC 4.6']

export const TRAVEL_LETTER_FORM_CODES = ['PSC 4.5', 'PSC 4.6']

export function isTravelFormCode(code) {
  return TRAVEL_FORM_CODES.includes(code)
}

export function requiresTravelLetter(code) {
  return TRAVEL_LETTER_FORM_CODES.includes(code)
}

export const ENDORSER_SLOTS = [
  { key: 'hod', label: 'Head of Department' },
  { key: 'director', label: 'Director' },
  { key: 'dg', label: 'Director-General' },
  { key: 'minister', label: 'Minister (if DG is travelling — Form 4.5)' },
]

export function isTravellerRole(user) {
  return user?.role === 'traveller'
}

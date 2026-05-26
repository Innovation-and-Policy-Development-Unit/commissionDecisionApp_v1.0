import {
  isTravelFormCode,
  isForm44Code,
  normalizeTravelFormCode,
  TRAVEL_CATEGORY_CODE,
} from './travel'

/** Form categories excluded from the Commission create path. */
export const COMMISSION_EXCLUDED_CATEGORY_CODES = ['TRAVEL', 'COMPLIANCE', 'INTERNAL']

export function categoryById(categories) {
  return Object.fromEntries((categories || []).map(c => [String(c.id), c]))
}

/** Ministry HR (and PSC desk) lodge secretary travel 4.4–4.6. */
export function canCreateSecretaryTravel(user) {
  if (!user) return false
  return ['ministry_hr', 'psc_officer', 'psc_admin', 'psc_secretary'].includes(user.role)
}

/** Public servants browse secretary travel in their ministry (read-only). */
export function canViewSecretaryTravelList(user) {
  if (!user) return false
  return user.role === 'traveller'
}

/** Secretary path: travel forms 4.4–4.6 when user may lodge them. */
export function filterSecretaryFormTypes(formTypes, categories, user) {
  if (!canCreateSecretaryTravel(user)) return []
  const cats = categoryById(categories)
  return (formTypes || []).filter(ft => {
    const code = normalizeTravelFormCode(ft.code)
    if (!isTravelFormCode(code)) return false
    const cat = cats[String(ft.form_category)]
    return cat?.code === TRAVEL_CATEGORY_CODE || isTravelFormCode(code)
  })
}

/** Commission track: active types outside travel, compliance, and internal. */
export function filterCommissionFormTypes(formTypes, categories) {
  const cats = categoryById(categories)
  return (formTypes || []).filter(ft => {
    const code = normalizeTravelFormCode(ft.code || '')
    if (isTravelFormCode(code)) return false
    if (code.startsWith('COMP-')) return false
    const cat = cats[String(ft.form_category)]
    if (cat && COMMISSION_EXCLUDED_CATEGORY_CODES.includes(cat.code)) return false
    if (cat?.name === 'Internal Submissions') return false
    return true
  })
}

import {
  isTravelFormCode,
  isForm44Code,
  canCreateForm44,
  normalizeTravelFormCode,
  TRAVEL_CATEGORY_CODE,
} from './travel'

/** Form categories excluded from the Commission create path. */
export const COMMISSION_EXCLUDED_CATEGORY_CODES = ['TRAVEL', 'COMPLIANCE', 'INTERNAL']

export function categoryById(categories) {
  return Object.fromEntries((categories || []).map(c => [String(c.id), c]))
}

/** Secretary path: 4.5/4.6 for staff; 4.4 only for head_of_agency (director / DG). */
export function filterSecretaryFormTypes(formTypes, categories, user) {
  const cats = categoryById(categories)
  return (formTypes || []).filter(ft => {
    const code = normalizeTravelFormCode(ft.code)
    if (isForm44Code(code)) {
      return canCreateForm44(user)
    }
    if (isTravelFormCode(code) && !isForm44Code(code)) {
      return true
    }
    const cat = cats[String(ft.form_category)]
    return cat?.code === TRAVEL_CATEGORY_CODE && !isForm44Code(code)
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

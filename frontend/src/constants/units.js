/** Mirrors backend tracker.models.RoutedUnit — keep in sync. */

export const ROUTED_UNIT_OPTIONS = [
  { value: 'odu', label: 'ODU' },
  { value: 'hr', label: 'HR Unit' },
  { value: 'vipam', label: 'VIPAM' },
  { value: 'compliance', label: 'Compliance Unit' },
  { value: 'csu', label: 'Corporate Services Unit' },
  { value: 'ipdu', label: 'IPDU' },
]

const BY_CODE = Object.fromEntries(ROUTED_UNIT_OPTIONS.map(u => [u.value, u.label]))

/** Unit label for a routed_unit code, falling back to the code itself. */
export function routedUnitLabel(code) {
  if (!code) return ''
  return BY_CODE[code] || code.toUpperCase()
}

/** The role that manages each unit — mirrors flying_agenda._UNIT_MANAGER_ROLE. */
export const UNIT_MANAGER_ROLE = {
  odu: 'odu_manager',
  hr: 'hr_unit_manager',
  vipam: 'vipam_manager',
  compliance: 'compliance_manager',
  csu: 'csu_manager',
  ipdu: 'ipdu_manager',
}

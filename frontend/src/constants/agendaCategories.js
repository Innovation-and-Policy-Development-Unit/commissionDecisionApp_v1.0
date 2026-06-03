/**
 * Fallback agenda sections when API is unavailable (matches default DB seed).
 */
export const AGENDA_SECTIONS_FALLBACK = [
  { value: 'preliminaries', label: '1. Preliminaries & Endorsements', isSpecial: true, group: '' },
  { value: 'matters_arising', label: '2. Matters Arising', isSpecial: true, group: '' },
  { value: 'appointment', label: 'Appointment / Acting Appointment', isSpecial: false, group: 'Appointments' },
  { value: 'direct_appointment', label: 'Direct Appointment / Confirmation of Appointment', isSpecial: false, group: 'Appointments' },
  { value: 'restructure', label: 'Restructure / Structure Amendment', isSpecial: false, group: 'Structure' },
  { value: 'anomalies', label: 'Anomalies', isSpecial: false, group: 'Structure' },
  { value: 'extra_responsibility', label: 'Extra Responsibility / Overtime Allowance / Special Skills Allowance', isSpecial: false, group: 'Allowances & Pay' },
  { value: 'salary_adjustment', label: 'Salary Adjustment', isSpecial: false, group: 'Allowances & Pay' },
  { value: 'contract', label: 'Contract / Temporary Salaried Appointment', isSpecial: false, group: 'Contract & Temporary' },
  { value: 'temporary_salaried', label: 'Temporary Salaried Appointment', isSpecial: false, group: 'Contract & Temporary' },
  { value: 'training', label: 'Long Term Training / Scholarship / Internship / Cadetship / Extension / Direct Appointment', isSpecial: false, group: 'Training' },
  { value: 'discipline_compliance', label: 'Discipline / Compliance', isSpecial: false, group: 'Discipline & Health' },
  { value: 'health_commission', label: 'Health Commission', isSpecial: false, group: 'Discipline & Health' },
  { value: 'medical_claim', label: 'Medical Claim', isSpecial: false, group: 'Claims & Severance' },
  { value: 'partial_severance', label: 'Partial Severance', isSpecial: false, group: 'Claims & Severance' },
  { value: 'resignation', label: 'Resignation / Retirement / Death', isSpecial: false, group: 'Claims & Severance' },
  { value: 'other', label: 'Other Matters', isSpecial: false, group: 'Other' },
]

/** @deprecated use useAgendaSections — kept for imports that expect AGENDA_SECTIONS */
export const AGENDA_SECTIONS = AGENDA_SECTIONS_FALLBACK

export const COMMISSION_LODGE_SECTIONS = AGENDA_SECTIONS_FALLBACK.filter(s => !s.isSpecial)

export const AGENDA_SECTION_ORDER = AGENDA_SECTIONS_FALLBACK.map(s => s.value)

export function agendaSectionLabel(value) {
  return AGENDA_SECTIONS_FALLBACK.find(s => s.value === value)?.label ?? value
}


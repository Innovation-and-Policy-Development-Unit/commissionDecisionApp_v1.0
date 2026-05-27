/**
 * Fallback agenda sections when API is unavailable (matches default DB seed).
 */
export const AGENDA_SECTIONS_FALLBACK = [
  { value: 'preliminaries', label: '1. Preliminaries & Endorsements', isSpecial: true },
  { value: 'matters_arising', label: '2. Matters Arising', isSpecial: true },
  { value: 'discipline_compliance', label: '3. Discipline / Compliance', isSpecial: false },
  { value: 'health_commission', label: '4. Health Commission', isSpecial: false },
  { value: 'appointment', label: '5. Appointment / Acting Appointment', isSpecial: false },
  { value: 'direct_appointment', label: '6. Direct Appointment / Confirmation of Appointment', isSpecial: false },
  { value: 'extra_responsibility', label: '7. Extra Responsibility / Overtime Allowance / Special Skills Allowance', isSpecial: false },
  { value: 'contract', label: '8. Contract / Temporary Salaried Appointment', isSpecial: false },
  { value: 'temporary_salaried', label: '9. Temporary Salaried Appointment', isSpecial: false },
  { value: 'salary_adjustment', label: '10. Salary Adjustment', isSpecial: false },
  { value: 'training', label: '11. Long Term Training / Scholarship / Internship / Cadetship / Extension / Direct Appointment', isSpecial: false },
  { value: 'medical_claim', label: '12. Medical Claim', isSpecial: false },
  { value: 'partial_severance', label: '13. Partial Severance', isSpecial: false },
  { value: 'resignation', label: '14. Resignation / Retirement / Death', isSpecial: false },
  { value: 'other', label: '15. Other Matters', isSpecial: false },
]

/** @deprecated use useAgendaSections — kept for imports that expect AGENDA_SECTIONS */
export const AGENDA_SECTIONS = AGENDA_SECTIONS_FALLBACK

export const COMMISSION_LODGE_SECTIONS = AGENDA_SECTIONS_FALLBACK.filter(s => !s.isSpecial)

export const AGENDA_SECTION_ORDER = AGENDA_SECTIONS_FALLBACK.map(s => s.value)

export function agendaSectionLabel(value) {
  return AGENDA_SECTIONS_FALLBACK.find(s => s.value === value)?.label ?? value
}

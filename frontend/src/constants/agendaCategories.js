/**
 * Commission meeting agenda sections — mirrors backend AgendaCategory.
 * Used by secretariat agenda builder and ministry "Submit for Commission".
 */
export const AGENDA_SECTIONS = [
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

/** Sections ministries may select when lodging a paper submission with PSC. */
export const COMMISSION_LODGE_SECTIONS = AGENDA_SECTIONS.filter(s => !s.isSpecial)

export const AGENDA_SECTION_ORDER = AGENDA_SECTIONS.map(s => s.value)

export function agendaSectionLabel(value) {
  return AGENDA_SECTIONS.find(s => s.value === value)?.label ?? value
}

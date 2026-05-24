/** Shared agenda category order (PSC template). */

export const AGENDA_CATEGORIES = [
  { value: 'preliminaries', label: '1. Preliminaries & Endorsements' },
  { value: 'matters_arising', label: '2. Matters Arising' },
  { value: 'discipline_compliance', label: '3. Discipline / Compliance' },
  { value: 'health_commission', label: '4. Health Commission' },
  { value: 'appointment', label: '5. Appointment / Acting Appointment' },
  { value: 'direct_appointment', label: '6. Direct Appointment / Confirmation' },
  { value: 'extra_responsibility', label: '7. Extra Responsibility / Allowances' },
  { value: 'contract', label: '8. Contract / Temporary Salaried' },
  { value: 'temporary_salaried', label: '9. Temporary Salaried' },
  { value: 'salary_adjustment', label: '10. Salary Adjustment' },
  { value: 'training', label: '11. Training / Scholarship' },
  { value: 'medical_claim', label: '12. Medical Claim' },
  { value: 'partial_severance', label: '13. Partial Severance' },
  { value: 'resignation', label: '14. Resignation / Retirement / Death' },
  { value: 'other', label: '15. Other Matters' },
]

export const CATEGORY_ORDER = AGENDA_CATEGORIES.map((c) => c.value)

export function categoryLabel(value) {
  return AGENDA_CATEGORIES.find((c) => c.value === value)?.label ?? value
}

function groupByCategory(items) {
  const map = {}
  for (const item of items) {
    const cat = item.category || 'other'
    if (!map[cat]) map[cat] = []
    map[cat].push(item)
  }
  for (const cat of Object.keys(map)) {
    map[cat].sort((a, b) => a.sequence - b.sequence || a.id - b.id)
  }
  return map
}

/**
 * Flat list of selectable agenda rows for Sitting Pack (excludes empty categories).
 */
export function buildSittingPackRows(items) {
  const grouped = groupByCategory(items)
  const rows = []
  let agendaNo = 3

  for (const cat of CATEGORY_ORDER) {
    if (cat === 'preliminaries') continue
    const catItems = grouped[cat] || []
    if (catItems.length === 0) continue

    rows.push({ type: 'heading', id: `h-${cat}`, category: cat, label: categoryLabel(cat) })

    if (cat === 'matters_arising') {
      catItems.forEach((item, idx) => {
        const letter = String.fromCharCode(97 + (idx % 26))
        rows.push({
          type: 'item',
          id: item.id,
          item,
          displayNo: letter,
          category: cat,
        })
      })
    } else {
      catItems.forEach((item) => {
        rows.push({
          type: 'item',
          id: item.id,
          item,
          displayNo: String(agendaNo++),
          category: cat,
        })
      })
    }
  }

  return rows
}

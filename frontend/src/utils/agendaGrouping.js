import { AGENDA_SECTIONS_FALLBACK } from '../constants/agendaCategories'

/** @deprecated prefer useAgendaSections — fallback list for sitting pack when no order passed */
export const AGENDA_CATEGORIES = AGENDA_SECTIONS_FALLBACK.map(s => ({
  value: s.value,
  label: s.label,
}))

export const CATEGORY_ORDER = AGENDA_SECTIONS_FALLBACK.map((c) => c.value)

export function categoryLabel(value, sections = AGENDA_SECTIONS_FALLBACK) {
  return sections.find((c) => c.value === value)?.label ?? value
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
export function buildSittingPackRows(
  items,
  categoryOrder = CATEGORY_ORDER,
  sections = AGENDA_SECTIONS_FALLBACK,
) {
  const grouped = groupByCategory(items)
  const rows = []
  let agendaNo = 3
  const labelFor = (value) => categoryLabel(value, sections)

  for (const cat of categoryOrder) {
    if (cat === 'preliminaries') continue
    const catItems = grouped[cat] || []
    if (catItems.length === 0) continue

    rows.push({ type: 'heading', id: `h-${cat}`, category: cat, label: labelFor(cat) })

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

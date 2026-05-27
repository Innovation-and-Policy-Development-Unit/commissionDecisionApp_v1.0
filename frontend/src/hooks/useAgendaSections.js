import { useCallback, useEffect, useState } from 'react'
import api from '../api/client'
import { AGENDA_SECTIONS_FALLBACK } from '../constants/agendaCategories'

let cachedSections = null
let fetchPromise = null

export function invalidateAgendaSectionsCache() {
  cachedSections = null
  fetchPromise = null
}

function mapApiRows(rows) {
  return rows.map(s => ({
    id: s.id,
    value: s.code,
    label: s.label,
    isSpecial: s.is_special,
    is_active: s.is_active,
    display_order: s.display_order,
    digitizedFormId: s.digitized_form ?? null,
    digitizedFormCode: s.digitized_form_code ?? null,
    digitizedFormName: s.digitized_form_name ?? null,
  }))
}

async function fetchAgendaSections(params = {}) {
  if (!fetchPromise) {
    fetchPromise = api
      .get('/agenda-sections/', { params: { active_only: '1', ...params } })
      .then(res => {
        const rows = res.data.results ?? res.data
        if (!Array.isArray(rows) || rows.length === 0) {
          cachedSections = AGENDA_SECTIONS_FALLBACK
        } else {
          cachedSections = mapApiRows(rows)
        }
        return cachedSections
      })
      .catch(() => {
        cachedSections = AGENDA_SECTIONS_FALLBACK
        return cachedSections
      })
  }
  return fetchPromise
}

/**
 * Load agenda sections from API (cached). Falls back to built-in list if API unavailable.
 */
export function useAgendaSections({ lodgeOnly = false, includeInactive = false } = {}) {
  const [sections, setSections] = useState(cachedSections || AGENDA_SECTIONS_FALLBACK)
  const [loading, setLoading] = useState(!cachedSections)

  const reload = useCallback(async () => {
    invalidateAgendaSectionsCache()
    setLoading(true)
    const params = includeInactive ? {} : { active_only: '1' }
    const data = await fetchAgendaSections(params)
    setSections(data)
    setLoading(false)
    return data
  }, [includeInactive])

  useEffect(() => {
    let cancelled = false
    const params = includeInactive ? {} : { active_only: '1' }
    fetchAgendaSections(params).then(data => {
      if (!cancelled) {
        setSections(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [includeInactive])

  const all = sections
  const filtered = lodgeOnly ? all.filter(s => !s.isSpecial) : all
  const categoryOrder = filtered.map(s => s.value)

  const agendaSectionLabel = useCallback(
    value => all.find(s => s.value === value)?.label ?? value,
    [all],
  )

  return {
    sections: filtered,
    allSections: all,
    categoryOrder,
    agendaSectionLabel,
    loading,
    reload,
  }
}

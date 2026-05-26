/** Normalize DRF list responses (array or { results: [] }) to a safe array. */
export function normalizeListPayload(data) {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.results)) return data.results
  return []
}

/** Read a named array field from an API object (e.g. events, entries, officers). */
export function normalizeFieldPayload(data, field) {
  if (!data || typeof data !== 'object') return []
  const value = data[field]
  return Array.isArray(value) ? value : []
}

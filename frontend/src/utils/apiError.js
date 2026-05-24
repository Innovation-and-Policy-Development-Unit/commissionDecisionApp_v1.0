/**
 * Turn an axios error into a short user-facing message.
 */
export function formatApiError(err, fallback = 'Request failed.') {
  const status = err?.response?.status
  const data = err?.response?.data

  if (!err?.response) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  if (status === 404) {
    return 'Submission not found or you do not have permission to view it.'
  }
  if (status === 403) {
    if (typeof data?.detail === 'string') return data.detail
    return 'You do not have permission to view this submission.'
  }
  if (status === 401) {
    return 'Your session has expired. Please sign in again.'
  }
  if (status >= 500) {
    return 'Server error while loading. Try again in a moment.'
  }
  if (typeof data?.detail === 'string') return data.detail
  if (Array.isArray(data?.detail)) return data.detail.join(' ')
  if (data && typeof data === 'object') {
    const parts = Object.entries(data).map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${v.join(', ')}`
      return `${k}: ${v}`
    })
    if (parts.length) return parts.join('; ')
  }
  return fallback
}

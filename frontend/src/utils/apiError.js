function extractDetail(data) {
  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
    const msg = data.non_field_errors.join(' ')
    if (/unique set/i.test(msg)) {
      return 'This code already exists under the selected ministry. Edit the existing record or choose a different code.'
    }
    return msg
  }
  if (typeof data?.detail === 'string') return data.detail
  if (Array.isArray(data?.detail)) {
    const first = data.detail[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object') {
      return first.message || first.detail || String(first)
    }
  }
  if (typeof data?.message === 'string') return data.message
  return ''
}

function isAuthTokenError(detail) {
  if (!detail) return false
  const lower = detail.toLowerCase()
  return (
    lower.includes('token not valid')
    || lower.includes('token is invalid')
    || lower.includes('token has expired')
    || lower.includes('given token')
    || lower.includes('authentication credentials')
  )
}

/**
 * Turn an axios error into a short user-facing message.
 */
export function formatApiError(err, fallback = 'Request failed.') {
  const status = err?.response?.status
  const data = err?.response?.data
  const detail = extractDetail(data)

  if (!err?.response) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  if (status === 404) {
    return 'Submission not found or you do not have permission to view it.'
  }
  if (status === 401 || isAuthTokenError(detail)) {
    return 'Your session has expired. Please sign in again.'
  }
  if (status === 403) {
    if (detail && !isAuthTokenError(detail)) return detail
    return 'You do not have permission to view this submission.'
  }
  if (status >= 500) {
    return 'Server error while loading. Try again in a moment.'
  }
  if (detail) return detail
  if (data && typeof data === 'object') {
    const parts = Object.entries(data).map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${v.join(', ')}`
      return `${k}: ${v}`
    })
    if (parts.length) return parts.join('; ')
  }
  return fallback
}

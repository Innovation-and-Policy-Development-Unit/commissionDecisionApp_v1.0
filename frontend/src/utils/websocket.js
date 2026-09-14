/** Builds a ws(s):// URL for a given API path, deriving the host from the
 * same VITE_API_BASE_URL env var (or the current page) that the REST client
 * uses, so dev/staging/prod all resolve to the right backend automatically. */
export function buildWsUrl(path, token) {
  const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'
  let wsBase
  if (/^https?:\/\//.test(apiBase)) {
    wsBase = apiBase.replace(/^http/, 'ws').replace(/\/api\/?$/, '')
  } else {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    wsBase = `${proto}//${window.location.host}`
  }
  return `${wsBase}${path}?token=${encodeURIComponent(token)}`
}

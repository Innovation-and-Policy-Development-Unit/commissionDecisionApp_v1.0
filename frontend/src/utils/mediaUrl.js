/**
 * Resolve profile/media URLs for split deployments (static SPA + API on Render).
 * Backend should return absolute URLs when CDP_BASE_URL is set; this is a client fallback.
 */
export function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return url

  const apiBase = import.meta.env.VITE_API_BASE_URL || ''
  const sameOriginApi = !apiBase || apiBase.startsWith('/')

  // Docker/single-host: API may return http://backend:8000 or :8000/media — browser uses nginx :8080
  if (/^https?:\/\//i.test(url) && sameOriginApi && url.includes('/media/')) {
    try {
      return new URL(url).pathname
    } catch {
      /* keep original */
    }
  }

  if (/^https?:\/\//i.test(url)) return url

  if (url.startsWith('/') && /^https?:\/\//i.test(apiBase)) {
    try {
      const origin = new URL(apiBase).origin
      return `${origin}${url}`
    } catch {
      return url
    }
  }

  return url
}

export function normalizeUserMedia(user) {
  if (!user) return user
  return {
    ...user,
    profile_picture: resolveMediaUrl(user.profile_picture),
    signature: resolveMediaUrl(user.signature),
  }
}

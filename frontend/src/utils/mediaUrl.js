/**
 * Resolve profile/media URLs for split deployments (static SPA + API on Render).
 * Backend should return absolute URLs when CDP_BASE_URL is set; this is a client fallback.
 */
export function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return url
  if (/^https?:\/\//i.test(url)) return url

  const apiBase = import.meta.env.VITE_API_BASE_URL || ''
  if (!url.startsWith('/') || !/^https?:\/\//i.test(apiBase)) {
    return url
  }

  try {
    const origin = new URL(apiBase).origin
    return `${origin}${url}`
  } catch {
    return url
  }
}

export function normalizeUserMedia(user) {
  if (!user) return user
  return {
    ...user,
    profile_picture: resolveMediaUrl(user.profile_picture),
    signature: resolveMediaUrl(user.signature),
  }
}

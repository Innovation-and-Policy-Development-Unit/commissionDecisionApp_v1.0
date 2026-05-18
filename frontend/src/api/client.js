import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('psc_access')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * Drop stored JWTs on 401 from the API, except for failed username/password (POST /auth/token/).
 * Lets RequireAuth redirect when the session is invalid or expired.
 */
api.interceptors.response.use(
  res => {
    // Normalize DRF paginated list responses: {count, next, previous, results} → unwrap results
    if (
      res.data &&
      !Array.isArray(res.data) &&
      Array.isArray(res.data.results) &&
      typeof res.data.count === 'number'
    ) {
      // Clone the response with data replaced by the results array
      return { ...res, data: res.data.results }
    }
    return res
  },
  err => {
    const status = err.response?.status
    const method = (err.config?.method ?? '').toLowerCase()
    const base = String(err.config?.baseURL ?? '')
    const pathname = `${base}${String(err.config?.url ?? '')}`.split('?')[0].replace(/\/{2,}/g, '/')
    /** POST /api/auth/token/ (wrong credentials) — do not purge stored session */
    const isObtainPair =
      method === 'post' &&
      /\/auth\/token\/?$/.test(pathname.replace(/\/+$/, '')) &&
      !pathname.includes('/auth/token/refresh')

    if (status === 401 && !isObtainPair) {
      localStorage.removeItem('psc_access')
      localStorage.removeItem('psc_refresh')
      window.dispatchEvent(new CustomEvent('psc-auth:cleared'))
    }
    return Promise.reject(err)
  }
)

export default api

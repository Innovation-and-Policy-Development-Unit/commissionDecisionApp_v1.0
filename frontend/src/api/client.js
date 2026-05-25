import axios from 'axios'

/** Same-origin /api in Docker; full URL on Render static site (VITE_API_BASE_URL). */
const apiBaseURL = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
})

/** Plain axios instance for refresh (avoids interceptor recursion). */
const refreshClient = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
})

let isRefreshing = false
let refreshWaitQueue = []

function clearStoredTokens() {
  localStorage.removeItem('psc_access')
  localStorage.removeItem('psc_refresh')
  window.dispatchEvent(new CustomEvent('psc-auth:cleared'))
}

function storeTokens(access, refresh) {
  localStorage.setItem('psc_access', access)
  if (refresh) {
    localStorage.setItem('psc_refresh', refresh)
  }
  window.dispatchEvent(new CustomEvent('psc-auth:refreshed', { detail: { access, refresh } }))
}

function processRefreshQueue(error, access = null) {
  refreshWaitQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(access)
  })
  refreshWaitQueue = []
}

function requestPath(config) {
  const base = String(config?.baseURL ?? '')
  return `${base}${String(config?.url ?? '')}`.split('?')[0].replace(/\/{2,}/g, '/')
}

function isObtainPairRequest(config) {
  const method = (config?.method ?? '').toLowerCase()
  const pathname = requestPath(config).replace(/\/+$/, '')
  return method === 'post' && /\/auth\/token\/?$/.test(pathname) && !pathname.includes('/auth/token/refresh')
}

function isRefreshRequest(config) {
  return requestPath(config).includes('/auth/token/refresh')
}

async function refreshAccessToken() {
  const refresh = localStorage.getItem('psc_refresh')
  if (!refresh) {
    throw new Error('No refresh token')
  }
  const { data } = await refreshClient.post('/auth/token/refresh/', { refresh })
  const access = data?.access
  if (!access) {
    throw new Error('Refresh response missing access token')
  }
  storeTokens(access, data.refresh)
  return access
}

api.interceptors.request.use(config => {
  const token = localStorage.getItem('psc_access')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  res => {
    if (
      res.data &&
      !Array.isArray(res.data) &&
      Array.isArray(res.data.results) &&
      typeof res.data.count === 'number'
    ) {
      return { ...res, data: res.data.results }
    }
    return res
  },
  async err => {
    const originalRequest = err.config
    const status = err.response?.status

    if (
      originalRequest &&
      status === 401 &&
      !originalRequest._retry &&
      !isObtainPairRequest(originalRequest) &&
      !isRefreshRequest(originalRequest)
    ) {
      if (isRefreshing) {
        try {
          const access = await new Promise((resolve, reject) => {
            refreshWaitQueue.push({ resolve, reject })
          })
          originalRequest.headers.Authorization = `Bearer ${access}`
          return api(originalRequest)
        } catch (queueErr) {
          return Promise.reject(queueErr)
        }
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const access = await refreshAccessToken()
        processRefreshQueue(null, access)
        originalRequest.headers.Authorization = `Bearer ${access}`
        return api(originalRequest)
      } catch (refreshErr) {
        processRefreshQueue(refreshErr, null)
        clearStoredTokens()
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    if (status === 401 && !isObtainPairRequest(originalRequest)) {
      clearStoredTokens()
    }

    return Promise.reject(err)
  }
)

export default api

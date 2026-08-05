import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import api from '../api/client'
import { normalizeUserMedia } from '../utils/mediaUrl'
import { getInactivityLockMs, INACTIVITY_LOCK_SETTINGS_EVENT } from '../utils/inactivityLock'

const AuthContext = createContext(null)

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click']

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('psc_access'))
  const [user, setUser] = useState(null)
  /** False while validating an existing stored token against /me/ */
  const [authReady, setAuthReady] = useState(() => !localStorage.getItem('psc_access'))
  const [isLocked, setIsLocked] = useState(false)
  const [pin, setPin] = useState('')

  const inactivityTimer = useRef(null)

  // Detect lock state on mount (e.g. after page refresh while locked)
  useEffect(() => {
    const lockUser = sessionStorage.getItem('psc-lock-username')
    if (lockUser) {
      setIsLocked(true)
      setPin('')
    }
  }, [])

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async (reason = 'manual') => {
    const refresh = localStorage.getItem('psc_refresh')
    if (refresh) {
      try { await api.post('/auth/logout/', { refresh }) } catch { }
    }
    localStorage.removeItem('psc_access')
    localStorage.removeItem('psc_refresh')
    setAccessToken(null)
    setUser(null)
    setAuthReady(true)

    setIsLocked(false)
    setPin('')
    sessionStorage.removeItem('psc-lock-username')
  }, [])

  const lock = useCallback(() => {
    const uname = user?.username
    if (uname) {
      sessionStorage.setItem('psc-lock-username', uname)
    }
    setIsLocked(true)
    setPin('')
    window.dispatchEvent(new CustomEvent('psc-auth:locked'))
  }, [user])

  const unlock = useCallback(async (pinCode) => {
    const stored = sessionStorage.getItem('psc-lock-username')
    if (!stored) {
      setIsLocked(false)
      return { ok: false, detail: 'Session expired. Please sign in again.' }
    }
    try {
      const { data } = await api.post('/auth/session-pin/verify/', { username: stored, pin: pinCode })
      setAccessToken(data.access)
      localStorage.setItem('psc_access', data.access)
      localStorage.setItem('psc_refresh', data.refresh)
      setIsLocked(false)
      setPin('')
      try {
        const me = await api.get('/me/')
        setUser(normalizeUserMedia(me.data))
      } catch {
        setUser(null)
      }
      setAuthReady(true)
      sessionStorage.removeItem('psc-lock-username')
      return { ok: true }
    } catch (err) {
      return { ok: false, detail: err.response?.data?.detail || 'Invalid PIN.' }
    }
  }, [])

  // ── Inactivity timer → lock (PIN re-entry) if the user has a PIN set,
  // otherwise fall back to a full logout (a user with no PIN has no way to
  // unlock, so locking them would be a dead end).
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    if (!user || isLocked) return

    const ms = getInactivityLockMs(user.username)
    if (!ms) return

    inactivityTimer.current = setTimeout(async () => {
      // Re-check with the server rather than trusting the closure's `user`
      // snapshot, which can be stale by now (e.g. captured before the PIN
      // was set up, or before a silent token refresh landed) — that
      // staleness previously caused a full logout even for accounts with a
      // PIN configured, instead of the intended lock screen.
      let pinSet = user.session_pin_set
      try {
        const { data } = await api.get('/me/')
        pinSet = Boolean(data?.session_pin_set)
      } catch {
        // Network hiccup — fall back to the last-known value rather than
        // guessing the account has no PIN.
      }
      if (pinSet) {
        lock()
        return
      }
      try {
        await logout('inactivity')
      } finally {
        // Hard redirect → reloads the app and shows a fresh login screen,
        // clearing all in-memory state regardless of the current route.
        window.location.assign('/auth/login')
      }
    }, ms)
  }, [user, isLocked, logout, lock])

  // Attach/remove activity listeners when the user is logged in
  useEffect(() => {
    if (!user || isLocked) {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
      return
    }
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }))
    resetInactivityTimer()

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetInactivityTimer))
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    }
  }, [user, isLocked, resetInactivityTimer])

  useEffect(() => {
    const onSettingsChanged = () => resetInactivityTimer()
    window.addEventListener(INACTIVITY_LOCK_SETTINGS_EVENT, onSettingsChanged)
    return () => window.removeEventListener(INACTIVITY_LOCK_SETTINGS_EVENT, onSettingsChanged)
  }, [resetInactivityTimer])

  // ── /me/ refresh ──────────────────────────────────────────────────────────
  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem('psc_access')
    if (!token) {
      setUser(null)
      setAuthReady(true)
      return null
    }
    setAuthReady(false)
    try {
      const { data } = await api.get('/me/')
      const normalized = normalizeUserMedia(data)
      setUser(normalized)
      return normalized
    } catch {
      /* Any /me/ failure means no usable session — clear tokens so dashboard stays gated. */
      setUser(null)
      localStorage.removeItem('psc_access')
      localStorage.removeItem('psc_refresh')
      setAccessToken(null)
      return null
    } finally {
      setAuthReady(true)
    }
  }, [])

  // Hydrate session on mount when a JWT is already in storage (page refresh).
  useEffect(() => {
    const token = localStorage.getItem('psc_access')
    if (!token) {
      setUser(null)
      setAuthReady(true)
      return
    }
    setAccessToken(token)
    refreshMe()
  }, [refreshMe])

  // Listen for cross-tab clear / silent token refresh
  useEffect(() => {
    const onCleared = () => {
      setAccessToken(null)
      setUser(null)
      setAuthReady(true)
      setIsLocked(false)
      setPin('')
    }
    const onRefreshed = (e) => {
      const access = e.detail?.access
      if (access) {
        setAccessToken(access)
        refreshMe()
      }
    }
    window.addEventListener('psc-auth:cleared', onCleared)
    window.addEventListener('psc-auth:refreshed', onRefreshed)
    return () => {
      window.removeEventListener('psc-auth:cleared', onCleared)
      window.removeEventListener('psc-auth:refreshed', onRefreshed)
    }
  }, [refreshMe])

  // ── Login ─────────────────────────────────────────────────────────────────
  const setTokens = useCallback((access, refresh) => {
    localStorage.setItem('psc_access', access)
    localStorage.setItem('psc_refresh', refresh)
    setAccessToken(access)
  }, [])

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/token/', { username, password })

    if (data.two_factor_required || data.pin_required || data.must_change_password) {
      return data  // Let the UI handle 2FA, PIN, or forced password-change step
    }

    setTokens(data.access, data.refresh)
    const me = await refreshMe()
    return { ...data, must_change_password: Boolean(me?.must_change_password) }
  }, [setTokens, refreshMe])

  const value = useMemo(
    () => ({
      accessToken,
      user,
      authReady,
      login,
      logout,
      lock,
      unlock,
      isLocked,
      setPin,
      refreshMe,
      setTokens,
    }),
    [accessToken, user, authReady, login, logout, lock, unlock, isLocked, setPin, refreshMe, setTokens],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import api from '../api/client'
import { FACTORY, LEGACY_PRESET } from './appearancePresets'
const ThemeContext = createContext(null)

const APPEARANCE_KEY = 'scdms-appearance'

// What was last known from the server, kept so the page paints in the right look before it answers.
function readStored() {
  try {
    const saved = JSON.parse(localStorage.getItem(APPEARANCE_KEY) || 'null')
    if (saved && typeof saved === 'object') return { org: saved.org || {}, user: saved.user || {} }
  } catch { /* private mode or bad JSON */ }
  // Before the Appearance panel existed: a light/dark choice and a colour preset in the browser.
  const legacyMode = localStorage.getItem('liner-theme') === 'dark' || localStorage.getItem('liner-theme') === 'dim'
    || localStorage.getItem('liner-dark') === 'true' ? 'dark' : null
  const legacyPreset = LEGACY_PRESET[localStorage.getItem('liner-color-preset')]
  return { org: {}, user: { ...(legacyMode ? { mode: legacyMode } : {}), ...(legacyPreset ? { preset: legacyPreset } : {}) } }
}

const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

export function ThemeProvider({ children }) {
  const [stored, setStored] = useState(readStored)
  const [canSetOrg, setCanSetOrg] = useState(false)
  const [osDark, setOsDark] = useState(systemDark)
  // Organisation default, then the user's own choices on top.
  const appearance = useMemo(() => ({ ...FACTORY, ...stored.org, ...stored.user }), [stored])
  const theme = appearance.mode === 'system' ? (osDark ? 'dark' : 'light') : appearance.mode
  const colorPreset = LEGACY_PRESET[appearance.preset] || appearance.preset

  const [isRTL, setIsRTL] = useState(() => {
    const saved = localStorage.getItem('liner-rtl')
    return saved ? JSON.parse(saved) : false
  })

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('liner-sidebar-collapsed')
    return saved ? JSON.parse(saved) : false
  })

  const [isHorizontal, setIsHorizontal] = useState(() => {
    const saved = localStorage.getItem('liner-horizontal')
    return saved ? JSON.parse(saved) : false
  })

  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false)
  const [feedbackEnabled, setFeedbackEnabled] = useState(true)

  const fetchFeedbackStatus = async () => {
    try {
      const { data } = await api.get('/auth/feedback-status/')
      setFeedbackEnabled(data.enabled !== false)
    } catch {
      setFeedbackEnabled(true)
    }
  }

  useEffect(() => {
    fetchFeedbackStatus()
  }, [])

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return undefined
    const on = (e) => setOsDark(e.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])

  // Apply theme — dark adds .dark class, light removes it.
  useEffect(() => {
    const html = document.documentElement
    if (theme === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
    html.classList.remove('dim') // clean up legacy dim class
    localStorage.setItem('liner-theme', theme)
  }, [theme])

  // Density, corners, font and font size are attributes on <html>; index.css does the rest.
  useEffect(() => {
    const html = document.documentElement
    html.setAttribute('data-density', appearance.density)
    html.setAttribute('data-corners', appearance.corners)
    html.setAttribute('data-font', appearance.font)
    html.setAttribute('data-font-size', appearance.fontSize)
    try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(stored)) } catch { /* private mode */ }
  }, [appearance, stored])

  // Apply RTL
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
    localStorage.setItem('liner-rtl', JSON.stringify(isRTL))
  }, [isRTL])

  // Apply color preset
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorPreset)
  }, [colorPreset])

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('liner-sidebar-collapsed', JSON.stringify(sidebarCollapsed))
  }, [sidebarCollapsed])

  // Persist horizontal state
  useEffect(() => {
    localStorage.setItem('liner-horizontal', JSON.stringify(isHorizontal))
  }, [isHorizontal])

  // Appearance choices are saved to the account (and, for administrators, the organisation default).
  const applyServer = useCallback((data) => {
    setStored({ org: data.org || {}, user: data.user || {} })
    setCanSetOrg(!!data.can_set_org)
  }, [])

  // Called once someone is signed in: fetch their choices and the organisation default.
  const loadAppearance = useCallback(async () => {
    try {
      const { data } = await api.get('/appearance/')
      applyServer(data)
    } catch { /* keep what the browser remembers */ }
  }, [applyServer])

  const saveUser = useCallback(async (next) => {
    setStored((prev) => ({ ...prev, user: next })) // instant; the server answer corrects it
    try {
      const { data } = await api.put('/appearance/me/', next)
      applyServer(data)
    } catch { /* stays on this device until the next save succeeds */ }
  }, [applyServer])

  const saveOrg = useCallback(async (next) => {
    setStored((prev) => ({ ...prev, org: next }))
    try {
      const { data } = await api.put('/appearance/org/', next)
      applyServer(data)
    } catch { loadAppearance() }
  }, [applyServer, loadAppearance])

  // scope 'me' edits the user's own choices; 'org' edits the organisation default.
  const setAppearance = useCallback((patch, scope = 'me') => {
    if (scope === 'org') saveOrg({ ...stored.org, ...patch })
    else saveUser({ ...stored.user, ...patch })
  }, [stored, saveUser, saveOrg])
  const resetAppearance = useCallback(() => saveUser({}), [saveUser])

  const setTheme = (value) => setAppearance({ mode: value === 'dim' ? 'dark' : value })
  const cycleTheme = () => setAppearance({ mode: theme === 'light' ? 'dark' : 'light' })
  const isDark = theme === 'dark'
  const toggleDark = () => setAppearance({ mode: theme === 'dark' ? 'light' : 'dark' })
  const setColorPreset = (id) => setAppearance({ preset: LEGACY_PRESET[id] || id })

  const toggleRTL = () => setIsRTL(prev => !prev)
  const toggleSidebar = () => setSidebarCollapsed(prev => !prev)
  const toggleHorizontal = () => setIsHorizontal(prev => !prev)
  const openSettingsPanel = () => setSettingsPanelOpen(true)
  const closeSettingsPanel = () => setSettingsPanelOpen(false)
  const openFeedbackPanel = () => setFeedbackPanelOpen(true)
  const closeFeedbackPanel = () => setFeedbackPanelOpen(false)
  const toggleFeedbackPanel = () => setFeedbackPanelOpen(prev => !prev)

  return (
    <ThemeContext.Provider value={{
      theme,
      isDark,
      isRTL,
      sidebarCollapsed,
      isHorizontal,
      colorPreset,
      appearance,
      userChoices: stored.user,
      orgDefault: { ...FACTORY, ...stored.org },
      canSetOrg,
      setAppearance,
      resetAppearance,
      loadAppearance,
      settingsPanelOpen,
      feedbackPanelOpen,
      setTheme,
      cycleTheme,
      toggleDark,
      toggleRTL,
      toggleSidebar,
      toggleHorizontal,
      setColorPreset,
      openSettingsPanel,
      closeSettingsPanel,
      openFeedbackPanel,
      closeFeedbackPanel,
      toggleFeedbackPanel,
      feedbackEnabled,
      refreshFeedbackStatus: fetchFeedbackStatus,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

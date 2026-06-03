import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/client'
const ThemeContext = createContext(null)

// Two modes only: light and dark.
function readTheme() {
  const saved = localStorage.getItem('liner-theme')
  if (saved === 'dark') return 'dark'
  // Migrate from legacy keys (dim → dark, boolean → dark)
  if (saved === 'dim') return 'dark'
  const legacy = localStorage.getItem('liner-dark')
  if (legacy === 'true') return 'dark'
  return 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readTheme)

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

  const [colorPreset, setColorPreset] = useState(() => {
    return localStorage.getItem('liner-color-preset') || 'navy'
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

  // Apply RTL
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
    localStorage.setItem('liner-rtl', JSON.stringify(isRTL))
  }, [isRTL])

  // Apply color preset
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorPreset)
    localStorage.setItem('liner-color-preset', colorPreset)
  }, [colorPreset])

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('liner-sidebar-collapsed', JSON.stringify(sidebarCollapsed))
  }, [sidebarCollapsed])

  // Persist horizontal state
  useEffect(() => {
    localStorage.setItem('liner-horizontal', JSON.stringify(isHorizontal))
  }, [isHorizontal])

  const setTheme = (value) => setThemeState(value === 'dim' ? 'dark' : value)
  const cycleTheme = () => setThemeState(prev => prev === 'light' ? 'dark' : 'light')
  const isDark = theme === 'dark'
  const toggleDark = () => setThemeState(prev => prev === 'dark' ? 'light' : 'dark')

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

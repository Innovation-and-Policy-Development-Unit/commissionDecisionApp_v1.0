import { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import Header from './Header'
import HorizontalMenu from './HorizontalMenu'
import SettingsPanel from './SettingsPanel'
import SecurityNoticesBanner from '../shared/SecurityNoticesBanner'
import FeedbackPanel from '../shared/FeedbackPanel'
import StaffChatPanel from '../assistant/StaffChatPanel'
import StaffChatFab from '../assistant/StaffChatFab'
import LockOverlay from '../auth/LockOverlay'
import KeyboardShortcutsModal from '../shared/KeyboardShortcutsModal'
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts'
import { Bot, MessageSquare } from 'lucide-react'
import clsx from 'clsx'

export default function Layout() {
  const { t } = useTranslation()
  const {
    sidebarCollapsed,
    isHorizontal,
    toggleSidebar,
    feedbackPanelOpen,
    closeFeedbackPanel,
    toggleFeedbackPanel,
    feedbackEnabled
  } = useTheme()
  const { isLocked } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [staffChatOpen, setStaffChatOpen] = useState(false)
  const [assistantMenuOpen, setAssistantMenuOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const assistantMenuRef = useRef(null)

  useGlobalShortcuts({
    navigate,
    onToggleShortcuts: () => setShortcutsOpen(o => !o),
  })

  useEffect(() => {
    const onOpen = () => setShortcutsOpen(o => !o)
    document.addEventListener('psc:shortcuts:open', onOpen)
    return () => document.removeEventListener('psc:shortcuts:open', onOpen)
  }, [])

  useEffect(() => {
    if (!assistantMenuOpen) return
    const onDocClick = (event) => {
      if (assistantMenuRef.current && !assistantMenuRef.current.contains(event.target)) {
        setAssistantMenuOpen(false)
      }
    }
    const onEsc = (event) => {
      if (event.key === 'Escape') setAssistantMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [assistantMenuOpen])

  const onAssistantPage = location.pathname === '/assistant'
  const hideStaffChatFab = onAssistantPage

  const handleMenuClick = () => {
    if (window.innerWidth < 1024) {
      setMobileMenuOpen(o => !o)
    } else if (!isHorizontal) {
      toggleSidebar()
    }
  }

  const mainMargin = isHorizontal
    ? 'lg:ms-0'
    : sidebarCollapsed
      ? 'lg:ms-[5.5rem]'
      : 'lg:ms-64'

  const mainTopOffset = isHorizontal ? 'mt-16 lg:mt-28' : 'mt-16'

  // If locked, only render the LockOverlay to prevent DOM inspection bypass
  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
        <LockOverlay />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded focus:shadow-lg"
      >
        {t('accessibility.skip_to_content')}
      </a>
      {!isHorizontal && (
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
      )}
      <Header onMenuClick={handleMenuClick} />
      {isHorizontal && (
        <HorizontalMenu
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
      )}
      <main
        id="main-content"
        role="main"
        aria-label={t('accessibility.main_content')}
        className={clsx('min-h-screen transition-all duration-300', mainMargin, mainTopOffset)}
      >
        <SecurityNoticesBanner />
        <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto">
          <Outlet />
        </div>
      </main>
      <SettingsPanel />

      {/* Feedback Slide-in Panel */}
      {feedbackEnabled && (
        <FeedbackPanel open={feedbackPanelOpen} onClose={closeFeedbackPanel} />
      )}

      <StaffChatPanel
        open={staffChatOpen}
        onClose={() => setStaffChatOpen(false)}
      />
      {!hideStaffChatFab && (
        <div ref={assistantMenuRef}>
          {assistantMenuOpen && (
            <div className="fixed bottom-24 right-6 z-[78] w-72 card p-2 shadow-card-lg animate-fade-in">
              <button
                type="button"
                onClick={() => {
                  setAssistantMenuOpen(false)
                  setStaffChatOpen(true)
                }}
                className="w-full flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition-colors"
              >
                <Bot size={16} className="mt-0.5 text-indigo-500" />
                <span>
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{t('staff_chat.title')}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{t('staff_chat.subtitle')}</span>
                </span>
              </button>
              {feedbackEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setAssistantMenuOpen(false)
                    if (!feedbackPanelOpen) toggleFeedbackPanel()
                  }}
                  className="w-full flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition-colors"
                >
                  <MessageSquare size={16} className="mt-0.5 text-primary-500" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{t('feedback.open')}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{t('feedback.open_panel')}</span>
                  </span>
                </button>
              )}
            </div>
          )}
          <StaffChatFab
            open={assistantMenuOpen}
            onClick={() => setAssistantMenuOpen((o) => !o)}
            hidden={false}
            label={t('staff_chat.open_fab')}
          />
        </div>
      )}

      {/* Lock Screen Overlay */}
      <LockOverlay />

      {/* Keyboard shortcuts help modal */}
      <KeyboardShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  )
}

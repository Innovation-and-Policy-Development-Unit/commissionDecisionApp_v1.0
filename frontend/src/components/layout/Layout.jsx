import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import Header from './Header'
import HorizontalMenu from './HorizontalMenu'
import SettingsPanel from './SettingsPanel'
import SecurityNoticesBanner from '../shared/SecurityNoticesBanner'
import SystemStatsStrip from '../shared/SystemStatsStrip'
import FeedbackPanel from '../shared/FeedbackPanel'
import LockOverlay from '../auth/LockOverlay'
import KeyboardShortcutsModal from '../shared/KeyboardShortcutsModal'
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts'
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
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useGlobalShortcuts({
    navigate,
    onToggleShortcuts: () => setShortcutsOpen(o => !o),
  })

  useEffect(() => {
    const onOpen = () => setShortcutsOpen(o => !o)
    document.addEventListener('psc:shortcuts:open', onOpen)
    return () => document.removeEventListener('psc:shortcuts:open', onOpen)
  }, [])

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

  const mainTopOffset = isHorizontal ? 'mt-28 lg:mt-28' : 'mt-16'

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
        <SystemStatsStrip />
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

      {/* Feedback launcher — vertical tab pinned to the right edge */}
      {feedbackEnabled && (
        <button
          type="button"
          onClick={() => { if (!feedbackPanelOpen) toggleFeedbackPanel() }}
          aria-label={t('feedback.open')}
          title={t('feedback.open')}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-[75] px-2 py-4 rounded-l-lg shadow-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold tracking-wide [writing-mode:vertical-rl] rotate-180 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
        >
          {t('feedback.tab')}
        </button>
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

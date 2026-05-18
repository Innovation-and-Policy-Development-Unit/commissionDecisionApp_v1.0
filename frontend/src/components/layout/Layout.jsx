import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import Header from './Header'
import HorizontalMenu from './HorizontalMenu'
import SettingsPanel from './SettingsPanel'
import SecurityNoticesBanner from '../shared/SecurityNoticesBanner'
import FeedbackPanel from '../shared/FeedbackPanel'
import LockOverlay from '../auth/LockOverlay'
import { MessageSquare } from 'lucide-react'
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

      {/* Floating Action Button (FAB) */}
      {feedbackEnabled && !feedbackPanelOpen && (
        <button
          type="button"
          onClick={toggleFeedbackPanel}
          aria-label={t('feedback.open_panel')}
          title={t('feedback.open')}
          className="fixed bottom-8 right-8 w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-50 group overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" aria-hidden="true" />
          <MessageSquare size={24} className="relative z-10" aria-hidden="true" />
        </button>
      )}

      {/* Lock Screen Overlay */}
      <LockOverlay />
    </div>
  )
}

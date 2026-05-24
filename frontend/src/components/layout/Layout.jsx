import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
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
import StatusChatPanel from '../assistant/StatusChatPanel'
import StatusChatFab from '../assistant/StatusChatFab'
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
  const { isLocked, user } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [staffChatOpen, setStaffChatOpen] = useState(false)
  const [statusChatOpen, setStatusChatOpen] = useState(false)

  const ministryStatusRoles = ['ministry_hr', 'dept_admin', 'head_of_agency']
  const isMinistryStatusUser = user && ministryStatusRoles.includes(user.role)
  const onAssistantPage = location.pathname === '/assistant'
  const onStatusPage = location.pathname === '/status-assistant'
  const hideStaffChatFab = onAssistantPage || isMinistryStatusUser
  const hideStatusChatFab = onStatusPage || !isMinistryStatusUser

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
      <StaffChatFab
        open={staffChatOpen}
        onClick={() => setStaffChatOpen((o) => !o)}
        hidden={hideStaffChatFab}
      />

      <StatusChatPanel
        open={statusChatOpen}
        onClose={() => setStatusChatOpen(false)}
      />
      <StatusChatFab
        open={statusChatOpen}
        onClick={() => setStatusChatOpen((o) => !o)}
        hidden={hideStatusChatFab}
      />

      {/* Floating Feedback Tab */}
      {feedbackEnabled && !feedbackPanelOpen && (
        <button
          type="button"
          onClick={toggleFeedbackPanel}
          aria-label={t('feedback.open_panel')}
          title={t('feedback.open')}
          className="fixed right-0 top-1/2 -translate-y-1/2 w-10 h-32 bg-primary-600 hover:bg-primary-700 text-white rounded-l-xl shadow-2xl flex flex-col items-center justify-center transition-all hover:w-12 z-50 group overflow-hidden focus:outline-none"
        >
          <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-300" aria-hidden="true" />
          <div className="relative z-10 flex flex-col items-center gap-3">
            <MessageSquare size={20} aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
              Feedback
            </span>
          </div>
        </button>
      )}

      {/* Lock Screen Overlay */}
      <LockOverlay />
    </div>
  )
}

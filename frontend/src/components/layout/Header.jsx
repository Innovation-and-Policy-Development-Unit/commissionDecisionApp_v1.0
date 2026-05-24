import { useState, useRef, useEffect, useCallback, useMemo, Fragment, memo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import clsx from 'clsx'
import {
  Menu, Search, Bell, Settings, Sun, SunDim, Moon, ChevronDown,
  User, LogOut, Lock, CreditCard, HelpCircle, Shield, X,
  CheckCircle2, AlertCircle, Info, ChevronRight, MessageSquare,
  Plus, LayoutDashboard, FileText, Gavel, Headphones, BarChart3,
  Bot, CalendarDays, ListTodo, Zap, Keyboard,
} from 'lucide-react'
import BrandLogo from '../shared/BrandLogo'
import LanguageSwitcher from '../shared/LanguageSwitcher'
import LiveRegion from '../shared/LiveRegion'
import DesktopNotificationSettings from '../notifications/DesktopNotificationSettings'
import { useNotifications } from '../../hooks/useNotifications'

// ── Quick actions shown before / alongside search results ──────────────────
const ALL_QUICK_ACTIONS = [
  {
    id: 'new-submission',
    label: 'New Submission',
    sublabel: 'Create a new PSC submission',
    icon: Plus,
    path: '/submissions/new',
    kbd: 'N',
    roles: ['ministry_hr', 'dept_admin', 'head_of_agency', 'psc_officer', 'psc_admin', 'psc_secretary', 'senior_admin_officer', 'hr_unit_manager', 'vipam_manager', 'odu_manager'],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    sublabel: 'Return to your dashboard',
    icon: LayoutDashboard,
    path: '/',
    kbd: 'G D',
    roles: null,
  },
  {
    id: 'submissions',
    label: 'Submissions',
    sublabel: 'View all submissions',
    icon: FileText,
    path: '/submissions',
    kbd: 'G S',
    roles: null,
  },
  {
    id: 'assistant',
    label: 'Staff Assistant',
    sublabel: 'AI-powered PSC assistant',
    icon: Bot,
    path: '/assistant',
    kbd: 'G A',
    roles: null,
  },
  {
    id: 'reports',
    label: 'Reports',
    sublabel: 'Analytics and export',
    icon: BarChart3,
    path: '/reports',
    kbd: 'G R',
    roles: ['ministry_hr', 'dept_admin', 'head_of_agency', 'psc_officer', 'psc_admin', 'psc_secretary', 'senior_admin_officer', 'hr_unit_manager', 'vipam_manager', 'odu_manager', 'hr_unit_principal', 'vipam_principal'],
  },
  {
    id: 'meeting-room',
    label: 'Meeting Room',
    sublabel: 'Live sitting management',
    icon: Headphones,
    path: '/secretariat/meeting-room',
    kbd: 'G M',
    roles: ['psc_officer', 'psc_admin', 'psc_secretary', 'senior_admin_officer', 'psc_commissioner', 'chairperson', 'psc_manager', 'principal_officer', 'senior_officer', 'hr_unit_manager', 'vipam_manager'],
  },
  {
    id: 'decisions',
    label: 'Decisions',
    sublabel: 'Commission decision register',
    icon: Gavel,
    path: '/secretariat/decisions',
    roles: ['psc_officer', 'psc_admin', 'psc_secretary', 'senior_admin_officer', 'psc_commissioner', 'chairperson', 'psc_manager', 'hr_unit_manager', 'vipam_manager', 'odu_manager', 'hr_unit_principal', 'vipam_principal'],
  },
  {
    id: 'meetings',
    label: 'Meetings',
    sublabel: 'Commission sittings',
    icon: CalendarDays,
    path: '/secretariat/meetings',
    roles: ['psc_officer', 'psc_admin', 'psc_secretary', 'senior_admin_officer', 'psc_commissioner', 'chairperson', 'psc_manager'],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    sublabel: 'Minutes decision tasks',
    icon: ListTodo,
    path: '/secretariat/tasks',
    kbd: 'G T',
    roles: ['psc_officer', 'psc_admin', 'psc_secretary', 'senior_admin_officer', 'hr_unit_manager', 'vipam_manager'],
  },
]

/**
 * Breadcrumbs are translation-keyed so they react to language switching.
 * Each entry is a pair of i18n keys [groupKey, leafKey]; either may be a literal
 * string if no translation exists.
 */
const BREADCRUMB_MAP = {
  '/':                              ['app.title',             'breadcrumb.dashboard'],
  '/submissions':                   ['nav.group_submissions', 'breadcrumb.submissions'],
  '/submissions/new':               ['nav.group_submissions', 'breadcrumb.submissions_new'],
  '/reports':                       ['nav.group_submissions', 'breadcrumb.reports'],
  '/meetings/capture':              ['nav.group_commission',  'breadcrumb.meeting_capture'],
  '/secretariat/meeting-room':      ['nav.group_commission',  'breadcrumb.meeting_room'],
  '/secretariat/meeting-room/minutes-pipeline': ['nav.group_commission', 'breadcrumb.minutes_pipeline'],
  '/secretariat/meetings':          ['nav.group_commission',  'breadcrumb.meetings'],
  '/secretariat/agenda':            ['nav.group_commission',  'breadcrumb.agenda'],
  '/secretariat/agenda/sitting-pack': ['nav.group_commission', 'breadcrumb.agenda', 'sitting_pack.title'],
  '/secretariat/minutes':           ['nav.group_commission',  'breadcrumb.minutes'],
  '/secretariat/decisions':         ['nav.group_commission',  'breadcrumb.decisions'],
  '/secretariat/tasks':             ['nav.group_commission',  'breadcrumb.tasks'],
  '/secretariat/notifications':     ['nav.group_commission',  'breadcrumb.notifications'],
  '/admin/roles-permissions':       ['nav.group_admin',       'breadcrumb.roles_permissions'],
  '/admin/ministries-departments':  ['nav.group_admin',       'breadcrumb.ministries_departments'],
  '/admin/api-keys':                ['nav.group_admin',       'breadcrumb.api_keys'],
  '/admin/system-config':           ['nav.group_admin',       'breadcrumb.system_config'],
  '/admin/email-templates':         ['nav.group_admin',       'breadcrumb.email_templates'],
  '/admin/daily-brief':             ['nav.group_admin',       'nav.daily_brief'],
  '/admin/ui-translations':         ['nav.group_admin',       'breadcrumb.ui_translations'],
  '/admin/security':                ['nav.group_admin',       'breadcrumb.security'],
  '/admin/feedback':                ['nav.group_admin',       'breadcrumb.feedback'],
  '/admin/backup-restore':          ['nav.group_admin',       'breadcrumb.backup_restore'],
  '/admin-panel':                   ['nav.group_admin',       'breadcrumb.roles_permissions'],
  '/pages/account':                 ['nav.account',           'breadcrumb.account'],
  '/404':                           ['app.title',             'breadcrumb.error_404'],
}

function NotificationIcon({ type }) {
  if (type === 'success') return <CheckCircle2 size={16} className="text-emerald-500" aria-hidden="true" />
  if (type === 'warning') return <AlertCircle size={16} className="text-amber-500" aria-hidden="true" />
  if (type === 'error') return <AlertCircle size={16} className="text-red-500" aria-hidden="true" />
  return <Info size={16} className="text-cyan-500" aria-hidden="true" />
}

const UserMenuItem = memo(function UserMenuItem({ Icon, label, item, onClick }) {
  const handleClick = useCallback(() => onClick(item), [onClick, item])
  return (
    <button
      type="button"
      role="menuitem"
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100 transition-colors focus:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-700/50"
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </button>
  )
})

export default function Header({ onMenuClick }) {
  const { t } = useTranslation()
  const { user, logout, lock } = useAuth()
  const { theme, isDark, cycleTheme, openSettingsPanel, sidebarCollapsed, isHorizontal } = useTheme()
  const {
    notifications,
    unreadCount,
    loading: notifLoading,
    error: notifError,
    markRead,
    markAllRead,
    refresh: refreshNotifications,
  } = useNotifications({ enabled: !!user })
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef(null)
  const searchInputRef = useRef(null)
  const searchDebounce = useRef(null)
  const notifRef = useRef(null)
  const notifButtonRef = useRef(null)
  const userRef = useRef(null)
  const userButtonRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  const breadcrumbs = useMemo(() => {
    const mapped = BREADCRUMB_MAP[location.pathname]
    if (mapped) return mapped.map(key => t(key))
    if (location.pathname.startsWith('/submissions/')) {
      return [t('nav.group_submissions'), t('breadcrumb.submission_detail')]
    }
    if (location.pathname.startsWith('/secretariat/meetings/')) {
      return [t('nav.group_commission'), t('breadcrumb.meeting_minutes')]
    }
    return [t('app.title')]
  }, [location.pathname, t])

  const handleNotificationNavigate = useCallback(
    (id, path) => {
      markRead(id)
      setNotifOpen(false)
      if (path) navigate(path)
    },
    [markRead, navigate],
  )

  const handleNotifOpen = useCallback(() => {
    setNotifOpen((o) => {
      if (!o) refreshNotifications()
      return !o
    })
  }, [refreshNotifications])

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false)
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchResults([])
    }
    function handleKey(e) {
      if (e.key !== 'Escape') return
      if (notifOpen) {
        setNotifOpen(false)
        notifButtonRef.current?.focus()
      }
      if (userOpen) {
        setUserOpen(false)
        userButtonRef.current?.focus()
      }
      if (searchOpen) {
        setSearchOpen(false)
        setSearchQuery('')
        setSearchResults([])
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [notifOpen, userOpen, searchOpen])

  const startOffset = isHorizontal ? 'start-0' : (sidebarCollapsed ? 'lg:start-[5.5rem]' : 'lg:start-64')

  // Filter quick actions for the current user's role
  const quickActions = useMemo(() => {
    if (!user) return []
    return ALL_QUICK_ACTIONS.filter(a => !a.roles || a.roles.includes(user.role) || user.is_staff)
  }, [user])

  // Filtered quick actions based on current query
  const filteredQuickActions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return quickActions
    return quickActions.filter(
      a => a.label.toLowerCase().includes(q) || a.sublabel.toLowerCase().includes(q),
    )
  }, [quickActions, searchQuery])

  const handleSearchChange = useCallback(e => {
    const v = e.target.value
    setSearchQuery(v)
    clearTimeout(searchDebounce.current)
    if (v.trim().length < 2) { setSearchResults([]); return }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const { data } = await api.get(`/search/?q=${encodeURIComponent(v.trim())}`)
        setSearchResults(data.results || [])
      } catch { setSearchResults([]) }
      finally { setSearchLoading(false) }
    }, 300)
  }, [])
  const handleSearchClose = useCallback(() => {
    setSearchOpen(false); setSearchQuery(''); setSearchResults([])
  }, [])
  const handleSearchOpen = useCallback(() => {
    setSearchOpen(true)
    // Focus the input on next tick (it may not be mounted yet)
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }, [])

  // Listen for the global shortcut event dispatched by useGlobalShortcuts
  useEffect(() => {
    const onOpenSearch = () => handleSearchOpen()
    document.addEventListener('psc:search:open', onOpenSearch)
    return () => document.removeEventListener('psc:search:open', onOpenSearch)
  }, [handleSearchOpen])
  const handleNotifToggle = handleNotifOpen
  const handleUserToggle = useCallback(() => setUserOpen(o => !o), [])
  const handleSignOut = useCallback(() => {
    logout()
    navigate('/auth/login')
  }, [logout, navigate])

  const handleLock = useCallback(() => {
    lock()
  }, [lock])

  const initials = useMemo(() => {
    const name = user?.username || 'PSC'
    const parts = name.split(/[.\s-_]/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }, [user?.username])

  const userMenuItems = useMemo(() => [
    { icon: User, label: t('user_menu.my_profile'), path: '/pages/account' },
  ], [t])
  const handleUserMenuClick = useCallback((item) => {
    navigate(item.path)
    setUserOpen(false)
  }, [navigate])

  const notificationLiveMessage = useMemo(() => {
    if (!notifOpen) return ''
    if (notifLoading && notifications.length === 0) return t('notifications.loading')
    if (notifError && notifications.length === 0) return t('notifications.load_error')
    if (!notifLoading && !notifError && notifications.length === 0) {
      return t('notifications.empty')
    }
    if (unreadCount > 0) {
      return t('header.notifications_new', { count: unreadCount })
    }
    return t('header.notifications')
  }, [notifOpen, notifLoading, notifError, notifications.length, unreadCount, t])

  return (
    <header className={clsx(
      'fixed top-0 end-0 start-0 h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-30 flex items-center px-4 gap-3 sidebar-transition',
      startOffset
    )}>
      {/* Mobile logo + menu button */}
      <div className="flex lg:hidden items-center gap-2">
        <BrandLogo size={30} />
        <button
          type="button"
          onClick={onMenuClick}
          aria-label={t('accessibility.open_menu')}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Desktop: logo for horizontal, menu toggle for sidebar */}
      {isHorizontal ? (
        <div className="hidden lg:flex items-center gap-3">
          <BrandLogo size={34} />
          <div>
            <span className="font-bold text-base text-slate-800 dark:text-slate-100 leading-tight">{t('app.title')}</span>
            <span className="block text-[10px] font-semibold tracking-widest uppercase text-slate-400 dark:text-slate-500 -mt-0.5">{t('app.brand_tag')}</span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onMenuClick}
          aria-label={sidebarCollapsed ? t('accessibility.expand') : t('accessibility.collapse')}
          className="hidden lg:flex p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      )}

      {/* Breadcrumbs */}
      <nav
        aria-label={t('accessibility.breadcrumb_navigation')}
        className="hidden md:flex items-center gap-1.5 text-sm"
      >
        <span className="text-slate-400 dark:text-slate-500">{t('app.home')}</span>
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1
          return (
            <Fragment key={`${crumb}-${i}`}>
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" aria-hidden="true" />
              <span
                aria-current={isLast ? 'page' : undefined}
                className={clsx(
                  isLast
                    ? 'text-slate-700 dark:text-slate-300 font-medium'
                    : 'text-slate-400 dark:text-slate-500'
                )}
              >
                {crumb}
              </span>
            </Fragment>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative" ref={searchRef}>
        {searchOpen ? (
          <div className="flex items-center gap-2 animate-fade-in">
            <div className="relative">
              <label htmlFor="global-search-input" className="sr-only">
                {t('header.search')}
              </label>
              <input
                id="global-search-input"
                ref={searchInputRef}
                type="search"
                placeholder={t('header.search_placeholder')}
                autoFocus
                value={searchQuery}
                onChange={handleSearchChange}
                aria-label={t('header.search')}
                className="w-52 sm:w-72 input text-sm pr-8"
              />
              {searchLoading && (
                <svg
                  className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  role="img"
                  aria-label={t('header.search_searching')}
                >
                  <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              )}
              {/* Combined dropdown: quick actions + record search results */}
              {(filteredQuickActions.length > 0 || searchResults.length > 0 || (searchQuery.trim().length >= 2 && !searchLoading)) && (
                <div
                  className="absolute top-full mt-1 left-0 w-96 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden"
                  role="listbox"
                  aria-label="Search and quick actions"
                >
                  <div className="max-h-[28rem] overflow-y-auto custom-scrollbar">
                    {/* Quick Actions section */}
                    {filteredQuickActions.length > 0 && (
                      <div>
                        <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
                          <Zap size={10} className="text-amber-400" />
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Quick Actions
                          </span>
                        </div>
                        <ul className="pb-1">
                          {filteredQuickActions.map(action => {
                            const Icon = action.icon
                            return (
                              <li key={action.id} role="option" aria-selected="false">
                                <button
                                  type="button"
                                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors focus:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-700/60"
                                  onClick={() => { navigate(action.path); handleSearchClose() }}
                                >
                                  <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                    <Icon size={13} className="text-slate-500 dark:text-slate-400" />
                                  </span>
                                  <span className="flex-1 min-w-0 text-left">
                                    <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">{action.label}</span>
                                    <span className="block text-[10px] text-slate-400 dark:text-slate-500 truncate">{action.sublabel}</span>
                                  </span>
                                  {action.kbd && (
                                    <kbd className="shrink-0 hidden sm:inline-flex items-center gap-0.5 text-[9px] font-mono text-slate-400 dark:text-slate-500">
                                      {action.kbd.split(' ').map((k, ki) => (
                                        <span key={ki} className="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                          {k}
                                        </span>
                                      ))}
                                    </kbd>
                                  )}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Record search results section */}
                    {searchResults.length > 0 && (
                      <div className={filteredQuickActions.length > 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''}>
                        <div className="px-3 pt-2.5 pb-1">
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Records
                          </span>
                        </div>
                        <ul className="pb-1">
                          {searchResults.map((r, i) => (
                            <li key={i} role="option" aria-selected="false">
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors focus:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-700/60"
                                onClick={() => { navigate(r.url); handleSearchClose() }}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                    r.type === 'submission' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                                    r.type === 'task'       ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' :
                                                             'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                  }`}>
                                    {r.type}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{r.label}</span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{r.sublabel}</p>
                                {r.meta && <p className="text-[10px] text-slate-400 mt-0.5">{r.meta}</p>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* No results message */}
                    {searchQuery.trim().length >= 2 && !searchLoading && searchResults.length === 0 && filteredQuickActions.length === 0 && (
                      <p
                        className="px-4 py-3 text-xs text-slate-500"
                        role="status"
                        aria-live="polite"
                      >
                        {t('header.search_no_results', { query: searchQuery })}
                      </p>
                    )}
                  </div>

                  {/* Footer hint */}
                  <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center gap-3">
                    <span className="text-[10px] text-slate-400">
                      Press <kbd className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1 font-mono text-[9px]">↑↓</kbd> to navigate,{' '}
                      <kbd className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1 font-mono text-[9px]">↵</kbd> to select,{' '}
                      <kbd className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1 font-mono text-[9px]">Esc</kbd> to close
                    </span>
                    <span className="ml-auto text-[10px] text-slate-400">
                      <kbd className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1 font-mono text-[9px]">?</kbd> shortcuts
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleSearchClose}
              aria-label={t('header.search_close')}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSearchOpen}
            aria-label={t('header.search_open')}
            title={t('header.search')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <Search size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Keyboard shortcuts hint button */}
      <button
        type="button"
        onClick={() => document.dispatchEvent(new CustomEvent('psc:shortcuts:open'))}
        aria-label="Keyboard shortcuts (?)"
        title="Keyboard shortcuts (?)"
        className="hidden sm:flex p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <Keyboard size={18} aria-hidden="true" />
      </button>

      {/* Language switcher */}
      <LanguageSwitcher />

      {/* Theme cycle toggle: light → dim → dark → light */}
      <button
        type="button"
        onClick={cycleTheme}
        title={theme === 'light' ? 'Switch to Dim mode' : theme === 'dim' ? 'Switch to Dark mode' : 'Switch to Light mode'}
        aria-label={theme === 'light' ? 'Switch to Dim mode' : theme === 'dim' ? 'Switch to Dark mode' : 'Switch to Light mode'}
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        {theme === 'dark'
          ? <Sun size={20} aria-hidden="true" />
          : theme === 'dim'
            ? <Moon size={20} aria-hidden="true" />
            : <SunDim size={20} aria-hidden="true" />}
      </button>

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <LiveRegion message={notificationLiveMessage} politeness="polite" />
        <button
          ref={notifButtonRef}
          type="button"
          onClick={handleNotifToggle}
          aria-haspopup="dialog"
          aria-expanded={notifOpen}
          aria-label={`${t('header.notifications_open')} (${t('accessibility.unread_count', { count: unreadCount })})`}
          title={t('header.notifications')}
          className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <Bell size={20} aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1 end-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
            >
              {unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div
            role="dialog"
            aria-label={t('header.notifications')}
            className="absolute end-0 top-full mt-2 w-80 card shadow-card-lg animate-fade-in z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('header.notifications')}</h3>
              {unreadCount > 0 && (
                <span className="badge badge-primary">{t('header.notifications_new', { count: unreadCount })}</span>
              )}
            </div>
            <DesktopNotificationSettings compact />
            <div
              className="max-h-72 overflow-y-auto custom-scrollbar"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {notifLoading && notifications.length === 0 && (
                <p className="px-4 py-6 text-sm text-slate-400 text-center" role="status">
                  {t('notifications.loading')}
                </p>
              )}
              {notifError && notifications.length === 0 && (
                <p className="px-4 py-6 text-sm text-red-500 text-center" role="alert">
                  {t('notifications.load_error')}
                </p>
              )}
              {!notifLoading && !notifError && notifications.length === 0 && (
                <p className="px-4 py-6 text-sm text-slate-400 text-center" role="status">
                  {t('notifications.empty')}
                </p>
              )}
              {notifications.map(notif => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => handleNotificationNavigate(notif.id, notif.path)}
                  className={clsx(
                    'flex w-full items-start gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors text-start focus:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-700/30',
                    !notif.read && 'bg-primary-50/30 dark:bg-primary-900/10'
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    <NotificationIcon type={notif.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-sm font-medium', !notif.read ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400')}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{notif.message}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{notif.time}</p>
                  </div>
                  {!notif.read && (
                    <span className="w-2 h-2 bg-primary-500 rounded-full mt-1 shrink-0" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => { markAllRead() }}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-1"
                >
                  {t('notifications.mark_all_read')}
                </button>
              )}
              <button
                type="button"
                onClick={() => { setNotifOpen(false); navigate('/secretariat/tasks') }}
                className="w-full text-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium py-1 focus:outline-none focus-visible:underline"
              >
                {t('header.notifications_open_tasks')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings panel trigger */}
      <button
        type="button"
        onClick={openSettingsPanel}
        aria-label={t('header.settings_open')}
        title={t('header.settings')}
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <Settings size={20} aria-hidden="true" />
      </button>

      {/* Quick lock */}
      <button
        type="button"
        onClick={handleLock}
        aria-label={t('header.lock_session_hint')}
        title={t('header.lock_session_hint')}
        className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-slate-600 dark:text-slate-400 hover:text-amber-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <Lock size={18} aria-hidden="true" />
      </button>

      {/* User dropdown */}
      <div className="relative" ref={userRef}>
        <button
          ref={userButtonRef}
          type="button"
          onClick={handleUserToggle}
          aria-haspopup="menu"
          aria-expanded={userOpen}
          aria-label={t('header.user_menu_open')}
          className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center overflow-hidden">
            {user?.profile_picture ? (
              <img
                src={user.profile_picture}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white font-semibold text-xs" aria-hidden="true">{initials}</span>
            )}
          </div>
          <div className="hidden sm:block text-start">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-none">{user?.username || t('nav.account')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">{user?.role?.replace(/_/g, ' ') || ''}</p>
          </div>
          <ChevronDown size={14} aria-hidden="true" className="text-slate-400 hidden sm:block" />
        </button>

        {userOpen && (
          <div
            role="menu"
            aria-label={t('nav.account')}
            className="absolute end-0 top-full mt-2 w-56 card shadow-card-lg animate-fade-in z-50"
          >
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <p className="font-semibold text-slate-800 dark:text-slate-200">{user?.username}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{user?.email || t('header.user_role_unknown')}</p>
            </div>
            <div className="py-2">
              {userMenuItems.map((item) => (
                <UserMenuItem
                  key={item.label}
                  Icon={item.icon}
                  label={item.label}
                  item={item}
                  onClick={handleUserMenuClick}
                />
              ))}
            </div>
            <div className="py-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                role="menuitem"
                onClick={handleLock}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors focus:outline-none focus-visible:bg-amber-50 dark:focus-visible:bg-amber-900/20"
              >
                <Lock size={16} aria-hidden="true" />
                {t('user_menu.lock_session')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus:outline-none focus-visible:bg-red-50 dark:focus-visible:bg-red-900/20"
              >
                <LogOut size={16} aria-hidden="true" />
                {t('user_menu.sign_out')}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

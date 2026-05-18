import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { getAllPaths, flattenItems, getVisibleMenuForUser, translateLabel } from '../../data/menuItems'
import BrandLogo from '../shared/BrandLogo'


// Collapsed sidebar: one icon per group with flyout dropdown
function CollapsedGroupItem({ group }) {
  const { t } = useTranslation()
  const location = useLocation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState({})
  const triggerRef = useRef(null)

  const GroupIcon = group.groupIcon
  const allPaths = getAllPaths(group.items)
  const anyActive = allPaths.includes(location.pathname)

  const flatItems = flattenItems(group.items)
  const groupLabel = translateLabel(group, t)

  useEffect(() => {
    if (dropdownOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const dropdownHeight = flatItems.length * 38 + 56
      const spaceBelow = window.innerHeight - rect.top
      const isRtl = document.documentElement.dir === 'rtl'

      const style = { position: 'fixed', zIndex: 9999 }

      if (isRtl) {
        style.right = `${window.innerWidth - rect.left + 4}px`
      } else {
        style.left = `${rect.right + 4}px`
      }

      const maxH = window.innerHeight - 16 // 8px padding top + bottom

      if (spaceBelow >= dropdownHeight) {
        // Enough room below — align top of dropdown with top of trigger
        style.top = `${rect.top}px`
        style.maxHeight = `${window.innerHeight - rect.top - 8}px`
      } else if (rect.bottom >= dropdownHeight) {
        // Enough room above — align bottom of dropdown with bottom of trigger
        style.bottom = `${window.innerHeight - rect.bottom}px`
        style.maxHeight = `${rect.bottom - 8}px`
      } else {
        // Dropdown is taller than both sides — pin to viewport with scroll
        style.top = '8px'
        style.maxHeight = `${maxH}px`
      }

      setDropdownStyle(style)
    }
  }, [dropdownOpen])

  // If group has only one item with a direct path, make it a direct link
  if (group.items.length === 1 && group.items[0].path) {
    const onlyItem = group.items[0]
    const onlyLabel = translateLabel(onlyItem, t)
    return (
      <NavLink
        to={onlyItem.path}
        aria-label={onlyLabel}
        className={({ isActive }) => clsx(
          'flex flex-col items-center gap-0.5 px-1 py-2.5 rounded-lg font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          isActive
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
        )}
      >
        <GroupIcon size={20} className="shrink-0" aria-hidden="true" />
        <span className="text-[10px] leading-tight text-center truncate w-full">{onlyLabel}</span>
      </NavLink>
    )
  }

  return (
    <div
      ref={triggerRef}
      onMouseEnter={() => setDropdownOpen(true)}
      onMouseLeave={() => setDropdownOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={dropdownOpen}
        aria-label={groupLabel}
        className={clsx(
          'w-full flex flex-col items-center gap-0.5 px-1 py-2.5 rounded-lg font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          anyActive
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
        )}
      >
        <GroupIcon size={20} className="shrink-0" aria-hidden="true" />
        <span className="text-[10px] leading-tight text-center truncate w-full">{groupLabel}</span>
      </button>

      {dropdownOpen && createPortal(
        <div
          style={dropdownStyle}
          role="menu"
          aria-label={groupLabel}
          className="min-w-[200px] max-h-[70vh] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-2 animate-fade-in"
          onMouseEnter={() => setDropdownOpen(true)}
          onMouseLeave={() => setDropdownOpen(false)}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            {groupLabel}
          </div>
          {flatItems.map((entry, i) => {
            if (entry.type === 'header') {
              return (
                <div key={`h-${i}`} className="px-3 pt-2.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-t border-slate-100 dark:border-slate-700 mt-1">
                  {translateLabel(entry, t)}
                </div>
              )
            }
            const ItemIcon = entry.icon
            const entryLabel = translateLabel(entry, t)
            return (
              <NavLink
                key={entry.path}
                to={entry.path}
                role="menuitem"
                onClick={() => setDropdownOpen(false)}
                className={({ isActive }) => clsx(
                  'flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-md text-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                <ItemIcon size={15} className="shrink-0" aria-hidden="true" />
                <span>{entryLabel}</span>
              </NavLink>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

// Expanded sidebar: individual items with accordion for children
function NavItem({ item }) {
  const { t } = useTranslation()
  const location = useLocation()
  const [open, setOpen] = useState(() => {
    if (!item.children) return false
    return item.children.some(c => c.path === location.pathname)
  })

  const hasChildren = !!item.children
  const Icon = item.icon
  const label = translateLabel(item, t)

  if (!hasChildren) {
    return (
      <NavLink
        to={item.path}
        className={({ isActive }) => clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          isActive
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
        )}
      >
        <Icon size={18} className="shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </NavLink>
    )
  }

  const anyChildActive = item.children.some(c => c.path === location.pathname)

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          anyChildActive
            ? 'text-primary-600 dark:text-primary-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
        )}
      >
        <Icon size={18} className="shrink-0" aria-hidden="true" />
        <span className="flex-1 text-start">{label}</span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={clsx(
            'transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="mt-1 ms-4 ps-3 border-s border-slate-200 dark:border-slate-700 space-y-0.5">
          {item.children.map(child => {
            const ChildIcon = child.icon
            const childLabel = translateLabel(child, t)
            return (
              <NavLink
                key={child.path}
                to={child.path}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                <ChildIcon size={15} className="shrink-0" aria-hidden="true" />
                <span>{childLabel}</span>
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const { t } = useTranslation()
  const { sidebarCollapsed, feedbackEnabled } = useTheme()
  const { user } = useAuth()
  const collapsed = sidebarCollapsed

  const visibleMenu = useMemo(
    () => getVisibleMenuForUser(user, feedbackEnabled),
    [user, feedbackEnabled]
  )

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label={t('accessibility.primary_navigation')}
        className={clsx(
          'fixed top-0 start-0 h-full bg-white dark:bg-slate-800 border-e border-slate-200 dark:border-slate-700 z-30 flex flex-col sidebar-transition overflow-hidden',
          collapsed ? 'w-[5.5rem]' : 'w-64',
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full rtl:translate-x-full lg:translate-x-0 rtl:lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={clsx(
          'flex items-center h-16 border-b border-slate-200 dark:border-slate-700 shrink-0',
          collapsed ? 'justify-center px-3' : 'px-5 gap-3'
        )}>
          <BrandLogo size={34} />
          {!collapsed && (
            <div>
              <span className="font-bold text-base text-slate-800 dark:text-slate-100 leading-tight">{t('app.title')}</span>
              <span className="block text-[10px] font-semibold tracking-widest uppercase text-slate-400 dark:text-slate-500 -mt-0.5">{t('app.brand_tag')}</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar py-4 px-2 space-y-0.5">
          {collapsed ? (
            /* Collapsed: group icons with flyout */
            <div className="space-y-1">
              {visibleMenu.map(group => (
                <CollapsedGroupItem key={group.group} group={group} />
              ))}
            </div>
          ) : (
            /* Expanded: full menu with groups */
            visibleMenu.map(group => (
              <div key={group.group} className="mb-2">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {translateLabel(group, t)}
                </div>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <NavItem key={item.path || item.label} item={item} />
                  ))}
                </div>
              </div>
            ))
          )}
        </nav>
      </aside>
    </>
  )
}

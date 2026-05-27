import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { ChevronDown, X } from 'lucide-react'
import { getAllPaths, flattenItems, getVisibleMenuForUser, translateLabel } from '../../data/menuItems'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import BrandLogo from '../shared/BrandLogo'

// Desktop: hover dropdown via portal
function HorizGroupItem({ group }) {
  const { t } = useTranslation()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState({})
  const triggerRef = useRef(null)

  const GroupIcon = group.groupIcon
  const allPaths = getAllPaths(group.items)
  const anyActive = allPaths.includes(location.pathname)
  const flatItems = flattenItems(group.items)
  const groupLabel = translateLabel(group, t)

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const isRtl = document.documentElement.dir === 'rtl'
      const dropdownWidth = 220
      const maxH = window.innerHeight - rect.bottom - 8

      const style = {
        position: 'fixed',
        zIndex: 9999,
        top: `${rect.bottom + 4}px`,
        maxHeight: `${Math.max(maxH, 200)}px`,
      }

      if (isRtl) {
        const right = window.innerWidth - rect.right
        style.right = `${Math.max(0, right)}px`
      } else {
        const left = rect.left
        style.left = `${Math.min(left, window.innerWidth - dropdownWidth - 8)}px`
      }

      setDropdownStyle(style)
    }
  }, [open])

  if (group.items.length === 1 && group.items[0].path) {
    const onlyItem = group.items[0]
    const onlyLabel = translateLabel(onlyItem, t)
    return (
      <NavLink
        to={onlyItem.path}
        className={({ isActive }) => clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          isActive
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
        )}
      >
        <GroupIcon size={16} aria-hidden="true" />
        {onlyLabel}
      </NavLink>
    )
  }

  return (
    <div
      className="relative"
      ref={triggerRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          open || anyActive
            ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
        )}
      >
        <GroupIcon size={16} aria-hidden="true" />
        {groupLabel}
        <ChevronDown size={13} aria-hidden="true" className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          style={dropdownStyle}
          role="menu"
          aria-label={groupLabel}
          className="min-w-[200px] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-2 animate-fade-in"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {flatItems.map((entry, i) => {
            if (entry.type === 'header') {
              return (
                <div key={`h-${i}`} className="px-3 pt-2.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-t border-slate-100 dark:border-slate-700 mt-1 first:border-0 first:mt-0">
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
                onClick={() => setOpen(false)}
                className={({ isActive }) => clsx(
                  'flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-md text-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                <ItemIcon size={15} aria-hidden="true" />
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

// Mobile: individual nav items matching sidebar expanded style
function MobileNavItem({ item, onClose, itemKey, openKey, setOpenKey }) {
  const { t } = useTranslation()
  const location = useLocation()

  const hasChildren = !!item.children
  const Icon = item.icon
  const label = translateLabel(item, t)

  if (!hasChildren) {
    return (
      <NavLink
        to={item.path}
        onClick={onClose}
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
  const open = openKey === itemKey || anyChildActive

  useEffect(() => {
    if (!anyChildActive) return
    setOpenKey(itemKey)
  }, [anyChildActive, itemKey, setOpenKey])

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpenKey(curr => (curr === itemKey ? null : itemKey))}
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
          className={clsx('transition-transform duration-200', open && 'rotate-180')}
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
                onClick={onClose}
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

export default function HorizontalMenu({ mobileOpen, onMobileClose }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { feedbackEnabled } = useTheme()
  const [openKey, setOpenKey] = useState(null)
  const visibleMenuGroups = useMemo(
    () => getVisibleMenuForUser(user, feedbackEnabled),
    [user, feedbackEnabled]
  )

  return (
    <>
      {/* Desktop horizontal bar */}
      <nav
        aria-label={t('accessibility.primary_navigation')}
        className="hidden lg:flex fixed top-16 start-0 end-0 h-12 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-20 items-center px-4 gap-1 overflow-x-auto scrollbar-hide"
      >
        {visibleMenuGroups.map(group => (
          <HorizGroupItem key={group.group} group={group} />
        ))}
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        aria-label={t('accessibility.mobile_navigation')}
        className={clsx(
          'fixed top-0 start-0 h-full w-64 bg-white dark:bg-slate-800 border-e border-slate-200 dark:border-slate-700 z-30 flex flex-col transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <BrandLogo size={34} />
            <div>
              <span className="font-bold text-base text-slate-800 dark:text-slate-100 leading-tight">{t('app.title')}</span>
              <span className="block text-[10px] font-semibold tracking-widest uppercase text-slate-400 dark:text-slate-500 -mt-0.5">{t('app.brand_tag')}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onMobileClose}
            aria-label={t('accessibility.close_menu')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar py-4 px-2 space-y-0.5">
          {visibleMenuGroups.map(group => (
            <div key={group.group} className="mb-2">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {translateLabel(group, t)}
              </div>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <MobileNavItem
                    key={item.path || item.label}
                    item={item}
                    onClose={onMobileClose}
                    itemKey={item.path || item.label}
                    openKey={openKey}
                    setOpenKey={setOpenKey}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}

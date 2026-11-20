import { NavLink } from 'react-router-dom'
import clsx from 'clsx'

/**
 * Sub-navigation for a group of pages that belong to one job but live at
 * separate routes (so existing links, notification deep-links and bookmarks
 * keep working). Pass the tabs the current user may see — hide, don't disable.
 *
 *   <PageTabs tabs={[{ to: '/secretariat/tasks', label: 'Tasks', icon: ListTodo }]} />
 *
 * Deliberately an underline strip, not a pill group: several of these pages
 * already use pill tabs for their own inner views, and two pill strips stacked
 * read as one control.
 *
 * A single visible tab renders nothing: one tab is not a choice.
 */
export default function PageTabs({ tabs = [], className }) {
  const visible = tabs.filter(Boolean)
  if (visible.length < 2) return null

  return (
    <nav
      aria-label="Section"
      className={clsx(
        'flex flex-wrap items-center gap-x-6 gap-y-1 -mt-2 mb-6 print:hidden',
        'border-b border-slate-200 dark:border-slate-700',
        className,
      )}
    >
      {visible.map(({ to, label, icon: Icon, end = true }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => clsx(
            'inline-flex items-center gap-2 -mb-px border-b-2 px-1 pb-2 text-sm font-medium transition-colors',
            isActive
              ? 'border-primary-600 text-primary-700 dark:border-primary-400 dark:text-primary-300'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
          )}
        >
          {Icon && <Icon size={15} aria-hidden="true" />}
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

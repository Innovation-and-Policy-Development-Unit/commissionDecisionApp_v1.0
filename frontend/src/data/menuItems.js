import { LayoutDashboard, FileText, BarChart3, Gavel, CalendarDays, ScrollText, Bell, ListTodo, Shield, ShieldAlert, Building2, Lock, Settings, HardDrive, MessageSquare, ClipboardList } from 'lucide-react'
import {
  userCanAccessAdminPanel,
  userCanManageRoles,
  userCanViewAuditLog,
  userCanManageFeedback,
} from '../utils/adminAccess'

/**
 * Each group and item carries:
 *   - `label`     : English fallback (used when no translator is supplied)
 *   - `labelKey`  : i18next translation key (preferred when rendering with t())
 */
const menuItems = [
  {
    group: 'Submissions',
    groupKey: 'nav.group_submissions',
    groupIcon: FileText,
    items: [
      { label: 'Dashboard',   labelKey: 'nav.dashboard',   icon: LayoutDashboard, path: '/' },
      { label: 'Submissions', labelKey: 'nav.submissions', icon: FileText,        path: '/submissions' },
      { label: 'Reports',     labelKey: 'nav.reports',     icon: BarChart3,       path: '/reports' },
    ],
  },
  {
    group: 'Commission Decision',
    groupKey: 'nav.group_commission',
    groupIcon: Gavel,
    items: [
      { label: 'Meetings',        labelKey: 'nav.meetings',      icon: CalendarDays, path: '/secretariat/meetings' },
      { label: 'Agenda',          labelKey: 'nav.agenda',        icon: ScrollText,   path: '/secretariat/agenda' },
      { label: 'Decisions',       labelKey: 'nav.decisions',     icon: Gavel,        path: '/secretariat/decisions' },
      { label: 'Task management', labelKey: 'nav.tasks',         icon: ListTodo,     path: '/secretariat/tasks' },
      { label: 'Notifications',   labelKey: 'nav.notifications', icon: Bell,         path: '/secretariat/notifications' },
    ],
  },
  {
    group: 'Administration',
    groupKey: 'nav.group_admin',
    groupIcon: Shield,
    adminAccess: true,
    items: [
      { label: 'Roles & Permissions',      labelKey: 'nav.roles_permissions',      icon: Shield,        path: '/admin/roles-permissions',      visibility: 'admin' },
      { label: 'Ministries & Departments', labelKey: 'nav.ministries_departments', icon: Building2,     path: '/admin/ministries-departments', visibility: 'admin' },
      { label: 'PSC Form Types',           labelKey: 'nav.form_types',             icon: ClipboardList, path: '/admin/form-types',             visibility: 'admin' },
      { label: 'API Keys',                 labelKey: 'nav.api_keys',               icon: Lock,         path: '/admin/api-keys',               visibility: 'roles' },
      { label: 'System Config',            labelKey: 'nav.system_config',          icon: Settings,     path: '/admin/system-config',          visibility: 'roles' },
      { label: 'Security',                 labelKey: 'nav.security',               icon: ShieldAlert,  path: '/admin/security',               visibility: 'audit' },
      { label: 'User Feedback',            labelKey: 'nav.feedback',               icon: MessageSquare, path: '/admin/feedback',              visibility: 'feedback' },
      { label: 'Backup & Restore',         labelKey: 'nav.backup_restore',         icon: HardDrive,    path: '/admin/backup-restore',         visibility: 'roles' },
    ],
  },
]

/**
 * Resolve an item/group's displayed label. Accepts an optional i18next `t`.
 * If `t` is not provided, the English fallback (`label`/`group`) is used.
 */
export function translateLabel(entry, t) {
  if (!entry) return ''
  const key = entry.labelKey || entry.groupKey
  const fallback = entry.label ?? entry.group ?? ''
  if (!t || !key) return fallback
  const translated = t(key)
  // i18next returns the key when missing; in that case fall back gracefully.
  return translated === key ? fallback : translated
}

export function getAllPaths(items) {
  const paths = []
  items.forEach(item => {
    if (item.path) paths.push(item.path)
    if (item.children) item.children.forEach(c => paths.push(c.path))
  })
  return paths
}

export function flattenItems(items) {
  const flat = []
  items.forEach(item => {
    if (item.children) {
      flat.push({ type: 'header', label: item.label, labelKey: item.labelKey })
      item.children.forEach(c => flat.push({ type: 'link', ...c }))
    } else {
      flat.push({ type: 'link', ...item })
    }
  })
  return flat
}

/**
 * Administration links respect per-item visibility:
 * admin → userCanAccessAdminPanel | roles → userCanManageRoles | audit → userCanViewAuditLog
 */
export function getVisibleMenuForUser(user, feedbackEnabled = true) {
  return menuItems
    .map((group) => {
      if (!group.adminAccess) return group
      if (!user) return null
      const showGroup =
        userCanAccessAdminPanel(user) || userCanViewAuditLog(user)
      if (!showGroup) return null
      const items = group.items.filter((item) => {
        const vis = item.visibility ?? 'admin'
        if (vis === 'admin') return userCanAccessAdminPanel(user)
        if (vis === 'roles') return userCanManageRoles(user)
        if (vis === 'audit') return userCanViewAuditLog(user)
        if (vis === 'feedback') {
          if (!feedbackEnabled) return false
          return userCanManageFeedback(user)
        }
        return true
      })
      if (items.length === 0) return null
      return { ...group, items }
    })
    .filter(Boolean)
}

export default menuItems

import {
  LayoutDashboard, FileText, BarChart3, Gavel, CalendarDays, ScrollText, Bell, ListTodo,
  Shield, ShieldAlert, Building2, Lock, Settings, HardDrive, MessageSquare, ClipboardList,
  Headphones, Mail, FolderOpen, ExternalLink, Bot, BookOpen, Languages, Sparkles,
} from 'lucide-react'
import { CMS_PORTAL_URL } from '../constants/compliance'
import {
  userCanAccessAdminPanel,
  userCanManageRoles,
  userCanManageTranslations,
  userCanViewAuditLog,
  userCanManageFeedback,
} from '../utils/adminAccess'
import { menuItemVisibleForUser } from '../utils/complianceAccess'

/**
 * Each group and item carries:
 *   - `label`     : English fallback (used when no translator is supplied)
 *   - `labelKey`  : i18next translation key (preferred when rendering with t())
 *   - `audience`  : all | compliance | secretariat | exclude_compliance
 */
const menuItems = [
  {
    group: 'Compliance',
    groupKey: 'nav.group_compliance',
    groupIcon: FolderOpen,
    audience: 'compliance',
    items: [
      {
        label: 'Case Management (CMS)',
        labelKey: 'nav.cms_cases',
        icon: ExternalLink,
        href: CMS_PORTAL_URL,
        external: true,
      },
      {
        label: 'Registered with Commission',
        labelKey: 'nav.registered_submissions',
        icon: FileText,
        path: '/submissions',
      },
      { label: 'Dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, path: '/' },
      { label: 'Staff Assistant', labelKey: 'nav.staff_assistant', icon: Bot, path: '/assistant', audience: 'all' },
    ],
  },
  {
    group: 'Submissions',
    groupKey: 'nav.group_submissions',
    groupIcon: FileText,
    audience: 'exclude_compliance',
    items: [
      { label: 'Dashboard',   labelKey: 'nav.dashboard',   icon: LayoutDashboard, path: '/' },
      { label: 'Submissions', labelKey: 'nav.submissions', icon: FileText,        path: '/submissions' },
    ],
  },
  {
    group: 'Intelligence',
    groupKey: 'nav.group_intelligence',
    groupIcon: Sparkles,
    audience: 'all',
    items: [
      { label: 'Smart Report (AI)', labelKey: 'nav.smart_reports', icon: Sparkles, path: '/reports' },
      { label: 'OPSC Wiki',         labelKey: 'nav.wiki',          icon: BookOpen, path: '/wiki' },
      { label: 'Staff Assistant', labelKey: 'nav.staff_assistant', icon: Bot, path: '/assistant' },
    ],
  },
  {
    group: 'Commission Decision',
    groupKey: 'nav.group_commission',
    groupIcon: Gavel,
    audience: 'secretariat',
    items: [
      { label: 'Meeting room',    labelKey: 'nav.meeting_room',  icon: Headphones,   path: '/secretariat/meeting-room' },
      { label: 'Meetings',        labelKey: 'nav.meetings',      icon: CalendarDays, path: '/secretariat/meetings' },
      { label: 'Agenda',          labelKey: 'nav.agenda',        icon: ScrollText,   path: '/secretariat/agenda' },
      { label: 'Minutes',         labelKey: 'nav.minutes',       icon: FileText,     path: '/secretariat/minutes' },
      { label: 'Decisions',       labelKey: 'nav.decisions',     icon: Gavel,        path: '/secretariat/decisions' },
      {
        label: 'Minutes decision tasks',
        labelKey: 'nav.minutes_tasks',
        icon: ListTodo,
        path: '/secretariat/tasks',
      },
      { label: 'Notifications',   labelKey: 'nav.notifications', icon: Bell,         path: '/secretariat/notifications' },
    ],
  },
  {
    group: 'Help & Resources',
    groupKey: 'nav.group_help',
    groupIcon: BookOpen,
    audience: 'all',
    items: [
      {
        label: 'HR Manager Guide',
        labelKey: 'nav.guide_hr_manager',
        icon: BookOpen,
        path: '/guide/hr-manager',
        roles: ['ministry_hr', 'dept_admin', 'head_of_agency'],
      },
      {
        label: 'Unit Manager Guide',
        labelKey: 'nav.guide_unit_manager',
        icon: BookOpen,
        path: '/guide/unit-manager',
        roles: [
          'hr_unit_manager', 'hr_unit_principal',
          'vipam_manager', 'vipam_principal',
          'odu_manager', 'senior_admin_officer',
        ],
      },
      {
        label: 'Secretary Guide',
        labelKey: 'nav.guide_secretary',
        icon: BookOpen,
        path: '/guide/secretary',
        roles: ['psc_secretary', 'senior_admin_officer', 'psc_admin'],
      },
    ],
  },
  {
    group: 'Administration',
    groupKey: 'nav.group_admin',
    groupIcon: Shield,
    adminAccess: true,
    audience: 'exclude_compliance',
    items: [
      { label: 'Roles & Permissions',      labelKey: 'nav.roles_permissions',      icon: Shield,        path: '/admin/roles-permissions',      visibility: 'admin' },
      { label: 'Ministries & Departments', labelKey: 'nav.ministries_departments', icon: Building2,     path: '/admin/ministries-departments', visibility: 'admin' },
      { label: 'PSC Form Types',           labelKey: 'nav.form_types',             icon: ClipboardList, path: '/admin/form-types',             visibility: 'admin' },
      { label: 'API Keys',                 labelKey: 'nav.api_keys',               icon: Lock,         path: '/admin/api-keys',               visibility: 'roles' },
      { label: 'System Config',            labelKey: 'nav.system_config',          icon: Settings,     path: '/admin/system-config',          visibility: 'roles' },
      { label: 'Email templates',          labelKey: 'nav.email_templates',        icon: Mail,         path: '/admin/email-templates',        visibility: 'roles' },
      { label: 'UI translations',          labelKey: 'nav.ui_translations',        icon: Languages,    path: '/admin/ui-translations',        visibility: 'translations' },
      { label: 'Knowledge Base',         labelKey: 'nav.knowledge_base',         icon: BookOpen,     path: '/admin/knowledge-base',         visibility: 'admin' },
      { label: 'Security',                 labelKey: 'nav.security',               icon: ShieldAlert,  path: '/admin/security',               visibility: 'audit' },
      { label: 'User Feedback',            labelKey: 'nav.feedback',               icon: MessageSquare, path: '/admin/feedback',              visibility: 'feedback' },
      { label: 'Backup & Restore',         labelKey: 'nav.backup_restore',         icon: HardDrive,    path: '/admin/backup-restore',         visibility: 'roles' },
    ],
  },
]

export function translateLabel(entry, t) {
  if (!entry) return ''
  const key = entry.labelKey || entry.groupKey
  const fallback = entry.label ?? entry.group ?? ''
  if (!t || !key) return fallback
  const translated = t(key)
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

export function getVisibleMenuForUser(user, feedbackEnabled = true) {
  return menuItems
    .map((group) => {
      if (!menuItemVisibleForUser({ audience: group.audience ?? 'all' }, user)) {
        return null
      }

      if (group.adminAccess) {
        if (!user) return null
        const showGroup =
          userCanAccessAdminPanel(user) || userCanViewAuditLog(user)
        if (!showGroup) return null
        const items = group.items.filter((item) => {
          if (!menuItemVisibleForUser(item, user)) return false
          const vis = item.visibility ?? 'admin'
          if (vis === 'admin') return userCanAccessAdminPanel(user)
          if (vis === 'roles') return userCanManageRoles(user)
          if (vis === 'audit') return userCanViewAuditLog(user)
          if (vis === 'feedback') {
            if (!feedbackEnabled) return false
            return userCanManageFeedback(user)
          }
          if (vis === 'translations') return userCanManageTranslations(user)
          return true
        })
        if (items.length === 0) return null
        return { ...group, items }
      }

      const items = group.items.filter((item) => menuItemVisibleForUser(item, user))
      if (items.length === 0) return null
      return { ...group, items }
    })
    .filter(Boolean)
}

export default menuItems

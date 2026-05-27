import {
  LayoutDashboard, FileText, BarChart3, Gavel, CalendarDays, Calendar, ScrollText, Bell, ListTodo, PenLine,
  Shield, ShieldAlert, Building2, Lock, Settings, HardDrive, MessageSquare, ClipboardList,
  Headphones, Mail, FolderOpen, ExternalLink, Bot, BookOpen, Languages, Sparkles,
  TrendingUp, Users, History, BarChart2, CalendarCheck,
  ListChecks,
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
 *
 * Items may have a `children` array to create accordion sub-menus inside a group.
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
    group: 'Commission Decision',
    groupKey: 'nav.group_commission',
    groupIcon: Gavel,
    audience: 'commission_decision',
    items: [
      {
        label: 'Meetings',
        labelKey: 'nav.sub_meetings',
        icon: CalendarDays,
        audience: 'secretariat',
        children: [
          { label: 'Meeting room',  labelKey: 'nav.meeting_room', icon: Headphones,   path: '/secretariat/meeting-room', audience: 'secretariat' },
          { label: 'Meetings',      labelKey: 'nav.meetings',     icon: CalendarDays, path: '/secretariat/meetings',     audience: 'secretariat' },
        ],
      },
      {
        label: 'Minutes & Agenda',
        labelKey: 'nav.sub_minutes_agenda',
        icon: FileText,
        children: [
          { label: 'Agenda',        labelKey: 'nav.agenda',        icon: ScrollText, path: '/secretariat/agenda',        audience: 'secretariat' },
          { label: 'Minutes',       labelKey: 'nav.minutes',       icon: FileText,   path: '/secretariat/minutes',       audience: 'commission_decision' },
          { label: 'Minute intake', labelKey: 'nav.minute_intake', icon: PenLine,    path: '/secretariat/minute-intake', audience: 'secretariat' },
        ],
      },
      {
        label: 'Outcomes',
        labelKey: 'nav.sub_outcomes',
        icon: Gavel,
        children: [
          { label: 'Decisions',               labelKey: 'nav.decisions',     icon: Gavel,    path: '/secretariat/decisions',     audience: 'secretariat' },
          { label: 'Minutes decision tasks',  labelKey: 'nav.minutes_tasks', icon: ListTodo, path: '/secretariat/tasks',         audience: 'commission_decision' },
          { label: 'Notifications',           labelKey: 'nav.notifications', icon: Bell,     path: '/secretariat/notifications', audience: 'secretariat' },
        ],
      },
    ],
  },
  {
    group: 'Operations',
    groupKey: 'nav.group_operations',
    groupIcon: TrendingUp,
    audience: 'secretariat',
    opsAccess: true,
    items: [
      { label: 'Executive Dashboard', labelKey: 'nav.executive_dashboard', icon: LayoutDashboard, path: '/executive-dashboard', visibility: 'ops' },
      { label: 'Commission Calendar', labelKey: 'nav.calendar',            icon: CalendarCheck,   path: '/calendar',           visibility: 'ops' },
      { label: 'Workload',            labelKey: 'nav.workload',            icon: Users,           path: '/workload',           visibility: 'ops' },
      { label: 'Audit Trail',         labelKey: 'nav.audit_trail',         icon: History,         path: '/audit-trail',        visibility: 'audit' },
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
      { label: 'Staff Assistant',   labelKey: 'nav.staff_assistant', icon: Bot,   path: '/assistant' },
      { label: 'Analytics',         labelKey: 'nav.analytics',     icon: BarChart2, path: '/analytics',
        audience: 'exclude_compliance' },
    ],
  },
  {
    group: 'Administration',
    groupKey: 'nav.group_admin',
    groupIcon: Shield,
    adminAccess: true,
    audience: 'exclude_compliance',
    items: [
      {
        label: 'Access Control',
        labelKey: 'nav.sub_access_control',
        icon: Shield,
        children: [
          { label: 'Roles & Permissions',      labelKey: 'nav.roles_permissions',      icon: Shield,        path: '/admin/roles-permissions',      visibility: 'admin' },
          { label: 'Ministries & Departments', labelKey: 'nav.ministries_departments', icon: Building2,     path: '/admin/ministries-departments', visibility: 'admin' },
          { label: 'PSC Form Types',           labelKey: 'nav.form_types',             icon: ClipboardList, path: '/admin/form-types',             visibility: 'admin' },
          { label: 'Agenda sections',          labelKey: 'nav.agenda_sections',        icon: ListChecks,    path: '/admin/agenda-sections',        visibility: 'admin' },
          { label: 'Agenda section forms',     labelKey: 'nav.agenda_section_forms',   icon: FileText,      path: '/admin/agenda-section-forms',   visibility: 'admin' },
        ],
      },
      {
        label: 'Content',
        labelKey: 'nav.sub_content',
        icon: BookOpen,
        children: [
          { label: 'Knowledge Base',  labelKey: 'nav.knowledge_base',  icon: BookOpen,  path: '/admin/knowledge-base',  visibility: 'admin' },
          { label: 'Email templates', labelKey: 'nav.email_templates', icon: Mail,      path: '/admin/email-templates', visibility: 'roles' },
          { label: 'Daily Brief',     labelKey: 'nav.daily_brief',     icon: Calendar,  path: '/admin/daily-brief',     visibility: 'roles' },
          { label: 'UI translations', labelKey: 'nav.ui_translations', icon: Languages, path: '/admin/ui-translations', visibility: 'translations' },
        ],
      },
      {
        label: 'System',
        labelKey: 'nav.sub_system',
        icon: Settings,
        children: [
          { label: 'API Keys',        labelKey: 'nav.api_keys',      icon: Lock,      path: '/admin/api-keys',      visibility: 'roles' },
          { label: 'System Config',   labelKey: 'nav.system_config', icon: Settings,  path: '/admin/system-config', visibility: 'roles' },
          { label: 'Backup & Restore',labelKey: 'nav.backup_restore',icon: HardDrive, path: '/admin/backup-restore',visibility: 'roles' },
        ],
      },
      { label: 'Security',    labelKey: 'nav.security', icon: ShieldAlert,   path: '/admin/security', visibility: 'audit' },
      { label: 'User Feedback',labelKey: 'nav.feedback', icon: MessageSquare, path: '/admin/feedback', visibility: 'feedback' },
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
    if (item.children) item.children.forEach(c => { if (c.path) paths.push(c.path) })
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

/** Check whether a single item passes its visibility rule for adminAccess groups */
function passesAdminVisibility(vis, user, feedbackEnabled) {
  if (vis === 'admin') return userCanAccessAdminPanel(user)
  if (vis === 'roles') return userCanManageRoles(user)
  if (vis === 'audit') return userCanViewAuditLog(user)
  if (vis === 'feedback') return feedbackEnabled && userCanManageFeedback(user)
  if (vis === 'translations') return userCanManageTranslations(user)
  return true
}

/** Filter a single admin item (may have children) */
function filterAdminItem(item, user, feedbackEnabled) {
  if (!menuItemVisibleForUser(item, user)) return null

  if (item.children) {
    // Parent sub-menu: keep it if at least one child is visible
    const visibleChildren = item.children.filter(child => {
      if (!menuItemVisibleForUser(child, user)) return false
      return passesAdminVisibility(child.visibility ?? 'admin', user, feedbackEnabled)
    })
    if (visibleChildren.length === 0) return null
    return { ...item, children: visibleChildren }
  }

  // Leaf item
  return passesAdminVisibility(item.visibility ?? 'admin', user, feedbackEnabled) ? item : null
}

export function getVisibleMenuForUser(user, feedbackEnabled = true) {
  return menuItems
    .map((group) => {
      if (!menuItemVisibleForUser({ audience: group.audience ?? 'all' }, user)) {
        return null
      }

      if (group.opsAccess) {
        if (!user) return null
        const items = group.items.filter((item) => {
          if (!menuItemVisibleForUser(item, user)) return false
          const vis = item.visibility ?? 'ops'
          if (vis === 'ops') return true  // visible to all secretariat users
          if (vis === 'audit') return userCanViewAuditLog(user)
          return true
        })
        if (items.length === 0) return null
        return { ...group, items }
      }

      if (group.adminAccess) {
        if (!user) return null
        const showGroup =
          userCanAccessAdminPanel(user) || userCanViewAuditLog(user) || userCanManageFeedback(user)
        if (!showGroup) return null
        const items = group.items
          .map(item => filterAdminItem(item, user, feedbackEnabled))
          .filter(Boolean)
        if (items.length === 0) return null
        return { ...group, items }
      }

      const items = group.items
        .map((item) => {
          if (!menuItemVisibleForUser(item, user)) return null
          if (item.children) {
            const children = item.children.filter((c) => menuItemVisibleForUser(c, user))
            if (children.length === 0) return null
            return { ...item, children }
          }
          return item
        })
        .filter(Boolean)
      if (items.length === 0) return null
      return { ...group, items }
    })
    .filter(Boolean)
}

export default menuItems

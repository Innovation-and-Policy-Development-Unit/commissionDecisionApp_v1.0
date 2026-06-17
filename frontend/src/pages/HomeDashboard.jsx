import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, Building2 } from 'lucide-react'
import PscDashboard from './psc/PscDashboard'
import { useAuth } from '../context/AuthContext'
import { PageSkeleton } from '../components/shared/Skeleton'
import { isComplianceRole, isReadOnlyComplianceRole } from '../constants/compliance'
import ComplianceDashboardPanel from './psc/ComplianceDashboardPanel'

// The ministry dashboard is code-split — only loaded for ministry / admin users.
const MinistryDashboard = lazy(() => import('./ministry/MinistryDashboard'))

const ADMIN_VIEWS = [
  { key: 'psc',      labelKey: 'home_dashboard.view_psc',      fallback: 'PSC Dashboard',      icon: LayoutDashboard },
  { key: 'ministry', labelKey: 'home_dashboard.view_ministry', fallback: 'Ministry Dashboard', icon: Building2 },
]

function renderView(view) {
  if (view === 'ministry') {
    return <Suspense fallback={<PageSkeleton />}><MinistryDashboard /></Suspense>
  }
  return <PscDashboard />
}

/**
 * Role-aware home dashboard. Ministry users (Head of Agency / Ministry HR) share
 * one ministry dashboard scoped to their own ministry; admins can switch between
 * the PSC and ministry views; everyone else keeps the PSC dashboard. Data scoping
 * is enforced server-side, so this only selects the presentation.
 */
export default function HomeDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [adminView, setAdminView] = useState('psc')

  const role = user?.role
  const isAdmin = role === 'psc_admin' || user?.is_superuser || user?.is_staff

  // Both ministry roles share the same scoped ministry dashboard.
  if (role === 'head_of_agency' || role === 'ministry_hr') return renderView('ministry')

  // All compliance-adjacent roles (staff + read-only) see the compliance dashboard.
  if (isComplianceRole(role)) return <PscDashboard />

  // Non-admin PSC/internal users: the default dashboard only.
  if (!isAdmin) return <PscDashboard />

  // Admins can preview both dashboards via a switcher.
  return (
    <div className="space-y-4">
      <div
        className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit"
        role="group"
        aria-label={t('home_dashboard.switcher_label', { defaultValue: 'Dashboard view' })}
      >
        {ADMIN_VIEWS.map(({ key, labelKey, fallback, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setAdminView(key)}
            aria-pressed={adminView === key}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              adminView === key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Icon size={15} />
            {t(labelKey, { defaultValue: fallback })}
          </button>
        ))}
      </div>
      {renderView(adminView)}
    </div>
  )
}

import { ListTodo, FileText, TrendingUp } from 'lucide-react'
import PageTabs from '../shared/PageTabs'
import { useAuth } from '../../context/AuthContext'
import { userIsCommissionDecisionOps, userIsSecretariatStaff } from '../../utils/complianceAccess'

/**
 * One job, three screens: work the decisions, table the progress at the next
 * sitting, and see whether implementation is getting faster. They used to be
 * three separate menu entries ("Decision tasks", "Decision implementation
 * report", "Implementation"), which read as three unrelated features.
 *
 * The routes are unchanged — /secretariat/tasks in particular is baked into
 * backend notification and e-mail links.
 */
export function useImplementationTabs() {
  const { user } = useAuth()
  const isSecretariat = userIsSecretariatStaff(user)
  const worksDecisions = isSecretariat || userIsCommissionDecisionOps(user)

  return [
    worksDecisions && { to: '/secretariat/tasks', label: 'Register', icon: ListTodo },
    worksDecisions && { to: '/secretariat/implementation-report', label: 'Report to Secretary', icon: FileText },
    isSecretariat && { to: '/implementation', label: 'Performance', icon: TrendingUp },
  ].filter(Boolean)
}

export default function ImplementationTabs({ className }) {
  return <PageTabs tabs={useImplementationTabs()} className={className} />
}

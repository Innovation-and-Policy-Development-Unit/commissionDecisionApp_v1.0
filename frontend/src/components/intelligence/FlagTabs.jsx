import { Flag, ShieldAlert } from 'lucide-react'
import PageTabs from '../shared/PageTabs'
import { useAuth } from '../../context/AuthContext'
import { userCanManageRoles } from '../../utils/adminAccess'

/**
 * Two kinds of flag, one place to look at them: submissions the rule engine
 * thinks are at risk, and submissions the nightly sweep found in a state the
 * workflow should not allow. They used to sit in different menu groups.
 */
export default function FlagTabs({ className }) {
  const { user } = useAuth()

  const tabs = [
    { to: '/intelligence/flags', label: 'At risk', icon: Flag },
    userCanManageRoles(user) && { to: '/integrity-flags', label: 'Integrity', icon: ShieldAlert },
  ].filter(Boolean)

  return <PageTabs tabs={tabs} className={className} />
}

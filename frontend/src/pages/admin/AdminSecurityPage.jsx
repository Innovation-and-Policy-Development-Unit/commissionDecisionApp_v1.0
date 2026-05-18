import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { userCanViewAuditLog, userIsAdmin } from '../../utils/adminAccess'
import SecurityTab from './SecurityTab'

export default function AdminSecurityPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && !userCanViewAuditLog(user)) navigate('/', { replace: true })
  }, [user, navigate])

  if (!user || !userCanViewAuditLog(user)) return null

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Security</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Audit trail, vulnerability checks, and incident response.
        </p>
      </div>
      <SecurityTab isAdmin={userIsAdmin(user)} />
    </div>
  )
}

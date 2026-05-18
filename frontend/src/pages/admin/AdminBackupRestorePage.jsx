import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { userCanManageRoles } from '../../utils/adminAccess'
import { BackupTab } from './AdminPanel'

export default function AdminBackupRestorePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && !userCanManageRoles(user)) navigate('/', { replace: true })
  }, [user, navigate])

  if (!user || !userCanManageRoles(user)) return null

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Backup &amp; restore</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Manual and scheduled database backups, downloads, and restore operations.
        </p>
      </div>
      <BackupTab />
    </div>
  )
}

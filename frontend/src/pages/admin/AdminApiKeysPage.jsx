import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { userCanManageRoles } from '../../utils/adminAccess'
import { APIKeysTab } from './AdminPanel'

export default function AdminApiKeysPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [apiKeys, setApiKeys] = useState([])
  const [loadingData, setLoadingData] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoadingData(true)
    try {
      const settled = await Promise.allSettled([
        api.get('/users/'),
        api.get('/api-keys/'),
      ])
      setUsers(settled[0].status === 'fulfilled' ? settled[0].value.data : [])
      setApiKeys(settled[1].status === 'fulfilled' ? settled[1].value.data : [])
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (user && !userCanManageRoles(user)) navigate('/', { replace: true })
  }, [user, navigate])

  if (!user || !userCanManageRoles(user)) return null

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">API Keys</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage programmatic access to the SCDMS API. Keys inherit the permissions of their owner user.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchAll}
          disabled={loadingData}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          aria-label="Refresh data"
        >
          <RefreshCw size={15} className={loadingData ? 'animate-spin' : ''} />
        </button>
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm gap-2">
          <RefreshCw size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <APIKeysTab apiKeys={apiKeys} users={users} onRefresh={fetchAll} />
      )}
    </div>
  )
}

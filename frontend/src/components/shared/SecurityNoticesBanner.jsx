import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, Info, Shield, X } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'

const TYPE_META = {
  info:        { icon: Info,          bg: 'bg-blue-50 dark:bg-blue-900/30',    border: 'border-blue-200 dark:border-blue-700',    text: 'text-blue-800 dark:text-blue-200',    close: 'hover:bg-blue-100 dark:hover:bg-blue-800/40 text-blue-500'   },
  warning:     { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-900/30',  border: 'border-amber-200 dark:border-amber-700',  text: 'text-amber-800 dark:text-amber-200',  close: 'hover:bg-amber-100 dark:hover:bg-amber-800/40 text-amber-500' },
  critical:    { icon: AlertCircle,   bg: 'bg-red-50 dark:bg-red-900/30',      border: 'border-red-200 dark:border-red-700',      text: 'text-red-800 dark:text-red-200',      close: 'hover:bg-red-100 dark:hover:bg-red-800/40 text-red-500'       },
  maintenance: { icon: Shield,        bg: 'bg-violet-50 dark:bg-violet-900/30',border: 'border-violet-200 dark:border-violet-700',text: 'text-violet-800 dark:text-violet-200',close: 'hover:bg-violet-100 dark:hover:bg-violet-800/40 text-violet-500'},
}

const DISMISSED_KEY = 'psc-dismissed-notices'

function getDismissed() {
  try { return new Set(JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]')) }
  catch { return new Set() }
}

function addDismissed(id) {
  const s = getDismissed()
  s.add(id)
  sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...s]))
}

export default function SecurityNoticesBanner() {
  const { accessToken } = useAuth()
  const [notices,   setNotices]   = useState([])
  const [dismissed, setDismissed] = useState(() => getDismissed())

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await api.get('/security-notices/')
      setNotices(Array.isArray(res.data) ? res.data : [])
    } catch { /* silent — banner is non-critical */ }
  }, [accessToken])

  useEffect(() => { load() }, [load])

  function dismiss(id) {
    addDismissed(id)
    setDismissed(new Set([...dismissed, id]))
  }

  const visible = notices.filter(n => !dismissed.has(n.id))

  if (!visible.length) return null

  return (
    <div className="px-4 sm:px-6 pt-4 space-y-2 max-w-screen-2xl mx-auto">
      {visible.map(notice => {
        const meta = TYPE_META[notice.notice_type] || TYPE_META.info
        const Icon = meta.icon
        return (
          <div
            key={notice.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${meta.bg} ${meta.border}`}
          >
            <Icon size={16} className={`${meta.text} mt-0.5 flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${meta.text}`}>{notice.title}</p>
              <p className={`text-xs mt-0.5 ${meta.text} opacity-80`}>{notice.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(notice.id)}
              title="Dismiss"
              className={`flex-shrink-0 p-1 rounded-lg transition-colors ${meta.close}`}
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

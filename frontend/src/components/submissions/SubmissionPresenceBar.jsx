import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import api from '../../api/client'
import { useVisibilityAwareInterval } from '../../hooks/useVisibilityAwareInterval'

const HEARTBEAT_MS = 30_000

function initials(name) {
  return (name || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
}

function presenceStatusLabel(t, viewers) {
  const others = viewers.filter((v) => !v.is_self)
  if (others.length === 0) return null
  if (others.length === 1) return t('presence.reviewing_single', { name: others[0].display_name })
  return t('presence.reviewing_multiple', { name: others[0].display_name, count: others.length - 1 })
}

function ViewerAvatar({ viewer, presence = false }) {
  return (
    <div className="relative" title={`${viewer.display_name}${viewer.role_label ? ` · ${viewer.role_label}` : ''}`}>
      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200 flex items-center justify-center text-[11px] font-semibold border-2 border-white dark:border-slate-900 overflow-hidden">
        {viewer.profile_picture
          ? <img src={viewer.profile_picture} alt="" className="w-full h-full object-cover" />
          : initials(viewer.display_name)}
      </div>
      {presence && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />}
    </div>
  )
}

/** Real-time awareness bar — 30s heartbeat polling (no WebSockets). */
export default function SubmissionPresenceBar({ submissionId }) {
  const { t } = useTranslation()
  const [viewers, setViewers] = useState([])

  const sendHeartbeat = useCallback(async () => {
    if (!submissionId) return
    try {
      const res = await api.post(`/submissions/${submissionId}/presence/heartbeat/`)
      setViewers(res.data.viewers || [])
    } catch { /* non-critical */ }
  }, [submissionId])

  useEffect(() => {
    if (!submissionId) return undefined
    sendHeartbeat()
    return () => { api.post(`/submissions/${submissionId}/presence/leave/`).catch(() => {}) }
  }, [submissionId, sendHeartbeat])

  useVisibilityAwareInterval(sendHeartbeat, HEARTBEAT_MS, { enabled: Boolean(submissionId), fireOnVisible: false })

  const others = viewers.filter((v) => !v.is_self)
  const statusText = presenceStatusLabel(t, viewers)
  if (!submissionId) return null

  return (
    <div
      className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl px-4 py-3 border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
      role="status" aria-live="polite" aria-label={t('presence.aria_bar')}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Users size={20} className="text-primary-500 shrink-0" aria-hidden="true" />
        {others.length > 0 ? (
          <div className="flex items-center -space-x-2">
            {others.slice(0, 5).map((viewer) => (
              <ViewerAvatar key={viewer.user_id} viewer={viewer} presence />
            ))}
            {others.length > 5 && (
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold border-2 border-white dark:border-slate-900 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                +{others.length - 5}
              </span>
            )}
          </div>
        ) : (
          <ViewerAvatar viewer={{ display_name: viewers.find((v) => v.is_self)?.display_name || 'You' }} />
        )}
      </div>
      <span className="min-w-0 text-sm text-slate-600 dark:text-slate-300">
        {statusText || t('presence.only_you')}
      </span>
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Avatar,
  PresenceBadge,
  Text,
  tokens,
} from '@fluentui/react-components'
import { PeopleTeamRegular } from '@fluentui/react-icons'
import api from '../../api/client'

const HEARTBEAT_MS = 30_000

function presenceStatusLabel(t, viewers) {
  const others = viewers.filter((v) => !v.is_self)
  if (others.length === 0) return null
  if (others.length === 1) {
    return t('presence.reviewing_single', { name: others[0].display_name })
  }
  return t('presence.reviewing_multiple', {
    name: others[0].display_name,
    count: others.length - 1,
  })
}

/**
 * Real-time awareness bar — 30s heartbeat polling (no WebSockets).
 */
export default function SubmissionPresenceBar({ submissionId }) {
  const { t } = useTranslation()
  const [viewers, setViewers] = useState([])

  const sendHeartbeat = useCallback(async () => {
    if (!submissionId) return
    try {
      const res = await api.post(`/submissions/${submissionId}/presence/heartbeat/`)
      setViewers(res.data.viewers || [])
    } catch {
      /* non-critical */
    }
  }, [submissionId])

  useEffect(() => {
    if (!submissionId) return undefined
    sendHeartbeat()
    const id = setInterval(sendHeartbeat, HEARTBEAT_MS)
    return () => {
      clearInterval(id)
      api.post(`/submissions/${submissionId}/presence/leave/`).catch(() => {})
    }
  }, [submissionId, sendHeartbeat])

  const others = viewers.filter((v) => !v.is_self)
  const statusText = presenceStatusLabel(t, viewers)

  if (!submissionId) return null

  return (
    <div
      className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl px-4 py-3 border"
      style={{
        backgroundColor: tokens.colorNeutralBackground1,
        borderColor: tokens.colorNeutralStroke2,
      }}
      role="status"
      aria-live="polite"
      aria-label={t('presence.aria_bar')}
    >
      <div className="flex items-center gap-2 min-w-0">
        <PeopleTeamRegular
          fontSize={20}
          style={{ color: tokens.colorBrandForeground1 }}
          aria-hidden
        />
        {others.length > 0 ? (
          <div className="flex items-center -space-x-2">
            {others.slice(0, 5).map((viewer) => (
              <PresenceBadge key={viewer.user_id} status="available" size="small">
                <Avatar
                  name={viewer.display_name}
                  image={viewer.profile_picture ? { src: viewer.profile_picture } : undefined}
                  size={32}
                  title={`${viewer.display_name}${viewer.role_label ? ` · ${viewer.role_label}` : ''}`}
                />
              </PresenceBadge>
            ))}
            {others.length > 5 && (
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold border-2 border-white dark:border-slate-900"
                style={{
                  backgroundColor: tokens.colorNeutralBackground3,
                  color: tokens.colorNeutralForeground2,
                }}
              >
                +{others.length - 5}
              </span>
            )}
          </div>
        ) : (
          <Avatar
            name={viewers.find((v) => v.is_self)?.display_name || 'You'}
            size={32}
            title={t('presence.only_you')}
          />
        )}
      </div>

      <Text
        size={300}
        className="min-w-0"
        style={{ color: tokens.colorNeutralForeground2 }}
      >
        {statusText || t('presence.only_you')}
      </Text>
    </div>
  )
}

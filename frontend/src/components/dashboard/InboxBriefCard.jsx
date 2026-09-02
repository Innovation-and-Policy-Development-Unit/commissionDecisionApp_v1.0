import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sparkles, X, ChevronDown, ChevronUp } from 'lucide-react'
import api from '../../api/client'

const GROUP_LABEL_KEYS = {
  needs_action: 'inbox_brief.group_needs_action',
  due_today: 'inbox_brief.group_due_today',
  meetings_today: 'inbox_brief.group_meetings_today',
  fyi: 'inbox_brief.group_fyi',
}

function dismissedKey(dateLabel, variant) {
  return `inbox_brief_dismissed_${dateLabel}_${variant}`
}

/**
 * Outlook-Focused-Inbox-style AI briefing card: one line of rollup text,
 * dismissible for the day, expands in place to the grouped breakdown that
 * powers the /api/daily-brief/mine/ endpoint (same data as the staff email
 * brief, grouped by action needed instead of rendered as an email).
 */
export default function InboxBriefCard() {
  const { t } = useTranslation()
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const variant = useMemo(() => (new Date().getHours() < 14 ? 'morning' : 'wrapup'), [])
  const dateLabel = useMemo(() => new Date().toISOString().slice(0, 10), [])

  useEffect(() => {
    try {
      if (localStorage.getItem(dismissedKey(dateLabel, variant)) === '1') {
        setDismissed(true)
      }
    } catch {
      // localStorage unavailable — just don't persist dismissal
    }

    let cancelled = false
    api
      .get('/daily-brief/mine/')
      .then(r => { if (!cancelled) setBrief(r.data) })
      .catch(() => { if (!cancelled) setBrief(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [dateLabel, variant])

  if (loading || !brief || dismissed) return null

  const title = t(variant === 'morning' ? 'inbox_brief.morning_title' : 'inbox_brief.wrapup_title')
  const subtitle = brief.is_empty
    ? t('inbox_brief.empty_sub')
    : t('inbox_brief.rollup', { count: brief.total_items })

  const handleDismiss = e => {
    e.stopPropagation()
    setDismissed(true)
    try {
      localStorage.setItem(dismissedKey(dateLabel, variant), '1')
    } catch {
      // ignore — worst case the card reappears on reload
    }
  }

  return (
    <div className="card card-compact overflow-hidden">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          disabled={brief.is_empty}
          className="flex-1 min-w-0 flex items-start gap-3 text-left disabled:cursor-default"
        >
          <span className="mt-0.5 shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400">
            <Sparkles size={16} aria-hidden="true" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</span>
          </span>
          {!brief.is_empty && (
            <span className="mt-1 shrink-0 text-slate-400 dark:text-slate-500">
              {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('inbox_brief.dismiss')}
          className="mt-0.5 shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {expanded && !brief.is_empty && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
          {brief.groups.map(group => (
            <div key={group.key}>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                {t(GROUP_LABEL_KEYS[group.key] || group.key)} ({group.count})
              </p>
              <ul className="space-y-1">
                {group.items.map(item => (
                  <li key={item.id}>
                    <Link
                      to={item.url}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {brief.suggested_actions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                {t('inbox_brief.suggested_actions')}
              </p>
              <ul className="list-disc list-inside space-y-1">
                {brief.suggested_actions.map((action, i) => (
                  <li key={i} className="text-xs text-slate-700 dark:text-slate-300">{action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

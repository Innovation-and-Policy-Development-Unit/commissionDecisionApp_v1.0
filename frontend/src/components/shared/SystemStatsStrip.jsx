import { useEffect, useState } from 'react'
import { ShieldCheck, Sparkles, TrendingUp, X } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'

const DISMISSED_KEY = 'psc-stats-strip-dismissed'

/**
 * Slim, persistent strip showing three real (recomputed, not decorative)
 * system-wide numbers — visible to every role, ministry and OPSC alike.
 * Fails silently: if the endpoint errors or returns nothing meaningful,
 * the strip just doesn't render. Dismissible; stays dismissed (localStorage)
 * so it doesn't nag a returning user.
 */
export default function SystemStatsStrip() {
  const { accessToken } = useAuth()
  const [stats, setStats] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISSED_KEY) === '1' }
    catch { return false }
  })

  useEffect(() => {
    if (!accessToken || dismissed) return
    let cancelled = false
    api.get('/system-stats/')
      .then(res => { if (!cancelled) setStats(res.data) })
      .catch(() => { /* silent — decorative, never show an error state */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, dismissed])

  if (dismissed || !stats) return null

  const items = [
    stats.decisions_verified > 0 && {
      icon: ShieldCheck,
      value: stats.decisions_verified.toLocaleString(),
      label: `Commission decision${stats.decisions_verified === 1 ? '' : 's'} cryptographically verified this year`,
    },
    stats.ai_assisted_pct !== null && stats.ai_assisted_pct !== undefined && {
      icon: Sparkles,
      value: `${stats.ai_assisted_pct}%`,
      label: 'of submissions AI-assisted this month',
    },
    stats.sla_compliance_pct !== null && stats.sla_compliance_pct !== undefined && {
      icon: TrendingUp,
      value: `${stats.sla_compliance_pct}%`,
      label: 'on-time performance',
    },
  ].filter(Boolean)

  if (items.length === 0) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-9 flex items-center gap-5 text-xs text-slate-500 dark:text-slate-400 overflow-x-auto">
        {items.map(({ icon: Icon, value, label }, i) => (
          <span key={i} className="flex items-center gap-1.5 whitespace-nowrap">
            <Icon size={13} className="text-primary-500/70 dark:text-primary-400/70 shrink-0" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">{value}</span>
            <span className="hidden sm:inline">{label}</span>
          </span>
        ))}
        <button
          type="button"
          onClick={dismiss}
          title="Dismiss"
          className="ml-auto shrink-0 p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}

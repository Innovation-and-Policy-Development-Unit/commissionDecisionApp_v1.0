/**
 * Flag Monitor — FlagGuard-style at-risk view of submissions.
 *
 * KPI cards by flag level (critical / at-risk / monitoring), a filterable table
 * of open flags (RBAC-scoped server-side), and acknowledge / clear actions.
 */
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Flag, AlertOctagon, AlertTriangle, Eye, Loader2, RefreshCw, Check, X, SlidersHorizontal, Download,
} from 'lucide-react'
import { rulesApi } from '../../api/rules'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/shared/PageHeader'

const LEVELS = [
  { key: 'critical', label: 'Critical', Icon: AlertOctagon, cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300', dot: 'bg-red-500' },
  { key: 'at_risk', label: 'At risk', Icon: AlertTriangle, cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300', dot: 'bg-amber-500' },
  { key: 'monitoring', label: 'Monitoring', Icon: Eye, cls: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300', dot: 'bg-slate-400' },
]
const LEVEL_MAP = Object.fromEntries(LEVELS.map(l => [l.key, l]))
const ENTITIES = [
  { key: 'submission', label: 'Submissions' },
  { key: 'commission_task', label: 'Tasks' },
  { key: 'meeting', label: 'Meetings' },
]
const ENTITY_LABEL = { submission: 'Submission', commission_task: 'Task', meeting: 'Meeting' }

export default function FlagMonitor() {
  const { t } = useTranslation()
  const toast = useToast()
  const { user } = useAuth()
  const isAdmin = ['psc_admin', 'psc_manager'].includes(user?.role) || user?.is_staff

  const [data, setData] = useState({ flags: [], summary: {} })
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [level, setLevel] = useState('')
  const [ruleId, setRuleId] = useState('')
  const [statusF, setStatusF] = useState('')
  const [entity, setEntity] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (level) params.level = level
      if (ruleId) params.rule = ruleId
      if (statusF) params.status = statusF
      if (entity) params.entity = entity
      setData(await rulesApi.flags(params))
    } catch { toast.error(t('rules.flags_load_failed', { defaultValue: 'Could not load flags' })) }
    finally { setLoading(false) }
  }, [level, ruleId, statusF, entity, t, toast])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (isAdmin) rulesApi.rules().then(d => setRules(d.rules || [])).catch(() => {}) }, [isAdmin])

  const runNow = async () => {
    setBusy(true)
    try { const s = await rulesApi.runRules(); toast.success(t('rules.ran', { defaultValue: `Evaluated — ${s.opened} opened, ${s.cleared} cleared` })); load() }
    catch { toast.error(t('rules.run_failed', { defaultValue: 'Could not run rules' })) }
    finally { setBusy(false) }
  }

  const acknowledge = async (f) => {
    try { await rulesApi.acknowledgeFlag(f.id); load() }
    catch { toast.error(t('rules.ack_failed', { defaultValue: 'Could not acknowledge' })) }
  }
  const clear = async (f) => {
    try { await rulesApi.clearFlag(f.id); load() }
    catch { toast.error(t('rules.clear_failed', { defaultValue: 'Could not clear' })) }
  }

  const exportCsv = async () => {
    try {
      const params = {}
      if (level) params.level = level
      if (entity) params.entity = entity
      if (ruleId) params.rule = ruleId
      if (statusF) params.status = statusF
      const blob = await rulesApi.exportFlags(params)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `scdms-flags-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch { toast.error(t('rules.export_failed', { defaultValue: 'Could not export' })) }
  }

  const summary = data.summary || {}

  return (
    <div className="max-w-screen-2xl mx-auto space-y-4 pb-10">
      <PageHeader
        title={t('rules.flag_monitor', { defaultValue: 'Flag Monitor' })}
        subtitle={t('rules.flag_monitor_sub', { defaultValue: 'At-risk submissions raised by the rule engine.' })}
        action={
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} disabled={!data.flags?.length} className="btn-outline flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-40"><Download size={14} /> {t('rules.export', { defaultValue: 'Export CSV' })}</button>
            {isAdmin && <Link to="/intelligence/rules" className="btn-outline flex items-center gap-2 px-3 py-2 text-sm"><SlidersHorizontal size={15} /> {t('rules.rules', { defaultValue: 'Rules' })}</Link>}
            {isAdmin && <button onClick={runNow} disabled={busy} className="btn-outline flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> {t('rules.run_now', { defaultValue: 'Run now' })}</button>}
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {LEVELS.map(l => (
          <button key={l.key} onClick={() => setLevel(level === l.key ? '' : l.key)}
            className={`card p-4 text-left border ${level === l.key ? 'ring-2 ring-primary-400' : ''} ${l.cls}`}>
            <div className="flex items-center justify-between">
              <l.Icon size={20} />
              <span className="text-3xl font-bold">{summary[l.key] ?? 0}</span>
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide mt-1">{t(`rules.level_${l.key}`, { defaultValue: l.label })}</div>
          </button>
        ))}
        <div className="card p-4 flex flex-col justify-center">
          <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">{summary.total ?? 0}</span>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-1">{t('rules.total_open', { defaultValue: 'Total open' })}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex items-center gap-2 flex-wrap text-sm">
        <Flag size={14} className="text-slate-400" />
        <select value={entity} onChange={(e) => setEntity(e.target.value)} className="input py-1.5 text-sm">
          <option value="">{t('rules.all_entities', { defaultValue: 'All types' })}</option>
          {ENTITIES.map(en => <option key={en.key} value={en.key}>{en.label}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="input py-1.5 text-sm">
          <option value="">{t('rules.all_levels', { defaultValue: 'All levels' })}</option>
          {LEVELS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
        </select>
        {isAdmin && (
          <select value={ruleId} onChange={(e) => setRuleId(e.target.value)} className="input py-1.5 text-sm">
            <option value="">{t('rules.all_rules', { defaultValue: 'All rules' })}</option>
            {rules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="input py-1.5 text-sm">
          <option value="">{t('rules.open_and_ack', { defaultValue: 'Open & acknowledged' })}</option>
          <option value="open">{t('rules.status_open', { defaultValue: 'Open' })}</option>
          <option value="acknowledged">{t('rules.status_ack', { defaultValue: 'Acknowledged' })}</option>
        </select>
      </div>

      {/* Top firing rules */}
      {data.by_rule?.length > 0 && (
        <div className="card p-3 flex items-center gap-2 flex-wrap text-xs">
          <span className="text-slate-400 font-semibold uppercase">{t('rules.top_rules', { defaultValue: 'Top rules' })}</span>
          {data.by_rule.map(b => (
            <span key={b.rule} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {b.rule} <strong className="text-slate-800 dark:text-slate-100">{b.count}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16 text-slate-400"><Loader2 className="animate-spin" /></div>
        ) : data.flags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Flag size={28} className="mb-2 opacity-40" />
            <p className="text-sm">{t('rules.no_flags', { defaultValue: 'No open flags. Healthy!' })}</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="px-3 py-2">{t('rules.level', { defaultValue: 'Level' })}</th>
                  <th className="px-3 py-2">{t('rules.type', { defaultValue: 'Type' })}</th>
                  <th className="px-3 py-2">{t('rules.item', { defaultValue: 'Item' })}</th>
                  <th className="px-3 py-2">{t('rules.context', { defaultValue: 'Context' })}</th>
                  <th className="px-3 py-2">{t('rules.state', { defaultValue: 'State' })}</th>
                  <th className="px-3 py-2">{t('rules.rule', { defaultValue: 'Rule' })}</th>
                  <th className="px-3 py-2 text-right">{t('rules.actions', { defaultValue: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody>
                {data.flags.map(f => {
                  const L = LEVEL_MAP[f.level] || LEVEL_MAP.monitoring
                  return (
                    <tr key={f.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5 text-xs font-medium"><span className={`w-2 h-2 rounded-full ${L.dot}`} /> {L.label}{f.status === 'acknowledged' && <span className="text-[10px] text-slate-400">· ack</span>}</span></td>
                      <td className="px-3 py-2"><span className="text-[10px] uppercase font-semibold text-slate-400">{ENTITY_LABEL[f.entity] || f.entity}</span></td>
                      <td className="px-3 py-2">
                        <Link to={f.link || '#'} className="text-primary-600 dark:text-primary-300 hover:underline font-medium">{f.ref}</Link>
                        <div className="text-xs text-slate-400 truncate max-w-[280px]">{f.title}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{f.context}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{String(f.state || '').replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{f.rule_name}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {f.status !== 'acknowledged' && <button onClick={() => acknowledge(f)} title={t('rules.acknowledge', { defaultValue: 'Acknowledge' })} className="p-1.5 rounded text-slate-400 hover:text-primary-600"><Check size={15} /></button>}
                          <button onClick={() => clear(f)} title={t('rules.clear', { defaultValue: 'Clear' })} className="p-1.5 rounded text-slate-400 hover:text-emerald-600"><X size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

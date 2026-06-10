/**
 * Intelligence Reports & Alerts — Superset-style scheduled delivery.
 *
 * Lists the user's scheduled reports/alerts and lets them create/edit one.
 * A report's query is sourced from a saved exploration (or from the explorer
 * via ?ds=&q=). Reports email on a cadence; alerts only email when a metric
 * crosses a threshold. "Run now" force-sends for testing.
 */
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BellRing, FileBarChart, Plus, Trash2, Play, Pencil, Compass, Loader2,
  CheckCircle2, AlertTriangle, CircleDashed, Clock,
} from 'lucide-react'
import { intelligenceApi } from '../../api/intelligence'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import PageHeader from '../../components/shared/PageHeader'
import Modal from '../../components/shared/Modal'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const OPS = [
  { value: 'gt', label: '> greater than' },
  { value: 'gte', label: '≥ at least' },
  { value: 'lt', label: '< less than' },
  { value: 'lte', label: '≤ at most' },
]

function decodeSpec(raw) {
  try { return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(raw))))) }
  catch { return null }
}

function scheduleLabel(r) {
  const hh = String(r.hour).padStart(2, '0') + ':00'
  if (r.frequency === 'weekly') return `Weekly · ${DOW[r.day_of_week] || 'Mon'} ${hh}`
  if (r.frequency === 'monthly') return `Monthly · day ${r.day_of_month} ${hh}`
  return `Daily · ${hh}`
}

const STATUS_BADGE = {
  sent: { cls: 'text-emerald-600', Icon: CheckCircle2 },
  triggered: { cls: 'text-red-600', Icon: AlertTriangle },
  ok: { cls: 'text-slate-400', Icon: CheckCircle2 },
  failed: { cls: 'text-red-600', Icon: AlertTriangle },
  skipped: { cls: 'text-slate-400', Icon: CircleDashed },
}

const EMPTY = {
  id: null, name: '', kind: 'report', source: '', dataset: '', spec: null,
  alert_metric: '', alert_operator: 'gt', alert_threshold: '',
  frequency: 'daily', hour: 7, day_of_week: 0, day_of_month: 1,
  recipients: '', is_active: true,
}

export default function IntelligenceReports() {
  const { t } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()
  const [params] = useSearchParams()

  const [reports, setReports] = useState([])
  const [explorations, setExplorations] = useState([])
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rep, exp, ds] = await Promise.all([
        intelligenceApi.reports(), intelligenceApi.explorations(), intelligenceApi.datasets(),
      ])
      setReports(rep.reports || [])
      setExplorations(exp.explorations || [])
      setDatasets(ds.datasets || [])
    } catch { toast.error(t('intelligence.rep_load_failed', { defaultValue: 'Could not load reports' })) }
    finally { setLoading(false) }
  }, [t, toast])

  useEffect(() => { load() }, [load])

  // Launched from the explorer with ?ds=&q= → open the create form prefilled.
  useEffect(() => {
    const ds = params.get('ds'); const q = params.get('q')
    const spec = q ? decodeSpec(q) : null
    if (ds && spec) {
      setForm({ ...EMPTY, source: 'explorer', dataset: ds, spec, name: '' })
      setOpen(true)
    }
  }, [params])

  const metricsFor = (datasetKey) => (datasets.find(d => d.key === datasetKey)?.metrics) || []

  const pickSource = (value) => {
    if (value === 'explorer') return // keep prefilled dataset/spec
    const exp = explorations.find(e => String(e.id) === String(value))
    setForm(f => ({ ...f, source: value, dataset: exp?.dataset || '', spec: exp?.spec || null }))
  }

  const openCreate = () => { setForm(EMPTY); setOpen(true) }
  const openEdit = (r) => {
    setForm({
      id: r.id, name: r.name, kind: r.kind, source: 'keep', dataset: r.dataset, spec: r.spec,
      alert_metric: r.alert_metric || '', alert_operator: r.alert_operator || 'gt',
      alert_threshold: r.alert_threshold ?? '', frequency: r.frequency, hour: r.hour,
      day_of_week: r.day_of_week, day_of_month: r.day_of_month,
      recipients: (r.recipients || []).join(', '), is_active: r.is_active,
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.name.trim() || !form.dataset || !form.spec) {
      toast.error(t('intelligence.rep_need_source', { defaultValue: 'Pick a name and a saved view as the source.' }))
      return
    }
    const payload = {
      name: form.name.trim(), kind: form.kind, dataset: form.dataset, spec: form.spec,
      frequency: form.frequency, hour: Number(form.hour),
      day_of_week: Number(form.day_of_week), day_of_month: Number(form.day_of_month),
      recipients: form.recipients.split(',').map(s => s.trim()).filter(Boolean),
      is_active: form.is_active,
      alert_metric: form.kind === 'alert' ? form.alert_metric : '',
      alert_operator: form.kind === 'alert' ? form.alert_operator : '',
      alert_threshold: form.kind === 'alert' && form.alert_threshold !== '' ? Number(form.alert_threshold) : null,
    }
    setSaving(true)
    try {
      if (form.id) await intelligenceApi.updateReport(form.id, payload)
      else await intelligenceApi.createReport(payload)
      setOpen(false); load()
      toast.success(t('intelligence.rep_saved', { defaultValue: 'Report saved' }))
    } catch (e) {
      toast.error(e?.response?.data?.detail || Object.values(e?.response?.data || {})[0] || t('intelligence.rep_save_failed', { defaultValue: 'Could not save report' }))
    } finally { setSaving(false) }
  }

  const runNow = async (r) => {
    setRunning(r.id)
    try {
      const res = await intelligenceApi.runReport(r.id)
      const st = res?.report?.last_status
      toast.success(st === 'sent' || st === 'triggered'
        ? t('intelligence.rep_sent', { defaultValue: 'Email sent' })
        : t('intelligence.rep_ran', { defaultValue: `Ran — ${st}` }))
      load()
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('intelligence.rep_run_failed', { defaultValue: 'Could not run report' }))
    } finally { setRunning(null) }
  }

  const toggleActive = async (r) => {
    try { await intelligenceApi.updateReport(r.id, { is_active: !r.is_active }); load() }
    catch { toast.error(t('intelligence.rep_save_failed', { defaultValue: 'Could not update report' })) }
  }

  const remove = async (r) => {
    const ok = await confirm({ title: t('intelligence.delete_report', { defaultValue: 'Delete report?' }), message: r.name, confirmLabel: t('common.delete', { defaultValue: 'Delete' }) })
    if (!ok) return
    try { await intelligenceApi.deleteReport(r.id); load() }
    catch { toast.error(t('intelligence.rep_delete_failed', { defaultValue: 'Could not delete report' })) }
  }

  return (
    <div className="max-w-screen-lg mx-auto space-y-4 pb-10">
      <PageHeader
        title={t('intelligence.reports_title', { defaultValue: 'Reports & Alerts' })}
        subtitle={t('intelligence.reports_subtitle', { defaultValue: 'Schedule emailed reports, or get alerted when a metric crosses a threshold.' })}
        action={
          <div className="flex items-center gap-2">
            <Link to="/intelligence" className="btn-outline flex items-center gap-2 px-3 py-2 text-sm"><Compass size={15} /> {t('intelligence.open_explorer', { defaultValue: 'Explorer' })}</Link>
            <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"><Plus size={16} /> {t('intelligence.new_report', { defaultValue: 'New' })}</button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 className="animate-spin" /></div>
      ) : reports.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-slate-400">
          <BellRing size={32} className="mb-3 opacity-40" />
          <p className="text-sm">{t('intelligence.no_reports', { defaultValue: 'No scheduled reports yet. Create one, or use “Schedule” from the Explorer.' })}</p>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {reports.map(r => {
            const badge = STATUS_BADGE[r.last_status] || {}
            const Icon = badge.Icon
            return (
              <div key={r.id} className="flex items-center gap-3 p-3.5">
                <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${r.kind === 'alert' ? 'bg-red-50 text-red-500 dark:bg-red-900/20' : 'bg-primary-50 text-primary-600 dark:bg-primary-900/30'}`}>
                  {r.kind === 'alert' ? <BellRing size={17} /> : <FileBarChart size={17} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 dark:text-slate-100 truncate">{r.name}</span>
                    {!r.is_active && <span className="text-[10px] uppercase font-semibold text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5">{t('intelligence.paused', { defaultValue: 'Paused' })}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1"><Clock size={11} /> {scheduleLabel(r)}</span>
                    <span>{(r.recipients || []).length} {t('intelligence.recipients', { defaultValue: 'recipients' })}</span>
                    {r.last_status && Icon && (
                      <span className={`flex items-center gap-1 ${badge.cls}`}><Icon size={11} /> {r.last_status}{r.last_value != null ? ` (${r.last_value})` : ''}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => runNow(r)} disabled={running === r.id} title={t('intelligence.run_now', { defaultValue: 'Run now' })} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 disabled:opacity-40">{running === r.id ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}</button>
                  <button onClick={() => toggleActive(r)} title={r.is_active ? t('intelligence.pause', { defaultValue: 'Pause' }) : t('intelligence.resume', { defaultValue: 'Resume' })} className="p-1.5 rounded-md text-slate-400 hover:text-primary-600">{r.is_active ? <CircleDashed size={15} /> : <CheckCircle2 size={15} />}</button>
                  <button onClick={() => openEdit(r)} title={t('common.edit', { defaultValue: 'Edit' })} className="p-1.5 rounded-md text-slate-400 hover:text-primary-600"><Pencil size={15} /></button>
                  <button onClick={() => remove(r)} title={t('common.delete', { defaultValue: 'Delete' })} className="p-1.5 rounded-md text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create / edit modal ──────────────────────────────────────────── */}
      <Modal open={open} title={form.id ? t('intelligence.edit_report', { defaultValue: 'Edit report' }) : t('intelligence.new_report_title', { defaultValue: 'New report / alert' })} onClose={() => setOpen(false)} size="md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('intelligence.rep_name', { defaultValue: 'Name' })}</label>
              <input className="input w-full" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('intelligence.rep_type', { defaultValue: 'Type' })}</label>
              <select className="input w-full" value={form.kind} onChange={(e) => setForm(f => ({ ...f, kind: e.target.value }))}>
                <option value="report">{t('intelligence.type_report', { defaultValue: 'Scheduled report' })}</option>
                <option value="alert">{t('intelligence.type_alert', { defaultValue: 'Alert (threshold)' })}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('intelligence.rep_source', { defaultValue: 'Source view' })}</label>
              {form.source === 'explorer' || form.source === 'keep' ? (
                <div className="input w-full bg-slate-50 dark:bg-slate-800 text-slate-500 text-sm flex items-center">{form.source === 'explorer' ? t('intelligence.from_explorer', { defaultValue: 'From explorer' }) : `${form.dataset}`}</div>
              ) : (
                <select className="input w-full" value={form.source} onChange={(e) => pickSource(e.target.value)}>
                  <option value="">{t('intelligence.pick_saved', { defaultValue: '— Pick a saved view —' })}</option>
                  {explorations.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              )}
            </div>
          </div>

          {form.kind === 'alert' && (
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-red-100 dark:border-red-900/40 bg-red-50/40 dark:bg-red-900/10 p-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">{t('intelligence.metric', { defaultValue: 'Metric' })}</label>
                <select className="input w-full" value={form.alert_metric} onChange={(e) => setForm(f => ({ ...f, alert_metric: e.target.value }))}>
                  <option value="">—</option>
                  {metricsFor(form.dataset).map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">{t('intelligence.condition', { defaultValue: 'Condition' })}</label>
                <select className="input w-full" value={form.alert_operator} onChange={(e) => setForm(f => ({ ...f, alert_operator: e.target.value }))}>
                  {OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">{t('intelligence.threshold', { defaultValue: 'Threshold' })}</label>
                <input type="number" className="input w-full" value={form.alert_threshold} onChange={(e) => setForm(f => ({ ...f, alert_threshold: e.target.value }))} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('intelligence.frequency', { defaultValue: 'Frequency' })}</label>
              <select className="input w-full" value={form.frequency} onChange={(e) => setForm(f => ({ ...f, frequency: e.target.value }))}>
                <option value="daily">{t('intelligence.daily', { defaultValue: 'Daily' })}</option>
                <option value="weekly">{t('intelligence.weekly', { defaultValue: 'Weekly' })}</option>
                <option value="monthly">{t('intelligence.monthly', { defaultValue: 'Monthly' })}</option>
              </select>
            </div>
            {form.frequency === 'weekly' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('intelligence.day', { defaultValue: 'Day' })}</label>
                <select className="input w-full" value={form.day_of_week} onChange={(e) => setForm(f => ({ ...f, day_of_week: e.target.value }))}>
                  {DOW.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}
            {form.frequency === 'monthly' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('intelligence.day_of_month', { defaultValue: 'Day of month' })}</label>
                <input type="number" min="1" max="28" className="input w-full" value={form.day_of_month} onChange={(e) => setForm(f => ({ ...f, day_of_month: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('intelligence.hour', { defaultValue: 'Hour (24h)' })}</label>
              <input type="number" min="0" max="23" className="input w-full" value={form.hour} onChange={(e) => setForm(f => ({ ...f, hour: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('intelligence.recipients', { defaultValue: 'Recipients' })}</label>
            <input className="input w-full" value={form.recipients} placeholder="a@psc.gov.vu, b@psc.gov.vu" onChange={(e) => setForm(f => ({ ...f, recipients: e.target.value }))} />
            <p className="text-[11px] text-slate-400 mt-1">{t('intelligence.recipients_hint', { defaultValue: 'Comma-separated email addresses.' })}</p>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            {t('intelligence.active', { defaultValue: 'Active' })}
          </label>

          <div className="flex items-center gap-2 pt-1">
            <button onClick={save} disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-40">{saving ? '…' : t('common.save', { defaultValue: 'Save' })}</button>
            <button onClick={() => setOpen(false)} className="btn-outline px-5 py-2 text-sm">{t('common.cancel', { defaultValue: 'Cancel' })}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

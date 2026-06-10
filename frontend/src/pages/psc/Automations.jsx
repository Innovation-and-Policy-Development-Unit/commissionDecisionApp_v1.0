/**
 * Automations — the Act engine. Trigger → conditions → actions on an entity,
 * reusing the same condition layer as the rule engine. Safe actions only.
 */
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Pencil, Loader2, FlaskConical, Play, Zap, Lock, History } from 'lucide-react'
import { automationApi } from '../../api/automation'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import PageHeader from '../../components/shared/PageHeader'
import Modal from '../../components/shared/Modal'

const ENTITY_LABEL = { submission: 'Submission', commission_task: 'Commission task', meeting: 'Meeting / minutes' }
const TRIGGER_LABEL = { created: 'On create', updated: 'On update', schedule: 'On schedule' }
const EMPTY = {
  id: null, name: '', description: '', entity: 'submission', trigger: 'updated', match: 'all',
  conditions: [], actions: [], is_active: true, test_mode: false, cooldown_minutes: 60,
}

export default function Automations() {
  const { t } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()
  const [items, setItems] = useState([])
  const [catalogs, setCatalogs] = useState({})
  const [entityList, setEntityList] = useState([])
  const [triggerList, setTriggerList] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [matchCount, setMatchCount] = useState(null)
  const [runsFor, setRunsFor] = useState(null)
  const [runs, setRuns] = useState([])

  const catalog = catalogs[form.entity] || { fields: [], ops: {}, actions: [] }
  const fieldsByKey = Object.fromEntries((catalog.fields || []).map(f => [f.key, f]))
  const actionsByType = Object.fromEntries((catalog.actions || []).map(a => [a.type, a]))

  const ensureCatalog = useCallback(async (entity) => {
    if (catalogs[entity]) return
    try {
      const c = await automationApi.fields(entity)
      setCatalogs(p => ({ ...p, [entity]: c }))
      if (c.entities) setEntityList(c.entities)
      if (c.triggers) setTriggerList(c.triggers)
    } catch { /* ignore */ }
  }, [catalogs])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, c] = await Promise.all([automationApi.list(), automationApi.fields('submission')])
      setItems(list.automations || [])
      setCatalogs({ submission: c })
      setEntityList(c.entities || [])
      setTriggerList(c.triggers || [])
    } catch (e) {
      if (e?.response?.status === 403) setDenied(true)
      else toast.error(t('auto.load_failed', { defaultValue: 'Could not load automations' }))
    } finally { setLoading(false) }
  }, [t, toast])

  useEffect(() => { load() }, [load])

  const opsFor = (fk) => (catalog.ops?.[fieldsByKey[fk]?.kind]) || []

  const openCreate = () => { setForm({ ...EMPTY, conditions: [{ field: '', op: '', value: '' }] }); setMatchCount(null); ensureCatalog('submission'); setOpen(true) }
  const openEdit = (a) => {
    setForm({
      id: a.id, name: a.name, description: a.description || '', entity: a.entity, trigger: a.trigger, match: a.match,
      conditions: (a.conditions?.length ? a.conditions : [{ field: '', op: '', value: '' }]),
      actions: a.actions || [], is_active: a.is_active, test_mode: a.test_mode, cooldown_minutes: a.cooldown_minutes,
    })
    setMatchCount(null); ensureCatalog(a.entity); setOpen(true)
  }
  const changeEntity = (entity) => { setForm(f => ({ ...f, entity, conditions: [{ field: '', op: '', value: '' }], actions: [] })); setMatchCount(null); ensureCatalog(entity) }

  // Conditions
  const setCond = (i, p) => setForm(f => ({ ...f, conditions: f.conditions.map((c, j) => j === i ? { ...c, ...p } : c) }))
  const addCond = () => setForm(f => ({ ...f, conditions: [...f.conditions, { field: '', op: '', value: '' }] }))
  const rmCond = (i) => setForm(f => ({ ...f, conditions: f.conditions.filter((_, j) => j !== i) }))
  const cleanConditions = () => form.conditions.filter(c => c.field && c.op).map(c => {
    const kind = fieldsByKey[c.field]?.kind
    let value = c.value
    if (kind === 'number') value = Number(c.value)
    if (c.op === 'in' && typeof c.value === 'string') value = c.value.split(',').map(s => s.trim()).filter(Boolean)
    if (kind === 'bool') value = undefined
    return { field: c.field, op: c.op, value }
  })

  // Actions
  const addAction = () => setForm(f => ({ ...f, actions: [...f.actions, { type: (catalog.actions?.[0]?.type || 'notify'), params: {} }] }))
  const setAction = (i, p) => setForm(f => ({ ...f, actions: f.actions.map((a, j) => j === i ? { ...a, ...p } : a) }))
  const setActionParam = (i, key, val) => setForm(f => ({ ...f, actions: f.actions.map((a, j) => j === i ? { ...a, params: { ...a.params, [key]: val } } : a) }))
  const rmAction = (i) => setForm(f => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }))
  const cleanActions = () => form.actions.map(a => {
    const schema = actionsByType[a.type]?.params || []
    const params = {}
    schema.forEach(p => {
      const v = a.params?.[p.key]
      if (v === undefined || v === '') return
      if (p.kind === 'roles') params[p.key] = String(v).split(',').map(s => s.trim()).filter(Boolean)
      else if (p.kind === 'number') params[p.key] = Number(v)
      else if (p.kind === 'bool') params[p.key] = Boolean(v)
      else params[p.key] = v
    })
    return { type: a.type, params }
  })

  const dryRun = async () => {
    try { setMatchCount((await automationApi.test(form.entity, cleanConditions(), form.match)).match_count) }
    catch { toast.error(t('auto.test_failed', { defaultValue: 'Could not test' })) }
  }

  const save = async () => {
    if (!form.name.trim()) { toast.error(t('auto.need_name', { defaultValue: 'Name is required' })); return }
    if (!form.actions.length) { toast.error(t('auto.need_action', { defaultValue: 'Add at least one action' })); return }
    const payload = {
      name: form.name.trim(), description: form.description, entity: form.entity, trigger: form.trigger, match: form.match,
      conditions: cleanConditions(), actions: cleanActions(),
      is_active: form.is_active, test_mode: form.test_mode, cooldown_minutes: Number(form.cooldown_minutes) || 0,
    }
    setSaving(true)
    try {
      if (form.id) await automationApi.update(form.id, payload)
      else await automationApi.create(payload)
      setOpen(false); load(); toast.success(t('auto.saved', { defaultValue: 'Automation saved' }))
    } catch (e) { toast.error(e?.response?.data?.detail || Object.values(e?.response?.data || {})[0] || t('auto.save_failed', { defaultValue: 'Could not save' })) }
    finally { setSaving(false) }
  }

  const toggle = async (a, field) => { try { await automationApi.update(a.id, { [field]: !a[field] }); load() } catch { toast.error(t('auto.save_failed', { defaultValue: 'Could not update' })) } }
  const remove = async (a) => {
    const ok = await confirm({ title: t('auto.delete', { defaultValue: 'Delete automation?' }), message: a.name, confirmLabel: t('common.delete', { defaultValue: 'Delete' }) })
    if (ok) { try { await automationApi.remove(a.id); load() } catch { toast.error(t('auto.delete_failed', { defaultValue: 'Could not delete' })) } }
  }
  const runNow = async (a) => {
    try { const r = await automationApi.runNow(a.id); toast.success(t('auto.ran', { defaultValue: `Ran — ${r.acted} acted of ${r.matched}` })); load() }
    catch { toast.error(t('auto.run_failed', { defaultValue: 'Could not run' })) }
  }
  const showRuns = async (a) => { setRunsFor(a); try { setRuns((await automationApi.runs(a.id)).runs || []) } catch { setRuns([]) } }

  if (denied) return (
    <div className="card flex flex-col items-center justify-center py-16 text-slate-400">
      <Lock size={28} className="mb-2 opacity-40" />
      <p className="text-sm">{t('auto.admin_only', { defaultValue: 'Only administrators can manage automations.' })}</p>
    </div>
  )

  return (
    <div className="max-w-screen-lg mx-auto space-y-4 pb-10">
      <PageHeader
        title={t('auto.automations', { defaultValue: 'Automations' })}
        subtitle={t('auto.subtitle', { defaultValue: 'When something happens, run safe actions automatically.' })}
        action={<button onClick={openCreate} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"><Plus size={16} /> {t('auto.new', { defaultValue: 'New automation' })}</button>}
      />

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-slate-400">
          <Zap size={28} className="mb-2 opacity-40" />
          <p className="text-sm">{t('auto.empty', { defaultValue: 'No automations yet.' })}</p>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {items.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-800 dark:text-slate-100 truncate">{a.name}</span>
                  <span className="text-[10px] uppercase font-semibold text-slate-400">{ENTITY_LABEL[a.entity]}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">{TRIGGER_LABEL[a.trigger] || a.trigger}</span>
                  {a.test_mode && <span className="text-[10px] text-amber-600 border border-amber-200 dark:border-amber-800 rounded px-1.5">{t('auto.test', { defaultValue: 'test' })}</span>}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{a.actions.length} {t('auto.actions', { defaultValue: 'actions' })} · {a.conditions.length} {t('auto.conditions', { defaultValue: 'conditions' })} · {a.runs} {t('auto.runs', { defaultValue: 'runs' })}</div>
              </div>
              <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer"><input type="checkbox" checked={a.is_active} onChange={() => toggle(a, 'is_active')} /> {t('auto.active', { defaultValue: 'Active' })}</label>
              <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer"><input type="checkbox" checked={a.test_mode} onChange={() => toggle(a, 'test_mode')} /> {t('auto.test', { defaultValue: 'Test' })}</label>
              {a.trigger === 'schedule' && <button onClick={() => runNow(a)} title={t('auto.run_now', { defaultValue: 'Run now' })} className="p-1.5 rounded text-slate-400 hover:text-emerald-600"><Play size={15} /></button>}
              <button onClick={() => showRuns(a)} title={t('auto.run_log', { defaultValue: 'Run log' })} className="p-1.5 rounded text-slate-400 hover:text-primary-600"><History size={15} /></button>
              <button onClick={() => openEdit(a)} className="p-1.5 rounded text-slate-400 hover:text-primary-600"><Pencil size={15} /></button>
              <button onClick={() => remove(a)} className="p-1.5 rounded text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      <Modal open={open} title={form.id ? t('auto.edit', { defaultValue: 'Edit automation' }) : t('auto.new', { defaultValue: 'New automation' })} onClose={() => setOpen(false)} size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3"><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('auto.name', { defaultValue: 'Name' })}</label>
              <input className="input w-full" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('auto.entity', { defaultValue: 'Entity' })}</label>
              <select className="input w-full" value={form.entity} onChange={(e) => changeEntity(e.target.value)}>
                {(entityList.length ? entityList : Object.keys(ENTITY_LABEL).map(k => ({ key: k, label: ENTITY_LABEL[k] }))).map(en => <option key={en.key} value={en.key}>{en.label}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('auto.trigger', { defaultValue: 'Trigger' })}</label>
              <select className="input w-full" value={form.trigger} onChange={(e) => setForm(f => ({ ...f, trigger: e.target.value }))}>
                {(triggerList.length ? triggerList : Object.keys(TRIGGER_LABEL).map(k => ({ key: k, label: TRIGGER_LABEL[k] }))).map(tr => <option key={tr.key} value={tr.key}>{tr.label}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('auto.match', { defaultValue: 'Match' })}</label>
              <select className="input w-full" value={form.match} onChange={(e) => setForm(f => ({ ...f, match: e.target.value }))}>
                <option value="all">{t('auto.match_all', { defaultValue: 'All' })}</option><option value="any">{t('auto.match_any', { defaultValue: 'Any' })}</option></select></div>
          </div>

          {/* Conditions */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('auto.conditions', { defaultValue: 'Conditions' })} <span className="text-slate-300 normal-case">({t('auto.cond_hint', { defaultValue: 'empty = every trigger' })})</span></label>
            <div className="space-y-2">
              {form.conditions.map((c, i) => {
                const field = fieldsByKey[c.field]; const kind = field?.kind
                return (
                  <div key={i} className="flex items-center gap-2">
                    <select className="input text-sm flex-1" value={c.field} onChange={(e) => setCond(i, { field: e.target.value, op: '', value: '' })}>
                      <option value="">{t('auto.field', { defaultValue: '— field —' })}</option>
                      {(catalog.fields || []).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
                    <select className="input text-sm w-24" value={c.op} onChange={(e) => setCond(i, { op: e.target.value })} disabled={!c.field}>
                      <option value="">op</option>{opsFor(c.field).map(o => <option key={o} value={o}>{o}</option>)}</select>
                    {kind === 'bool' ? <div className="w-32" /> : kind === 'choice' && field.choices ? (
                      <select className="input text-sm w-32" value={c.value} onChange={(e) => setCond(i, { value: e.target.value })}><option value="">—</option>{Object.entries(field.choices).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    ) : <input className="input text-sm w-32" type={kind === 'number' ? 'number' : 'text'} value={c.value ?? ''} onChange={(e) => setCond(i, { value: e.target.value })} />}
                    <button onClick={() => rmCond(i)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                )
              })}
              <button onClick={addCond} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><Plus size={12} /> {t('auto.add_condition', { defaultValue: 'Add condition' })}</button>
            </div>
            <button onClick={dryRun} className="btn-outline flex items-center gap-2 px-3 py-1.5 text-sm mt-2"><FlaskConical size={14} /> {t('auto.test_rule', { defaultValue: 'Test' })}{matchCount != null && <span className="font-semibold text-primary-600">· {matchCount}</span>}</button>
          </div>

          {/* Actions */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('auto.then_do', { defaultValue: 'Then do' })}</label>
            <div className="space-y-2">
              {form.actions.map((a, i) => {
                const schema = actionsByType[a.type]?.params || []
                return (
                  <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <select className="input text-sm flex-1" value={a.type} onChange={(e) => setAction(i, { type: e.target.value, params: {} })}>
                        {(catalog.actions || []).map(ac => <option key={ac.type} value={ac.type}>{ac.label}</option>)}</select>
                      <button onClick={() => rmAction(i)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                    {schema.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {schema.map(p => (
                          <div key={p.key}>
                            <label className="block text-[10px] uppercase text-slate-400 mb-0.5">{p.key.replace(/_/g, ' ')}{p.kind === 'roles' && ' (comma)'}</label>
                            {p.kind === 'bool' ? (
                              <input type="checkbox" checked={!!a.params?.[p.key]} onChange={(e) => setActionParam(i, p.key, e.target.checked)} />
                            ) : (
                              <input className="input text-sm w-full" type={p.kind === 'number' ? 'number' : 'text'} value={a.params?.[p.key] ?? ''} onChange={(e) => setActionParam(i, p.key, e.target.value)} placeholder={p.kind === 'roles' ? 'psc_manager, ...' : (p.kind === 'role' ? 'psc_manager' : '')} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <button onClick={addAction} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><Plus size={12} /> {t('auto.add_action', { defaultValue: 'Add action' })}</button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1 items-end">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))} /> {t('auto.active', { defaultValue: 'Active' })}</label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={form.test_mode} onChange={(e) => setForm(f => ({ ...f, test_mode: e.target.checked }))} /> {t('auto.test_mode', { defaultValue: 'Test mode' })}</label>
            <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('auto.cooldown', { defaultValue: 'Cooldown (min)' })}</label>
              <input type="number" className="input w-full text-sm" value={form.cooldown_minutes} onChange={(e) => setForm(f => ({ ...f, cooldown_minutes: e.target.value }))} /></div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button onClick={save} disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-40">{saving ? '…' : t('common.save', { defaultValue: 'Save' })}</button>
            <button onClick={() => setOpen(false)} className="btn-outline px-5 py-2 text-sm">{t('common.cancel', { defaultValue: 'Cancel' })}</button>
          </div>
        </div>
      </Modal>

      {/* Run log */}
      <Modal open={!!runsFor} title={`${t('auto.run_log', { defaultValue: 'Run log' })} — ${runsFor?.name || ''}`} onClose={() => setRunsFor(null)} size="md">
        <div className="max-h-[60vh] overflow-auto text-sm">
          {runs.length === 0 ? <p className="text-slate-400 py-6 text-center">{t('auto.no_runs', { defaultValue: 'No runs yet.' })}</p> : (
            <table className="w-full">
              <thead><tr className="text-left text-slate-400 border-b border-slate-200 dark:border-slate-700"><th className="px-2 py-1">{t('auto.when', { defaultValue: 'When' })}</th><th className="px-2 py-1">{t('auto.status', { defaultValue: 'Status' })}</th><th className="px-2 py-1">{t('auto.item', { defaultValue: 'Item' })}</th><th className="px-2 py-1">{t('auto.actions', { defaultValue: 'Actions' })}</th></tr></thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-1 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-2 py-1 text-xs"><span className={r.status === 'failed' ? 'text-red-600' : r.status === 'simulated' ? 'text-amber-600' : 'text-emerald-600'}>{r.status}</span></td>
                    <td className="px-2 py-1 text-xs text-slate-600">{r.detail?.ref || '—'}</td>
                    <td className="px-2 py-1 text-xs text-slate-500">{(r.detail?.actions || []).map(a => `${a.type}${a.ok ? '✓' : '✗'}`).join(' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    </div>
  )
}

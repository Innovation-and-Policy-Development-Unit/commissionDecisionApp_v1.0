/**
 * Alert Rules — admin manager for the Submission rule engine.
 * List rules with active / test-mode toggles, open-flag counts, and a
 * condition builder (field → operator → value) with a live dry-run match count.
 */
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Pencil, Loader2, FlaskConical, Flag, Lock } from 'lucide-react'
import { rulesApi } from '../../api/rules'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import PageHeader from '../../components/shared/PageHeader'
import Modal from '../../components/shared/Modal'

const LEVEL_CLS = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  at_risk: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  monitoring: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}
const ENTITY_LABEL = { submission: 'Submission', commission_task: 'Commission task', meeting: 'Meeting / minutes' }
const EMPTY = {
  id: null, name: '', description: '', entity: 'submission', level: 'at_risk', match: 'all',
  conditions: [{ field: '', op: '', value: '' }],
  notify_assignee: true, notify_roles: '', test_mode: false, realert: false, cooldown_minutes: 60, is_active: true,
}

export default function AlertRules() {
  const { t } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()
  const [rules, setRules] = useState([])
  const [catalogs, setCatalogs] = useState({})       // entity → { fields, ops }
  const [entityList, setEntityList] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [testRes, setTestRes] = useState(null)

  const catalog = catalogs[form.entity] || { fields: [], ops: {} }
  const fieldsByKey = Object.fromEntries((catalog.fields || []).map(f => [f.key, f]))

  const ensureCatalog = useCallback(async (entity) => {
    if (catalogs[entity]) return
    try {
      const c = await rulesApi.ruleFields(entity)
      setCatalogs(prev => ({ ...prev, [entity]: c }))
      if (c.entities) setEntityList(c.entities)
    } catch { /* ignore */ }
  }, [catalogs])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, c] = await Promise.all([rulesApi.rules(), rulesApi.ruleFields('submission')])
      setRules(r.rules || [])
      setCatalogs({ submission: c })
      setEntityList(c.entities || [])
    } catch (e) {
      if (e?.response?.status === 403) setDenied(true)
      else toast.error(t('rules.rules_load_failed', { defaultValue: 'Could not load rules' }))
    } finally { setLoading(false) }
  }, [t, toast])

  useEffect(() => { load() }, [load])

  const opsFor = (fieldKey) => (catalog.ops?.[fieldsByKey[fieldKey]?.kind]) || []

  const openCreate = () => { setForm(EMPTY); setTestRes(null); ensureCatalog('submission'); setOpen(true) }
  const openEdit = (r) => {
    setForm({
      id: r.id, name: r.name, description: r.description || '', entity: r.entity, level: r.level, match: r.match,
      conditions: (r.conditions?.length ? r.conditions : [{ field: '', op: '', value: '' }]),
      notify_assignee: r.notify_assignee, notify_roles: (r.notify_roles || []).join(', '),
      test_mode: r.test_mode, realert: r.realert, cooldown_minutes: r.cooldown_minutes, is_active: r.is_active,
    })
    setTestRes(null); ensureCatalog(r.entity); setOpen(true)
  }
  const changeEntity = (entity) => {
    setForm(f => ({ ...f, entity, conditions: [{ field: '', op: '', value: '' }] }))
    setTestRes(null); ensureCatalog(entity)
  }

  const setCond = (i, patch) => setForm(f => ({ ...f, conditions: f.conditions.map((c, j) => j === i ? { ...c, ...patch } : c) }))
  const addCond = () => setForm(f => ({ ...f, conditions: [...f.conditions, { field: '', op: '', value: '' }] }))
  const rmCond = (i) => setForm(f => ({ ...f, conditions: f.conditions.filter((_, j) => j !== i) }))

  const cleanConditions = () => form.conditions
    .filter(c => c.field && c.op)
    .map(c => {
      const kind = fieldsByKey[c.field]?.kind
      let value = c.value
      if (kind === 'number') value = Number(c.value)
      if (c.op === 'in' && typeof c.value === 'string') value = c.value.split(',').map(s => s.trim()).filter(Boolean)
      if (kind === 'bool') value = undefined
      return { field: c.field, op: c.op, value }
    })

  const dryRun = async () => {
    try { setTestRes(await rulesApi.testRule(cleanConditions(), form.match, form.entity)) }
    catch { toast.error(t('rules.test_failed', { defaultValue: 'Could not test rule' })) }
  }

  const save = async () => {
    if (!form.name.trim()) { toast.error(t('rules.need_name', { defaultValue: 'Name is required' })); return }
    const payload = {
      name: form.name.trim(), description: form.description, entity: form.entity, level: form.level, match: form.match,
      conditions: cleanConditions(), notify_assignee: form.notify_assignee,
      notify_roles: form.notify_roles.split(',').map(s => s.trim()).filter(Boolean),
      test_mode: form.test_mode, realert: form.realert, cooldown_minutes: Number(form.cooldown_minutes) || 0, is_active: form.is_active,
    }
    setSaving(true)
    try {
      if (form.id) await rulesApi.updateRule(form.id, payload)
      else await rulesApi.createRule(payload)
      setOpen(false); load()
      toast.success(t('rules.saved', { defaultValue: 'Rule saved' }))
    } catch (e) { toast.error(e?.response?.data?.detail || Object.values(e?.response?.data || {})[0] || t('rules.save_failed', { defaultValue: 'Could not save rule' })) }
    finally { setSaving(false) }
  }

  const toggle = async (r, field) => {
    try { await rulesApi.updateRule(r.id, { [field]: !r[field] }); load() }
    catch { toast.error(t('rules.save_failed', { defaultValue: 'Could not update rule' })) }
  }
  const remove = async (r) => {
    const ok = await confirm({ title: t('rules.delete_rule', { defaultValue: 'Delete rule?' }), message: r.name, confirmLabel: t('common.delete', { defaultValue: 'Delete' }) })
    if (!ok) return
    try { await rulesApi.deleteRule(r.id); load() }
    catch (e) { toast.error(e?.response?.data?.detail || t('rules.delete_failed', { defaultValue: 'Could not delete rule' })) }
  }

  if (denied) return (
    <div className="card flex flex-col items-center justify-center py-16 text-slate-400">
      <Lock size={28} className="mb-2 opacity-40" />
      <p className="text-sm">{t('rules.admin_only', { defaultValue: 'Only administrators can manage alert rules.' })}</p>
      <Link to="/intelligence/flags" className="btn-outline mt-4 px-4 py-2 text-sm">{t('rules.flag_monitor', { defaultValue: 'Flag Monitor' })}</Link>
    </div>
  )

  return (
    <div className="max-w-screen-lg mx-auto space-y-4 pb-10">
      <PageHeader
        title={t('rules.alert_rules', { defaultValue: 'Alert Rules' })}
        subtitle={t('rules.alert_rules_sub', { defaultValue: 'Flag at-risk submissions and notify the right people.' })}
        action={
          <div className="flex items-center gap-2">
            <Link to="/intelligence/flags" className="btn-outline flex items-center gap-2 px-3 py-2 text-sm"><Flag size={15} /> {t('rules.flag_monitor', { defaultValue: 'Flag Monitor' })}</Link>
            <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"><Plus size={16} /> {t('rules.new_rule', { defaultValue: 'New rule' })}</button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {rules.map(r => (
            <div key={r.id} className="flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-800 dark:text-slate-100 truncate">{r.name}</span>
                  <span className="text-[10px] uppercase font-semibold text-slate-400">{ENTITY_LABEL[r.entity] || r.entity}</span>
                  <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${LEVEL_CLS[r.level]}`}>{r.level.replace('_', ' ')}</span>
                  {r.is_builtin && <span className="text-[10px] text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5">{t('rules.builtin', { defaultValue: 'built-in' })}</span>}
                  {r.test_mode && <span className="text-[10px] text-amber-600 border border-amber-200 dark:border-amber-800 rounded px-1.5">{t('rules.test_mode', { defaultValue: 'test mode' })}</span>}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{r.description || t('rules.no_desc', { defaultValue: 'No description' })} · {r.conditions.length} {t('rules.conditions', { defaultValue: 'conditions' })} · <strong className="text-slate-500">{r.open_flags ?? 0}</strong> {t('rules.open', { defaultValue: 'open' })}</div>
              </div>
              <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer" title={t('rules.active', { defaultValue: 'Active' })}>
                <input type="checkbox" checked={r.is_active} onChange={() => toggle(r, 'is_active')} /> {t('rules.active', { defaultValue: 'Active' })}
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer" title={t('rules.test_mode', { defaultValue: 'Test mode (no emails)' })}>
                <input type="checkbox" checked={r.test_mode} onChange={() => toggle(r, 'test_mode')} /> {t('rules.test', { defaultValue: 'Test' })}
              </label>
              <button onClick={() => openEdit(r)} className="p-1.5 rounded text-slate-400 hover:text-primary-600"><Pencil size={15} /></button>
              {!r.is_builtin && <button onClick={() => remove(r)} className="p-1.5 rounded text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>}
            </div>
          ))}
        </div>
      )}

      {/* Create / edit modal */}
      <Modal open={open} title={form.id ? t('rules.edit_rule', { defaultValue: 'Edit rule' }) : t('rules.new_rule', { defaultValue: 'New rule' })} onClose={() => setOpen(false)} size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('rules.name', { defaultValue: 'Name' })}</label>
              <input className="input w-full" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="col-span-2"><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('rules.description', { defaultValue: 'Description' })}</label>
              <input className="input w-full" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="col-span-2"><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('rules.entity', { defaultValue: 'Watch' })}</label>
              <select className="input w-full" value={form.entity} onChange={(e) => changeEntity(e.target.value)}>
                {(entityList.length ? entityList : Object.keys(ENTITY_LABEL).map(k => ({ key: k, label: ENTITY_LABEL[k] }))).map(en => <option key={en.key} value={en.key}>{en.label}</option>)}
              </select></div>
            <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('rules.level', { defaultValue: 'Level' })}</label>
              <select className="input w-full" value={form.level} onChange={(e) => setForm(f => ({ ...f, level: e.target.value }))}>
                <option value="critical">Critical</option><option value="at_risk">At risk</option><option value="monitoring">Monitoring</option></select></div>
            <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('rules.match', { defaultValue: 'Match' })}</label>
              <select className="input w-full" value={form.match} onChange={(e) => setForm(f => ({ ...f, match: e.target.value }))}>
                <option value="all">{t('rules.match_all', { defaultValue: 'All (AND)' })}</option><option value="any">{t('rules.match_any', { defaultValue: 'Any (OR)' })}</option></select></div>
          </div>

          {/* Condition builder */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('rules.conditions', { defaultValue: 'Conditions' })}</label>
            <div className="space-y-2">
              {form.conditions.map((c, i) => {
                const field = fieldsByKey[c.field]
                const kind = field?.kind
                return (
                  <div key={i} className="flex items-center gap-2">
                    <select className="input text-sm flex-1" value={c.field} onChange={(e) => setCond(i, { field: e.target.value, op: '', value: '' })}>
                      <option value="">{t('rules.field', { defaultValue: '— field —' })}</option>
                      {(catalog.fields || []).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                    <select className="input text-sm w-28" value={c.op} onChange={(e) => setCond(i, { op: e.target.value })} disabled={!c.field}>
                      <option value="">{t('rules.op', { defaultValue: 'op' })}</option>
                      {opsFor(c.field).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    {kind === 'bool' ? <div className="w-32" /> : kind === 'choice' && field.choices ? (
                      <select className="input text-sm w-32" value={c.value} onChange={(e) => setCond(i, { value: e.target.value })}>
                        <option value="">—</option>{Object.entries(field.choices).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : (
                      <input className="input text-sm w-32" type={kind === 'number' ? 'number' : 'text'} value={c.value ?? ''} placeholder={c.op === 'in' ? 'a,b,c' : ''} onChange={(e) => setCond(i, { value: e.target.value })} />
                    )}
                    <button onClick={() => rmCond(i)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                )
              })}
              <button onClick={addCond} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><Plus size={12} /> {t('rules.add_condition', { defaultValue: 'Add condition' })}</button>
            </div>
            <div className="mt-2">
              <button onClick={dryRun} className="btn-outline flex items-center gap-2 px-3 py-1.5 text-sm"><FlaskConical size={14} /> {t('rules.test_rule', { defaultValue: 'Test' })}{testRes && <span className="font-semibold text-primary-600">· {testRes.match_count} {t('rules.match', { defaultValue: 'match' })}</span>}</button>
              {testRes?.sample?.length > 0 && (
                <ul className="mt-2 text-xs text-slate-500 dark:text-slate-400 space-y-0.5 max-h-32 overflow-auto">
                  {testRes.sample.map((s, i) => <li key={i} className="truncate"><span className="font-mono text-slate-400">{s.ref}</span> — {s.title} <span className="text-slate-300">({String(s.state || '').replace(/_/g, ' ')})</span></li>)}
                </ul>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={form.notify_assignee} onChange={(e) => setForm(f => ({ ...f, notify_assignee: e.target.checked }))} /> {t('rules.notify_assignee', { defaultValue: 'Notify assignee' })}</label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={form.test_mode} onChange={(e) => setForm(f => ({ ...f, test_mode: e.target.checked }))} /> {t('rules.test_mode_no_email', { defaultValue: 'Test mode (no emails)' })}</label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={form.realert} onChange={(e) => setForm(f => ({ ...f, realert: e.target.checked }))} /> {t('rules.realert', { defaultValue: 'Re-alert each cooldown' })}</label>
            <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('rules.notify_roles', { defaultValue: 'Notify roles' })}</label>
              <input className="input w-full text-sm" value={form.notify_roles} placeholder="psc_manager, senior_admin_officer" onChange={(e) => setForm(f => ({ ...f, notify_roles: e.target.value }))} /></div>
            <div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('rules.cooldown', { defaultValue: 'Cooldown (min)' })}</label>
              <input type="number" className="input w-full text-sm" value={form.cooldown_minutes} onChange={(e) => setForm(f => ({ ...f, cooldown_minutes: e.target.value }))} /></div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button onClick={save} disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-40">{saving ? '…' : t('common.save', { defaultValue: 'Save' })}</button>
            <button onClick={() => setOpen(false)} className="btn-outline px-5 py-2 text-sm">{t('common.cancel', { defaultValue: 'Cancel' })}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

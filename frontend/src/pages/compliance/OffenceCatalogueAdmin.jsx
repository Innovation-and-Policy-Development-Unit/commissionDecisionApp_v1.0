import { useState, useEffect, useCallback } from 'react'
import { Gavel, Plus, Pencil, Loader2, X } from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'

const EMPTY = { code: '', label: '', category: 'minor', description: '', statutory_ref: '', active: true, display_order: 100 }

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
}

export default function OffenceCatalogueAdmin() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(null) // null | 'new' | row
  const [form, setForm] = useState(EMPTY)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/compliance/offence-types/')
      setRows(Array.isArray(data) ? data : (data?.results || []))
    } catch { setRows([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openNew = () => { setForm(EMPTY); setModal('new') }
  const openEdit = (r) => { setForm({ ...r }); setModal(r) }
  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: v }))
  }

  const save = async () => {
    if (!form.label.trim()) { toast.error('Label is required.'); return }
    const payload = {
      ...form,
      code: (form.code || slugify(form.label)),
      display_order: Number(form.display_order) || 100,
    }
    setSaving(true)
    try {
      if (modal === 'new') await api.post('/compliance/offence-types/', payload)
      else await api.patch(`/compliance/offence-types/${modal.id}/`, payload)
      toast.success('Offence saved.')
      setModal(null)
      await load()
    } catch (e) {
      toast.error(e.response?.data?.detail || JSON.stringify(e.response?.data || {}) || 'Could not save.')
    } finally { setSaving(false) }
  }

  const toggleActive = async (r) => {
    try { await api.patch(`/compliance/offence-types/${r.id}/`, { active: !r.active }); await load() }
    catch (e) { toast.error(e.response?.data?.detail || 'Could not update.') }
  }

  const groups = [
    { key: 'minor', label: 'Minor / Disciplinary Offences' },
    { key: 'serious_misconduct', label: 'Serious Misconduct (Appendix C)' },
  ]

  return (
    <div>
      <PageHeader
        title="Offence Catalogue"
        subtitle="The nature-of-offence list used across compliance cases — refine against the statutory Appendix C."
        action={<button onClick={openNew} className="btn-primary inline-flex items-center gap-2 text-sm"><Plus size={15} /> Add offence</button>}
      />

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-slate-300" /></div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            const items = rows.filter((r) => r.category === g.key)
            return (
              <div key={g.key} className="card overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {g.label} <span className="ml-1 text-slate-400">({items.length})</span>
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.length === 0 && <li className="px-4 py-3 text-sm text-slate-400">None.</li>}
                  {items.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-xs text-slate-300 dark:text-slate-600 w-8 text-right">{r.display_order}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${r.active ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 line-through'}`}>{r.label}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{r.code}{r.statutory_ref ? ` · ${r.statutory_ref}` : ''}</p>
                      </div>
                      <button onClick={() => toggleActive(r)} className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${r.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700/50'}`}>
                        {r.active ? 'Active' : 'Inactive'}
                      </button>
                      <button onClick={() => openEdit(r)} className="text-slate-400 hover:text-slate-600"><Pencil size={15} /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100"><Gavel size={17} /> {modal === 'new' ? 'New offence' : 'Edit offence'}</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Label *</label>
                <input className="form-input w-full text-sm" value={form.label} onChange={set('label')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Category</label>
                  <select className="form-input w-full text-sm" value={form.category} onChange={set('category')}>
                    <option value="minor">Minor / Disciplinary</option>
                    <option value="serious_misconduct">Serious Misconduct</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Display order</label>
                  <input type="number" className="form-input w-full text-sm" value={form.display_order} onChange={set('display_order')} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Code {modal === 'new' && <span className="text-slate-400">(auto from label if blank)</span>}</label>
                <input className="form-input w-full text-sm font-mono" value={form.code} onChange={set('code')} disabled={modal !== 'new'} placeholder={modal === 'new' ? slugify(form.label) : ''} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Statutory reference</label>
                <input className="form-input w-full text-sm" value={form.statutory_ref} onChange={set('statutory_ref')} placeholder="e.g. Appendix C(a)" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Description</label>
                <textarea className="form-input w-full text-sm" rows={2} value={form.description} onChange={set('description')} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={form.active} onChange={set('active')} /> Active (available for selection on cases)
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setModal(null)} className="btn-outline text-sm">Cancel</button>
                <button onClick={save} disabled={saving} className="btn-primary text-sm">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

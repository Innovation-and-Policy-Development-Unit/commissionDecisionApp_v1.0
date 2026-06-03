import { useEffect, useState, useMemo } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, Pencil, Trash2, RefreshCw, CheckCircle2, XCircle, Wrench, X, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useAgendaSections } from '../../hooks/useAgendaSections'
import BaseButton from '../../components/shared/BaseButton'
import BaseInput from '../../components/shared/BaseInput'
import BaseSelect from '../../components/shared/BaseSelect'
import BaseTextarea from '../../components/shared/BaseTextarea'
import BaseCheckbox from '../../components/shared/BaseCheckbox'

const PER_PAGE = 15

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} bg-white dark:bg-slate-800 rounded-xl shadow-2xl`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <BaseButton variant="ghost" size="icon" iconOnly onClick={onClose} icon={<X size={16} />} />
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

const ROUTED_UNIT_OPTIONS = [
  { value: '',           label: '— None (manual routing) —' },
  { value: 'odu',        label: 'ODU — Organisational Development Unit' },
  { value: 'hr',         label: 'HR — Human Resources Unit' },
  { value: 'vipam',      label: 'VIPAM' },
  { value: 'compliance', label: 'Compliance Unit' },
  { value: 'csu',        label: 'CSU — Corporate Services Unit' },
]

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  agenda_category: '',
  is_digitized: false,
  digitized_form_key: '',
  is_checklist: false,
  checklist_form_type: '',
  linked_submission_form: '',  // UI-only: which digitized form this checklist belongs to
  routed_unit: '',
  assessment_deadline_days: 21,
  is_active: true,
  display_order: 0,
}

const DIGITIZED_KEYS = [
  { value: '', label: '— None —' },
  { value: 'psc_3_7', label: 'psc_3_7 (PSC Form 3-7 fields)' },
  { value: 'comp_smdr', label: 'comp_smdr (Compliance SMDR)' },
  { value: 'comp_par', label: 'comp_par (Preliminary Assessment)' },
  { value: 'comp_psdb', label: 'comp_psdb (PSDB Order)' },
  { value: 'comp_14d', label: 'comp_14d (14-day Notice Response)' },
  { value: 'comp_omb', label: 'comp_omb (Ombudsman request)' },
  { value: 'comp_psa', label: 'comp_psa (PSA Amendment)' },
]


// ── Main page ─────────────────────────────────────────────────────────────────

export default function FormTypesAdmin() {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { allSections: agendaSections, agendaSectionLabel } = useAgendaSections({ includeInactive: true })

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)   // null | 'create' | {existing row}
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(new Set())

  const isAdmin = user?.role === 'psc_admin' || user?.is_superuser

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return }
    load()
  }, [])

  const load = () => {
    setLoading(true)
    api.get('/form-types/')
      .then(ft => setRows(ft.data))
      .catch(() => toast.error('Failed to load form types.'))
      .finally(() => setLoading(false))
  }

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setError('')
    setModal('create')
  }

  const openEdit = (row) => {
    const linkedSubmissionForm = row.is_checklist
      ? (rows.find(r => r.checklist_form_type === row.id)?.id ?? '')
      : ''
    setForm({
      code: row.code,
      name: row.name,
      description: row.description || '',
      agenda_category: row.agenda_category ?? '',
      is_digitized: row.is_digitized,
      digitized_form_key: row.digitized_form_key || '',
      is_checklist: row.is_checklist || false,
      checklist_form_type: row.checklist_form_type || '',
      linked_submission_form: linkedSubmissionForm,
      routed_unit: row.routed_unit || '',
      assessment_deadline_days: row.assessment_deadline_days ?? 21,
      is_active: row.is_active,
      display_order: row.display_order,
    })
    setError('')
    setModal(row)
  }

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError('Code and Name are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { linked_submission_form, ...rest } = form
      const payload = {
        ...rest,
        agenda_category: form.agenda_category || '',
        form_category: null,
      }
      let savedId
      if (modal === 'create') {
        const { data } = await api.post('/form-types/', payload)
        setRows(prev => [...prev, data])
        savedId = data.id
        toast.success(`"${data.code}" created.`)
      } else {
        const { data } = await api.patch(`/form-types/${modal.id}/`, payload)
        setRows(prev => prev.map(r => r.id === data.id ? data : r))
        savedId = data.id
        toast.success(`"${data.code}" updated.`)
      }

      // When saving a checklist form, update the linked submission form's checklist_form_type
      if (form.is_checklist) {
        const prevLinked = modal !== 'create'
          ? rows.find(r => r.checklist_form_type === modal.id)?.id
          : undefined
        // Clear old link if changed
        if (prevLinked && prevLinked !== Number(linked_submission_form)) {
          const { data: cleared } = await api.patch(`/form-types/${prevLinked}/`, { checklist_form_type: null })
          setRows(prev => prev.map(r => r.id === cleared.id ? cleared : r))
        }
        // Set new link
        if (linked_submission_form) {
          const { data: linked } = await api.patch(`/form-types/${linked_submission_form}/`, { checklist_form_type: savedId })
          setRows(prev => prev.map(r => r.id === linked.id ? linked : r))
        }
      }

      setModal(null)
    } catch (err) {
      const detail = err.response?.data
      setError(typeof detail === 'object' ? JSON.stringify(detail) : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: 'Delete Form Type',
      message: `Delete "${row.code}"? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await api.delete(`/form-types/${row.id}/`)
      setRows(prev => prev.filter(r => r.id !== row.id))
      toast.success(`"${row.code}" deleted.`)
    } catch {
      toast.error('Failed to delete form type.')
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleAll = () => setSelected(prev =>
    paged.every(r => prev.has(r.id)) ? new Set() : new Set(paged.map(r => r.id))
  )
  const toggleOne = id => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const handleBulkDelete = async () => {
    const count = selected.size
    const ok = await confirm({
      title: `Delete ${count} Form Type${count !== 1 ? 's' : ''}`,
      message: `Permanently delete ${count} selected form type${count !== 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    const ids = [...selected]
    await Promise.all(ids.map(id => api.delete(`/form-types/${id}/`).catch(() => {})))
    setRows(prev => prev.filter(r => !selected.has(r.id)))
    toast.success(`${ids.length} form type${ids.length !== 1 ? 's' : ''} deleted.`)
    setSelected(new Set())
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(r =>
      r.code.toLowerCase().includes(s) ||
      r.name.toLowerCase().includes(s) ||
      (agendaSectionLabel(r.agenda_category) || '').toLowerCase().includes(s)
    )
  }, [rows, q, agendaSectionLabel])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage   = Math.min(page, totalPages)
  const paged      = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)
  const changePage = p => setPage(Math.max(1, Math.min(totalPages, p)))

  return (
    <div>
      <PageHeader
        title="PSC Form Types"
        subtitle="Manage PSC form types, agenda section assignment, and digitized forms. Agenda sections are configured under Administration → Agenda sections."
        action={
          <div className="flex items-center gap-2">
            <BaseButton variant="outline" icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />} onClick={load} disabled={loading}>Refresh</BaseButton>
            <BaseButton variant="primary" icon={<PlusCircle size={16} />} onClick={openCreate}>Add Form Type</BaseButton>
          </div>
        }
      />

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <BaseInput
            hideLabel label="Search"
            type="search"
            placeholder="Search code, name or agenda section…"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); setSelected(new Set()) }}
            contentBefore={<Search size={15} className="text-slate-400" />}
            className="flex-1 max-w-sm"
          />
          {selected.size > 0 && (
            <BaseButton variant="danger" icon={<Trash2 size={14} />} onClick={handleBulkDelete} className="whitespace-nowrap">
              Delete {selected.size}
            </BaseButton>
          )}
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">
                  <BaseCheckbox checked={paged.length > 0 && paged.every(r => selected.has(r.id))} onChange={toggleAll} />
                </th>
                <th>Order</th>
                <th>Code</th>
                <th>Name</th>
                <th>Agenda section</th>
                <th>Digitized</th>
                <th>Active</th>
                <th className="sr-only">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="py-10 text-center text-slate-400">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-slate-400">No form types yet. Click "Add Form Type" to get started.</td></tr>
              )}
              {!loading && filtered.length === 0 && rows.length > 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-slate-400">No form types match your search.</td></tr>
              )}
              {!loading && paged.map(row => (
                <tr key={row.id} className={selected.has(row.id) ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}>
                  <td>
                    <BaseCheckbox checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} />
                  </td>
                  <td>
                    <span className="text-xs text-slate-400 font-mono">{row.display_order}</span>
                  </td>
                  <td>
                    <span className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 whitespace-nowrap">{row.code}</span>
                  </td>
                  <td className="max-w-sm">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{row.name}</p>
                    {row.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{row.description}</p>}
                  </td>
                  <td>
                    {row.agenda_category
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 whitespace-nowrap max-w-xs truncate" title={agendaSectionLabel(row.agenda_category)}>{agendaSectionLabel(row.agenda_category)}</span>
                      : <span className="text-xs italic text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td>
                    {row.is_digitized
                      ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><CheckCircle2 size={11} /> Yes</span>
                      : <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"><XCircle size={11} /> No</span>}
                  </td>
                  <td>
                    {row.is_active
                      ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Active</span>
                      : <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">Inactive</span>}
                  </td>
                  <td>
                    <div className="flex items-center gap-0.5">
                      <BaseButton variant="ghost" size="icon" iconOnly title="Design Form Fields" onClick={() => navigate(`/admin/form-types/${row.id}/builder`)} icon={<Wrench size={13} />} />
                      <BaseButton variant="ghost" size="icon" iconOnly title="Edit" onClick={() => openEdit(row)} icon={<Pencil size={13} />} />
                      <BaseButton variant="ghost" size="icon" iconOnly title="Delete" onClick={() => handleDelete(row)} icon={<Trash2 size={13} />} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > PER_PAGE && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{(safePage - 1) * PER_PAGE + 1}</span>
              {' – '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(safePage * PER_PAGE, filtered.length)}</span>
              {' of '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{filtered.length}</span>
              {' form types'}
            </p>
            <div className="flex items-center gap-1">
              <BaseButton variant="ghost" size="icon" iconOnly aria-label="Previous" onClick={() => changePage(safePage - 1)} disabled={safePage === 1} icon={<ChevronLeft size={16} />} />
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1
                if (totalPages > 5 && safePage > 3) p = safePage - 2 + i
                if (p > totalPages) return null
                return (
                  <BaseButton key={p} variant={safePage === p ? 'primary' : 'ghost'} size="sm" onClick={() => changePage(p)} className="!min-w-8">{p}</BaseButton>
                )
              })}
              <BaseButton variant="ghost" size="icon" iconOnly aria-label="Next" onClick={() => changePage(safePage + 1)} disabled={safePage === totalPages} icon={<ChevronRight size={16} />} />
            </div>
          </div>
        )}
      </div>

      {/* Form Type create/edit modal */}
      {modal && (
        <Modal
          title={modal === 'create' ? 'Add PSC Form Type' : `Edit — ${modal.code}`}
          onClose={() => setModal(null)}
        >
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <BaseInput label="Code" required value={form.code} onChange={e => set('code', e.target.value)} placeholder="e.g. PSC 3-7" />
              <BaseInput label="Display Order" type="number" value={form.display_order} onChange={e => set('display_order', Number(e.target.value))} />
            </div>

            <div>
              <BaseSelect
                label="Agenda section"
                placeholder="— None —"
                value={form.agenda_category}
                options={agendaSections.map(s => ({ value: s.value, label: s.label }))}
                onChange={(_, v) => set('agenda_category', v)}
              />
              <p className="mt-1 text-xs text-slate-400">
                Links this form to a Commission agenda section. Manage sections under{' '}
                <span className="font-medium">Administration → Agenda sections</span>.
              </p>
            </div>

            <BaseInput label="Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full form name" />

            <BaseTextarea label="Description" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional description" />

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
              <BaseCheckbox label="Has digitized form" checked={form.is_digitized} onChange={e => set('is_digitized', e.target.checked)} />
              <BaseCheckbox label="This is a checklist form" checked={form.is_checklist} onChange={e => set('is_checklist', e.target.checked)} />
              <BaseCheckbox label="Active (visible in dropdowns)" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            </div>

            {form.is_digitized && (
              <div>
                <BaseSelect
                  label="Digitized Form Key"
                  value={form.digitized_form_key}
                  options={DIGITIZED_KEYS.map(k => ({ value: k.value, label: k.label }))}
                  onChange={(_, v) => set('digitized_form_key', v)}
                />
                <p className="mt-1 text-xs text-slate-400">Links this form type to its frontend component.</p>
              </div>
            )}

            {!form.is_checklist && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <BaseSelect
                    label="Auto-route to unit"
                    value={form.routed_unit}
                    options={ROUTED_UNIT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                    onChange={(_, v) => set('routed_unit', v)}
                  />
                  <p className="mt-1 text-xs text-slate-400">Unit that receives this form for checklist review.</p>
                </div>
                <div>
                  <BaseInput
                    label="Assessment deadline (working days)"
                    type="number" min="1" max="90"
                    value={form.assessment_deadline_days}
                    onChange={e => set('assessment_deadline_days', Number(e.target.value) || 21)}
                  />
                  <p className="mt-1 text-xs text-slate-400">Default 21. Overrides the system-wide SLA for this form type.</p>
                </div>
              </div>
            )}

            {form.is_checklist && (
              <div>
                <BaseSelect
                  label="Linked digitized form"
                  placeholder="— None —"
                  value={form.linked_submission_form || ''}
                  options={rows.filter(r => r.is_digitized && !r.is_checklist && (modal === 'create' || r.id !== modal?.id)).map(r => ({ value: String(r.id), label: `${r.code} — ${r.name}` }))}
                  onChange={(_, v) => set('linked_submission_form', v ? Number(v) : '')}
                />
                <p className="mt-1 text-xs text-slate-400">The digitized submission form that this checklist is associated with.</p>
              </div>
            )}

            {!form.is_checklist && (
              <div>
                <BaseSelect
                  label="Linked checklist"
                  placeholder="— None —"
                  value={form.checklist_form_type || ''}
                  options={rows.filter(r => r.is_checklist).map(r => ({ value: String(r.id), label: `${r.code} — ${r.name}` }))}
                  onChange={(_, v) => set('checklist_form_type', v ? Number(v) : null)}
                />
                <p className="mt-1 text-xs text-slate-400">
                  The checklist that assigned principals fill out during Manager Checklist Review for this form type.
                  Create the checklist form type first, then link it here.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <BaseButton onClick={save} variant="primary" loading={saving} loadingLabel="Saving">
                {modal === 'create' ? 'Create' : 'Save Changes'}
              </BaseButton>
              <BaseButton onClick={() => setModal(null)} variant="secondary">Cancel</BaseButton>
            </div>
          </div>
        </Modal>
      )}

    </div>
  )
}

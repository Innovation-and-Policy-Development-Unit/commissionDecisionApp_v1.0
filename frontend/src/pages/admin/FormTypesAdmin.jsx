import { useEffect, useState, useMemo } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, Pencil, Trash2, RefreshCw, CheckCircle2, XCircle, Wrench, X, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useAgendaSections } from '../../hooks/useAgendaSections'

const PER_PAGE = 15

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} bg-white dark:bg-slate-800 rounded-xl shadow-2xl`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  agenda_category: '',
  is_digitized: false,
  digitized_form_key: '',
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
    setForm({
      code: row.code,
      name: row.name,
      description: row.description || '',
      agenda_category: row.agenda_category ?? '',
      is_digitized: row.is_digitized,
      digitized_form_key: row.digitized_form_key || '',
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
      const payload = {
        ...form,
        agenda_category: form.agenda_category || '',
        form_category: null,
      }
      if (modal === 'create') {
        const { data } = await api.post('/form-types/', payload)
        setRows(prev => [...prev, data])
        toast.success(`"${data.code}" created.`)
      } else {
        const { data } = await api.patch(`/form-types/${modal.id}/`, payload)
        setRows(prev => prev.map(r => r.id === data.id ? data : r))
        toast.success(`"${data.code}" updated.`)
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
            <button onClick={load} disabled={loading} className="btn-outline inline-flex items-center gap-2 py-2 px-3 text-sm">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
              <PlusCircle size={16} />
              Add Form Type
            </button>
          </div>
        }
      />

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder="Search code, name or agenda section…"
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1); setSelected(new Set()) }}
              className="input pl-9 text-sm w-full"
            />
          </div>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              className="btn-danger text-sm inline-flex items-center gap-2 py-2 px-3 whitespace-nowrap"
            >
              <Trash2 size={14} />
              Delete {selected.size}
            </button>
          )}
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    checked={paged.length > 0 && paged.every(r => selected.has(r.id))}
                    onChange={toggleAll}
                  />
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
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                    />
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
                      <button
                        onClick={() => navigate(`/admin/form-types/${row.id}/builder`)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                        title="Design Form Fields"
                      >
                        <Wrench size={13} />
                      </button>
                      <button
                        onClick={() => openEdit(row)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(row)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
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
              <button
                onClick={() => changePage(safePage - 1)}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1
                if (totalPages > 5 && safePage > 3) p = safePage - 2 + i
                if (p > totalPages) return null
                return (
                  <button
                    key={p}
                    onClick={() => changePage(p)}
                    className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${safePage === p ? 'bg-primary-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => changePage(safePage + 1)}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
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
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Code <span className="text-red-500">*</span></label>
                <input className="input" value={form.code} onChange={e => set('code', e.target.value)} placeholder="e.g. PSC 3-7" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Display Order</label>
                <input className="input" type="number" value={form.display_order} onChange={e => set('display_order', Number(e.target.value))} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Agenda section</label>
              <select className="input" value={form.agenda_category} onChange={e => set('agenda_category', e.target.value)}>
                <option value="">— None —</option>
                {agendaSections.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Links this form to a Commission agenda section. Manage sections under{' '}
                <span className="font-medium">Administration → Agenda sections</span>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Name <span className="text-red-500">*</span></label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full form name" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Description</label>
              <textarea className="input min-h-[72px]" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional description" />
            </div>

            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" className="w-4 h-4 rounded" checked={form.is_digitized} onChange={e => set('is_digitized', e.target.checked)} />
                Has digitized form
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" className="w-4 h-4 rounded" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                Active (visible in dropdowns)
              </label>
            </div>

            {form.is_digitized && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Digitized Form Key</label>
                <select className="input" value={form.digitized_form_key} onChange={e => set('digitized_form_key', e.target.value)}>
                  {DIGITIZED_KEYS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-400">Links this form type to its frontend component.</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={save} disabled={saving} className="btn-primary px-5 py-2">
                {saving ? 'Saving…' : modal === 'create' ? 'Create' : 'Save Changes'}
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary px-5 py-2">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  )
}

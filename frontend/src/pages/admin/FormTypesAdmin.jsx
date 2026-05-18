import { useEffect, useState, useMemo, useRef } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, Pencil, Trash2, RefreshCw, CheckCircle2, XCircle, Wrench, Tag, X, ChevronLeft, ChevronRight, Search, Upload, AlertCircle } from 'lucide-react'

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
  form_category: '',
  is_digitized: false,
  digitized_form_key: '',
  is_active: true,
  display_order: 0,
}

const EMPTY_CAT = { code: '', name: '', psc_forms_summary: '', display_order: 0 }

const DIGITIZED_KEYS = [
  { value: '', label: '— None —' },
  { value: 'psc_3_7', label: 'psc_3_7 (PSC Form 3-7 fields)' },
]

// ── Category XML parser ───────────────────────────────────────────────────────

function parseCategoryXML(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const parseErr = doc.querySelector('parsererror')
  if (parseErr) throw new Error('Invalid XML: ' + parseErr.textContent.slice(0, 120))
  const nodes = Array.from(doc.querySelectorAll('category'))
  if (nodes.length === 0) throw new Error('No <category> elements found in XML.')
  return nodes.map((node, i) => ({
    code:              (node.querySelector('code')?.textContent ?? '').trim().toUpperCase(),
    name:              (node.querySelector('name')?.textContent ?? '').trim(),
    psc_forms_summary: (node.querySelector('psc_forms_summary')?.textContent ?? '').trim(),
    display_order:     Number(node.querySelector('display_order')?.textContent ?? (i + 1) * 10) || (i + 1) * 10,
  }))
}

// ── Categories panel ─────────────────────────────────────────────────────────

const CAT_PER_PAGE = 5

function CategoriesPanel({ categories, setCategories, onClose }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(null)   // null | 'new' | {row}
  const [form, setForm] = useState(EMPTY_CAT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedCats, setSelectedCats] = useState(new Set())
  const [catQ, setCatQ] = useState('')
  const [catPage, setCatPage] = useState(1)
  const [xmlPreview, setXmlPreview] = useState(null)   // parsed categories awaiting confirm
  const [xmlImporting, setXmlImporting] = useState(false)
  const catFileRef = useRef(null)

  const filteredCats = useMemo(() => {
    const s = catQ.trim().toLowerCase()
    if (!s) return categories
    return categories.filter(c =>
      c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s)
    )
  }, [categories, catQ])

  const catTotalPages = Math.max(1, Math.ceil(filteredCats.length / CAT_PER_PAGE))
  const catSafePage = Math.min(catPage, catTotalPages)
  const pagedCats = filteredCats.slice((catSafePage - 1) * CAT_PER_PAGE, catSafePage * CAT_PER_PAGE)
  const changeCatPage = p => setCatPage(Math.max(1, Math.min(catTotalPages, p)))

  const toggleAllCats = () => setSelectedCats(prev =>
    pagedCats.every(c => prev.has(c.id))
      ? new Set([...prev].filter(id => !pagedCats.some(c => c.id === id)))
      : new Set([...prev, ...pagedCats.map(c => c.id)])
  )
  const toggleOneCat = id => setSelectedCats(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const handleBulkDeleteCats = async () => {
    const count = selectedCats.size
    const ok = await confirm({
      title: `Delete ${count} Categor${count !== 1 ? 'ies' : 'y'}`,
      message: `Delete ${count} selected categor${count !== 1 ? 'ies' : 'y'}? Form types in these categories will be uncategorized.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    const ids = [...selectedCats]
    await Promise.all(ids.map(id => api.delete(`/form-categories/${id}/`).catch(() => {})))
    setCategories(prev => prev.filter(c => !selectedCats.has(c.id)))
    toast.success(`${ids.length} categor${ids.length !== 1 ? 'ies' : 'y'} deleted.`)
    setSelectedCats(new Set())
  }

  const handleCatFileSelect = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = parseCategoryXML(ev.target.result)
        if (parsed.length === 0) { toast.error('No categories found in file.'); return }
        setXmlPreview(parsed)
      } catch (err) {
        toast.error(`Parse error: ${err.message}`)
      }
    }
    reader.readAsText(file)
  }

  const handleCatImportConfirm = async (replace) => {
    setXmlImporting(true)
    try {
      if (replace) {
        await Promise.all(categories.map(c => api.delete(`/form-categories/${c.id}/`).catch(() => {})))
      }
      const created = []
      for (const cat of xmlPreview) {
        if (!cat.code || !cat.name) continue
        const { data } = await api.post('/form-categories/', cat)
        created.push(data)
      }
      setCategories(prev => {
        const base = replace ? [] : prev
        return [...base, ...created].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
      })
      toast.success(`${created.length} categor${created.length !== 1 ? 'ies' : 'y'} imported.`)
      setXmlPreview(null)
    } catch {
      toast.error('Import failed. Some categories may not have been saved.')
    } finally {
      setXmlImporting(false)
    }
  }

  const openNew = () => { setForm(EMPTY_CAT); setError(''); setEditing('new') }
  const openEdit = (cat) => { setForm({ code: cat.code, name: cat.name, psc_forms_summary: cat.psc_forms_summary || '', display_order: cat.display_order }); setError(''); setEditing(cat) }
  const cancelEdit = () => { setEditing(null); setError('') }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) { setError('Code and Name are required.'); return }
    setSaving(true); setError('')
    try {
      if (editing === 'new') {
        const { data } = await api.post('/form-categories/', form)
        setCategories(prev => [...prev, data].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)))
        toast.success(`"${data.name}" created.`)
      } else {
        const { data } = await api.patch(`/form-categories/${editing.id}/`, form)
        setCategories(prev => prev.map(c => c.id === data.id ? data : c))
        toast.success(`"${data.name}" updated.`)
      }
      setEditing(null)
    } catch (err) {
      const detail = err.response?.data
      setError(typeof detail === 'object' ? JSON.stringify(detail) : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cat) => {
    const ok = await confirm({
      title: 'Delete Category',
      message: `Delete "${cat.name}"? Form types in this category will be uncategorized.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await api.delete(`/form-categories/${cat.id}/`)
      setCategories(prev => prev.filter(c => c.id !== cat.id))
      toast.success(`"${cat.name}" deleted.`)
    } catch {
      toast.error('Failed to delete category.')
    }
  }

  return (
    <Modal title="Manage Form Categories" onClose={onClose} wide>
      <div className="space-y-4">
        {/* Search + bulk action bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder="Search code or name…"
              value={catQ}
              onChange={e => { setCatQ(e.target.value); setCatPage(1); setSelectedCats(new Set()) }}
              className="input pl-9 text-sm w-full"
            />
          </div>
          {selectedCats.size > 0 && (
            <button
              type="button"
              onClick={handleBulkDeleteCats}
              className="btn-danger text-xs inline-flex items-center gap-1.5 py-2 px-3 whitespace-nowrap"
            >
              <Trash2 size={12} />
              Delete {selectedCats.size}
            </button>
          )}
        </div>

        {/* Category list */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {categories.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No categories yet.</p>
          ) : filteredCats.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No categories match your search.</p>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-10">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded"
                          checked={pagedCats.length > 0 && pagedCats.every(c => selectedCats.has(c.id))}
                          onChange={toggleAllCats}
                        />
                      </th>
                      <th>Order</th>
                      <th>Code</th>
                      <th>Name</th>
                      <th className="sr-only">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCats.map(cat => (
                      <tr key={cat.id} className={selectedCats.has(cat.id) ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}>
                        <td>
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded"
                            checked={selectedCats.has(cat.id)}
                            onChange={() => toggleOneCat(cat.id)}
                          />
                        </td>
                        <td><span className="text-xs text-slate-400 font-mono">{cat.display_order}</span></td>
                        <td><span className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400">{cat.code}</span></td>
                        <td><span className="text-sm font-medium text-slate-800 dark:text-slate-100">{cat.name}</span></td>
                        <td>
                          <div className="flex items-center gap-0.5 justify-end">
                            <button onClick={() => openEdit(cat)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors" title="Edit">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => handleDelete(cat)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredCats.length > CAT_PER_PAGE && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {(catSafePage - 1) * CAT_PER_PAGE + 1}–{Math.min(catSafePage * CAT_PER_PAGE, filteredCats.length)} of {filteredCats.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => changeCatPage(catSafePage - 1)}
                      disabled={catSafePage === 1}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    {Array.from({ length: Math.min(5, catTotalPages) }, (_, i) => {
                      let p = i + 1
                      if (catTotalPages > 5 && catSafePage > 3) p = catSafePage - 2 + i
                      if (p > catTotalPages) return null
                      return (
                        <button
                          key={p}
                          onClick={() => changeCatPage(p)}
                          className={`w-7 h-7 text-xs font-medium rounded-lg transition-colors ${catSafePage === p ? 'bg-primary-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
                        >
                          {p}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => changeCatPage(catSafePage + 1)}
                      disabled={catSafePage === catTotalPages}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* XML import preview */}
        {xmlPreview && (
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                {xmlPreview.length} Categor{xmlPreview.length !== 1 ? 'ies' : 'y'} Ready to Import
              </p>
              <button onClick={() => setXmlPreview(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X size={14} />
              </button>
            </div>
            <div className="rounded border border-blue-200 dark:border-blue-700 divide-y divide-blue-100 dark:divide-blue-800 max-h-40 overflow-y-auto">
              {xmlPreview.map((c, i) => {
                const invalid = !c.code || !c.name
                return (
                  <div key={i} className={`flex items-center gap-2 px-3 py-1.5 ${invalid ? 'opacity-40' : ''}`}>
                    {invalid
                      ? <AlertCircle size={12} className="text-amber-500 flex-shrink-0" />
                      : <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />
                    }
                    <span className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 w-28 flex-shrink-0">{c.code || '—'}</span>
                    <span className="text-xs text-slate-700 dark:text-slate-200 truncate">{c.name || 'No name'}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => handleCatImportConfirm(false)}
                disabled={xmlImporting}
                className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
              >
                <Upload size={12} />
                {xmlImporting ? 'Importing…' : `Append ${xmlPreview.filter(c => c.code && c.name).length}`}
              </button>
              <button
                onClick={() => handleCatImportConfirm(true)}
                disabled={xmlImporting}
                className="btn-danger text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
              >
                {xmlImporting ? 'Importing…' : 'Replace All'}
              </button>
              <button onClick={() => setXmlPreview(null)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Inline add/edit form */}
        {editing ? (
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-3">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
              {editing === 'new' ? 'New Category' : `Editing — ${editing.name}`}
            </p>
            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Code <span className="text-red-500">*</span></label>
                <input className="input" value={form.code} onChange={e => set('code', e.target.value)} placeholder="e.g. DISCIPLINE" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Display Order</label>
                <input className="input" type="number" value={form.display_order} onChange={e => set('display_order', Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Name <span className="text-red-500">*</span></label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Category name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">PSC Forms Summary</label>
              <input className="input" value={form.psc_forms_summary} onChange={e => set('psc_forms_summary', e.target.value)} placeholder="e.g. PSC 3-7, PSC 3-6" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={saving} className="btn-primary px-4 py-1.5 text-sm">
                {saving ? 'Saving…' : editing === 'new' ? 'Create' : 'Save'}
              </button>
              <button onClick={cancelEdit} className="btn-secondary px-4 py-1.5 text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={openNew} className="btn-outline inline-flex items-center gap-2 text-sm py-2 px-3">
              <PlusCircle size={14} />
              Add Category
            </button>
            <button
              onClick={() => catFileRef.current?.click()}
              className="btn-outline inline-flex items-center gap-2 text-sm py-2 px-3"
              title="Import categories from a .xml file"
            >
              <Upload size={14} />
              Import XML
            </button>
            <input
              ref={catFileRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={handleCatFileSelect}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FormTypesAdmin() {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const [rows, setRows] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)   // null | 'create' | {existing row}
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCategories, setShowCategories] = useState(false)
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
    Promise.all([
      api.get('/form-types/'),
      api.get('/form-categories/'),
    ])
      .then(([ft, cat]) => {
        setRows(ft.data)
        setCategories(cat.data)
      })
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
      form_category: row.form_category ?? '',
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
      const payload = { ...form, form_category: form.form_category || null }
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
      (r.form_category_name || '').toLowerCase().includes(s)
    )
  }, [rows, q])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage   = Math.min(page, totalPages)
  const paged      = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)
  const changePage = p => setPage(Math.max(1, Math.min(totalPages, p)))

  return (
    <div>
      <PageHeader
        title="PSC Form Types"
        subtitle="Manage the list of PSC forms and which ones have a digitized version in the system."
        action={
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="btn-outline inline-flex items-center gap-2 py-2 px-3 text-sm">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button onClick={() => setShowCategories(true)} className="btn-outline inline-flex items-center gap-2 py-2 px-3 text-sm">
              <Tag size={14} />
              Manage Categories
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
              placeholder="Search code, name or category…"
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
                <th>Category</th>
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
                    {row.form_category_name
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 whitespace-nowrap">{row.form_category_name}</span>
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
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Category</label>
              <select className="input" value={form.form_category} onChange={e => set('form_category', e.target.value)}>
                <option value="">— None —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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

      {/* Categories management panel */}
      {showCategories && (
        <CategoriesPanel
          categories={categories}
          setCategories={setCategories}
          onClose={() => setShowCategories(false)}
        />
      )}
    </div>
  )
}

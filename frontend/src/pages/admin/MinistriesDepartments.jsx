import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit2, Plus, Trash2, X } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { userCanAccessAdminPanel } from '../../utils/adminAccess'
import PageHeader from '../../components/shared/PageHeader'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="card w-full max-w-md p-0 overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export default function MinistriesDepartments() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast   = useToast()
  const confirm = useConfirm()
  const [ministries, setMinistries] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [minModal, setMinModal] = useState(null)
  const [minForm, setMinForm] = useState({ code: '', name: '' })
  const [deptModal, setDeptModal] = useState(null)
  const [deptForm, setDeptForm] = useState({ ministry: '', code: '', name: '' })
  const [saving, setSaving] = useState(false)
  const [selectedMin, setSelectedMin] = useState(new Set())
  const [selectedDept, setSelectedDept] = useState(new Set())

  useEffect(() => {
    if (user && !userCanAccessAdminPanel(user)) navigate('/', { replace: true })
  }, [user, navigate])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [m, d] = await Promise.all([api.get('/ministries/'), api.get('/departments/')])
      setMinistries(m.data.results || m.data)
      setDepartments(d.data.results || d.data)
    } catch (e) {
      setError('Could not load ministries or departments.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const ministryName = id => ministries.find(m => m.id === id)?.name ?? '—'

  const saveMinistry = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      if (minModal === 'create') {
        await api.post('/ministries/', { code: minForm.code.trim(), name: minForm.name.trim() })
        toast.success('Ministry created.')
      } else {
        await api.patch(`/ministries/${minModal.id}/`, { code: minForm.code.trim(), name: minForm.name.trim() })
        toast.success('Ministry updated.')
      }
      setMinModal(null)
      await load()
    } catch (err) {
      const d = err.response?.data
      toast.error(typeof d === 'object' ? JSON.stringify(d) : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const deleteMinistry = async m => {
    const ok = await confirm({
      title: 'Delete Ministry',
      message: `Delete "${m.name}"? All departments under it will also be removed. This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    setSaving(true)
    try {
      await api.delete(`/ministries/${m.id}/`)
      await load()
      toast.success(`Ministry "${m.name}" deleted.`)
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Could not delete ministry — it may be referenced by submissions.')
    } finally {
      setSaving(false)
    }
  }

  const saveDepartment = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ministry: parseInt(deptForm.ministry, 10),
        code: deptForm.code.trim(),
        name: deptForm.name.trim(),
      }
      if (deptModal === 'create') {
        await api.post('/departments/', payload)
        toast.success('Department created.')
      } else {
        await api.patch(`/departments/${deptModal.id}/`, payload)
        toast.success('Department updated.')
      }
      setDeptModal(null)
      await load()
    } catch (err) {
      const d = err.response?.data
      toast.error(typeof d === 'object' ? JSON.stringify(d) : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const deleteDepartment = async d => {
    const ok = await confirm({
      title: 'Delete Department',
      message: `Delete department "${d.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    setSaving(true)
    try {
      await api.delete(`/departments/${d.id}/`)
      await load()
      toast.success(`Department "${d.name}" deleted.`)
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Could not delete department.')
    } finally {
      setSaving(false)
    }
  }

  const toggleAllMin = () => setSelectedMin(prev =>
    prev.size === ministries.length ? new Set() : new Set(ministries.map(m => m.id))
  )
  const toggleOneMin = id => setSelectedMin(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const handleBulkDeleteMin = async () => {
    const count = selectedMin.size
    const ok = await confirm({
      title: `Delete ${count} Ministr${count !== 1 ? 'ies' : 'y'}`,
      message: `Delete ${count} selected ministr${count !== 1 ? 'ies' : 'y'} and all their departments? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    const ids = [...selectedMin]
    await Promise.all(ids.map(id => api.delete(`/ministries/${id}/`).catch(() => {})))
    toast.success(`${ids.length} ministr${ids.length !== 1 ? 'ies' : 'y'} deleted.`)
    setSelectedMin(new Set())
    await load()
  }

  const toggleAllDept = () => setSelectedDept(prev =>
    prev.size === departments.length ? new Set() : new Set(departments.map(d => d.id))
  )
  const toggleOneDept = id => setSelectedDept(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const handleBulkDeleteDept = async () => {
    const count = selectedDept.size
    const ok = await confirm({
      title: `Delete ${count} Department${count !== 1 ? 's' : ''}`,
      message: `Delete ${count} selected department${count !== 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    const ids = [...selectedDept]
    await Promise.all(ids.map(id => api.delete(`/departments/${id}/`).catch(() => {})))
    toast.success(`${ids.length} department${ids.length !== 1 ? 's' : ''} deleted.`)
    setSelectedDept(new Set())
    await load()
  }

  if (!user || !userCanAccessAdminPanel(user)) return null

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <PageHeader
        title="Ministries & Departments"
        subtitle="Maintain ministry codes and departments. Every department belongs to exactly one ministry."
        action={
          <button type="button" onClick={load} className="btn-outline text-sm" disabled={loading}>
            Refresh
          </button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Ministries */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Ministries</h2>
          <div className="flex items-center gap-2">
            {selectedMin.size > 0 && (
              <button
                type="button"
                onClick={handleBulkDeleteMin}
                className="btn-danger text-xs inline-flex items-center gap-1.5 py-1.5 px-3"
              >
                <Trash2 size={12} />
                Delete {selectedMin.size}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMinForm({ code: '', name: '' })
                setError('')
                setMinModal('create')
              }}
              className="btn-gradient py-2 px-3 text-xs inline-flex items-center gap-1.5"
            >
              <Plus size={14} /> Add ministry
            </button>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    checked={ministries.length > 0 && ministries.every(m => selectedMin.has(m.id))}
                    onChange={toggleAllMin}
                  />
                </th>
                <th>Code</th>
                <th>Name</th>
                <th className="sr-only">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-8 text-center text-slate-400">Loading…</td></tr>
              ) : (
                ministries.map(m => (
                  <tr key={m.id} className={selectedMin.has(m.id) ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded"
                        checked={selectedMin.has(m.id)}
                        onChange={() => toggleOneMin(m.id)}
                      />
                    </td>
                    <td><span className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400">{m.code}</span></td>
                    <td><span className="text-sm font-medium text-slate-800 dark:text-slate-200">{m.name}</span></td>
                    <td>
                      <div className="flex items-center gap-0.5 justify-end">
                        <button
                          type="button"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                          onClick={() => { setMinForm({ code: m.code, name: m.name }); setError(''); setMinModal(m) }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          onClick={() => deleteMinistry(m)}
                          disabled={saving}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Departments */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Departments</h2>
          <div className="flex items-center gap-2">
            {selectedDept.size > 0 && (
              <button
                type="button"
                onClick={handleBulkDeleteDept}
                className="btn-danger text-xs inline-flex items-center gap-1.5 py-1.5 px-3"
              >
                <Trash2 size={12} />
                Delete {selectedDept.size}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setDeptForm({ ministry: ministries[0]?.id?.toString() ?? '', code: '', name: '' })
                setError('')
                setDeptModal('create')
              }}
              className="btn-gradient py-2 px-3 text-xs inline-flex items-center gap-1.5"
              disabled={!ministries.length}
            >
              <Plus size={14} /> Add department
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 px-5 py-2 border-b border-slate-100 dark:border-slate-800">
          When adding a department, choose the parent ministry first — departments are always nested under a ministry.
        </p>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    checked={departments.length > 0 && departments.every(d => selectedDept.has(d.id))}
                    onChange={toggleAllDept}
                  />
                </th>
                <th>Ministry</th>
                <th>Code</th>
                <th>Name</th>
                <th className="sr-only">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : (
                departments.map(d => (
                  <tr key={d.id} className={selectedDept.has(d.id) ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded"
                        checked={selectedDept.has(d.id)}
                        onChange={() => toggleOneDept(d.id)}
                      />
                    </td>
                    <td><span className="text-sm text-slate-500 dark:text-slate-400">{ministryName(d.ministry)}</span></td>
                    <td><span className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400">{d.code}</span></td>
                    <td><span className="text-sm font-medium text-slate-800 dark:text-slate-200">{d.name}</span></td>
                    <td>
                      <div className="flex items-center gap-0.5 justify-end">
                        <button
                          type="button"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                          onClick={() => { setDeptForm({ ministry: String(d.ministry), code: d.code, name: d.name }); setError(''); setDeptModal(d) }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          onClick={() => deleteDepartment(d)}
                          disabled={saving}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {minModal && (
        <Modal title={minModal === 'create' ? 'New ministry' : 'Edit ministry'} onClose={() => setMinModal(null)}>
          <form onSubmit={saveMinistry} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Code *</label>
              <input
                className="input text-sm"
                value={minForm.code}
                onChange={e => setMinForm(f => ({ ...f, code: e.target.value }))}
                required
                maxLength={32}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
              <input
                className="input text-sm"
                value={minForm.name}
                onChange={e => setMinForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-outline text-sm py-2 px-4" onClick={() => setMinModal(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-gradient text-sm py-2 px-4" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deptModal && (
        <Modal title={deptModal === 'create' ? 'New department' : 'Edit department'} onClose={() => setDeptModal(null)}>
          <form onSubmit={saveDepartment} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Ministry *</label>
              <select
                className="input text-sm"
                value={deptForm.ministry}
                onChange={e => setDeptForm(f => ({ ...f, ministry: e.target.value }))}
                required
              >
                <option value="">Select ministry…</option>
                {ministries.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Department code *</label>
              <input
                className="input text-sm"
                value={deptForm.code}
                onChange={e => setDeptForm(f => ({ ...f, code: e.target.value }))}
                required
                maxLength={32}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Department name *</label>
              <input
                className="input text-sm"
                value={deptForm.name}
                onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-outline text-sm py-2 px-4" onClick={() => setDeptModal(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-gradient text-sm py-2 px-4" disabled={saving || !deptForm.ministry}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit2, Plus, Trash2, X } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { userCanAccessAdminPanel } from '../../utils/adminAccess'
import { formatApiError } from '../../utils/apiError'
import { fetchAllPaginated } from '../../utils/paginatedApi'
import PageHeader from '../../components/shared/PageHeader'

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className={`card w-full p-0 overflow-hidden animate-scale-in ${wide ? 'max-w-lg' : 'max-w-md'}`}>
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

const ROUTED_UNIT_OPTIONS = [
  { value: '', label: '— Not linked —' },
  { value: 'odu', label: 'ODU' },
  { value: 'hr', label: 'HR Unit' },
  { value: 'vipam', label: 'VIPAM' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'csu', label: 'Corporate Services Unit' },
]

export default function MinistriesDepartments() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast   = useToast()
  const confirm = useConfirm()
  const [ministries, setMinistries] = useState([])
  const [departments, setDepartments] = useState([])
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [minModal, setMinModal] = useState(null)
  const [minForm, setMinForm] = useState({ code: '', name: '' })
  const [deptModal, setDeptModal] = useState(null)
  const [deptForm, setDeptForm] = useState({ ministry: '', code: '', name: '' })
  const [unitModal, setUnitModal] = useState(null)
  const [unitForm, setUnitForm] = useState({ department: '', code: '', name: '', routed_unit: '' })
  const [saving, setSaving] = useState(false)
  const [selectedMin, setSelectedMin] = useState(new Set())
  const [selectedDept, setSelectedDept] = useState(new Set())
  const [selectedUnit, setSelectedUnit] = useState(new Set())
  const [deptMinistryFilter, setDeptMinistryFilter] = useState('')

  useEffect(() => {
    if (user && !userCanAccessAdminPanel(user)) navigate('/', { replace: true })
  }, [user, navigate])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (userCanAccessAdminPanel(user)) {
        try {
          await api.post('/departments/ensure-opsc/')
        } catch {
          /* non-admins or transient errors — list load still proceeds */
        }
      }
      const [m, d, u] = await Promise.all([
        fetchAllPaginated('/ministries/'),
        fetchAllPaginated('/departments/'),
        fetchAllPaginated('/units/'),
      ])
      setMinistries(m)
      setDepartments(d)
      setUnits(u)
      const pm = m.find(
        ministry => /prime minister/i.test(ministry.name) || ministry.code === 'MPM' || ministry.code === 'OPM',
      )
      if (pm) {
        setDeptMinistryFilter(String(pm.id))
      }
    } catch (e) {
      setError('Could not load ministries, departments, or units.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const ministryName = id => ministries.find(m => m.id === id)?.name ?? '—'
  const departmentName = id => departments.find(d => d.id === id)?.name ?? '—'

  const opscDepartment = () => {
    const pm = ministries.find(
      m => /prime minister/i.test(m.name) || m.code === 'OPM' || m.code === 'MPM',
    )
    if (!pm) return departments[0]
    return departments.find(
      d => d.ministry === pm.id && d.code.toUpperCase() === 'OPSC',
    ) || departments.find(d => d.ministry === pm.id)
  }

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
      toast.error(formatApiError(err, 'Save failed.'))
    } finally {
      setSaving(false)
    }
  }

  const deleteMinistry = async m => {
    const ok = await confirm({
      title: 'Delete Ministry',
      message: `Delete "${m.name}"? All departments and units under it will also be removed. This cannot be undone.`,
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

  const deptCodeExists = (ministryId, code, excludeId) => {
    const norm = (code || '').trim().toLowerCase()
    if (!ministryId || !norm) return false
    return departments.some(
      d => d.ministry === ministryId
        && d.code.trim().toLowerCase() === norm
        && d.id !== excludeId,
    )
  }

  const filteredDepartments = deptMinistryFilter
    ? departments.filter(d => String(d.ministry) === deptMinistryFilter)
    : departments

  const saveDepartment = async e => {
    e.preventDefault()
    const ministryId = parseInt(deptForm.ministry, 10)
    const code = deptForm.code.trim().toUpperCase()
    if (deptModal === 'create' && deptCodeExists(ministryId, code)) {
      toast.error('A department with this code already exists under the selected ministry.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ministry: ministryId,
        code,
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
      toast.error(formatApiError(err, 'Save failed.'))
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
  const saveUnit = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        department: parseInt(unitForm.department, 10),
        code: unitForm.code.trim(),
        name: unitForm.name.trim(),
        routed_unit: unitForm.routed_unit || '',
      }
      if (unitModal === 'create') {
        await api.post('/units/', payload)
        toast.success('Unit created.')
      } else {
        await api.patch(`/units/${unitModal.id}/`, payload)
        toast.success('Unit updated.')
      }
      setUnitModal(null)
      await load()
    } catch (err) {
      toast.error(formatApiError(err, 'Save failed.'))
    } finally {
      setSaving(false)
    }
  }

  const deleteUnit = async u => {
    const ok = await confirm({
      title: 'Delete Unit',
      message: `Delete unit "${u.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    setSaving(true)
    try {
      await api.delete(`/units/${u.id}/`)
      await load()
      toast.success(`Unit "${u.name}" deleted.`)
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Could not delete unit.')
    } finally {
      setSaving(false)
    }
  }

  const toggleAllUnit = () => setSelectedUnit(prev =>
    prev.size === units.length ? new Set() : new Set(units.map(u => u.id))
  )
  const toggleOneUnit = id => setSelectedUnit(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const handleBulkDeleteUnit = async () => {
    const count = selectedUnit.size
    const ok = await confirm({
      title: `Delete ${count} Unit${count !== 1 ? 's' : ''}`,
      message: `Delete ${count} selected unit${count !== 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    const ids = [...selectedUnit]
    await Promise.all(ids.map(id => api.delete(`/units/${id}/`).catch(() => {})))
    toast.success(`${ids.length} unit${ids.length !== 1 ? 's' : ''} deleted.`)
    setSelectedUnit(new Set())
    await load()
  }

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

  const primeMinistry = ministries.find(
    m => /prime minister/i.test(m.name) || m.code === 'MPM' || m.code === 'OPM',
  )
  const opscDept = primeMinistry
    ? departments.find(d => d.ministry === primeMinistry.id && d.code.toUpperCase() === 'OPSC')
    : null
  const opscUnits = opscDept
    ? units.filter(u => u.department === opscDept.id).sort((a, b) => a.code.localeCompare(b.code))
    : []

  if (!user || !userCanAccessAdminPanel(user)) return null

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Ministries, Departments & Units"
        subtitle="Three levels: Ministry of the Prime Minister → OPSC (department) → units (IPDU, ODU, VIPAM, HR, Compliance, CSU). Do not create OPSC as a ministry or units as departments."
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

      {primeMinistry && opscDept && (
        <section className="card p-5 border-primary-100 dark:border-primary-900/40 bg-primary-50/30 dark:bg-primary-950/20">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">OPSC organisational structure</h2>
          <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2 font-medium">
            <li>
              <span className="text-xs uppercase tracking-wide text-slate-500 font-normal">Ministry</span>
              <br />
              {primeMinistry.name} <span className="font-mono text-xs text-primary-600">({primeMinistry.code})</span>
            </li>
            <li className="pl-4 border-l-2 border-primary-300 dark:border-primary-700">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-normal">Department</span>
              <br />
              {opscDept.name} <span className="font-mono text-xs text-primary-600">({opscDept.code})</span>
            </li>
            <li className="pl-8 border-l-2 border-primary-200 dark:border-primary-800">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-normal">Units</span>
              <ul className="mt-1 space-y-0.5 font-normal">
                {opscUnits.length > 0 ? opscUnits.map(u => (
                  <li key={u.id}>
                    <span className="font-mono text-xs text-primary-600">{u.code}</span>
                    {' — '}
                    {u.name}
                  </li>
                )) : (
                  <li className="text-slate-500">No units yet — use <strong>Add unit</strong> below and select the OPSC department.</li>
                )}
              </ul>
            </li>
          </ul>
        </section>
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
                const pm = ministries.find(
                  m => /prime minister/i.test(m.name) || m.code === 'OPM' || m.code === 'MPM',
                )
                setDeptForm({
                  ministry: deptMinistryFilter || pm?.id?.toString() || ministries[0]?.id?.toString() || '',
                  code: '',
                  name: '',
                })
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
          OPSC is already set up as a department under the Ministry of the Prime Minister; add <strong>units</strong> (ODU, IPDU, etc.) in the Units section below.
        </p>
        <div className="px-5 py-2 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-500">Filter by ministry</label>
          <select
            className="input text-sm max-w-xs py-1.5"
            value={deptMinistryFilter}
            onChange={e => setDeptMinistryFilter(e.target.value)}
          >
            <option value="">All ministries ({departments.length})</option>
            {ministries.map(m => (
              <option key={m.id} value={String(m.id)}>
                {m.name} ({departments.filter(d => d.ministry === m.id).length})
              </option>
            ))}
          </select>
        </div>
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
              ) : filteredDepartments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No departments for this ministry.
                  </td>
                </tr>
              ) : (
                filteredDepartments.map(d => (
                  <tr
                    key={d.id}
                    className={[
                      selectedDept.has(d.id) ? 'bg-primary-50/50 dark:bg-primary-900/10' : '',
                      d.code.toUpperCase() === 'OPSC' ? 'ring-1 ring-inset ring-primary-200 dark:ring-primary-800' : '',
                    ].filter(Boolean).join(' ')}
                  >
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

      {/* Units */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Units</h2>
          <div className="flex items-center gap-2">
            {selectedUnit.size > 0 && (
              <button
                type="button"
                onClick={handleBulkDeleteUnit}
                className="btn-danger text-xs inline-flex items-center gap-1.5 py-1.5 px-3"
              >
                <Trash2 size={12} />
                Delete {selectedUnit.size}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const opsc = opscDepartment()
                setUnitForm({
                  department: opsc?.id?.toString() ?? departments[0]?.id?.toString() ?? '',
                  code: '',
                  name: '',
                  routed_unit: '',
                })
                setUnitModal('create')
              }}
              className="btn-gradient py-2 px-3 text-xs inline-flex items-center gap-1.5"
              disabled={!departments.length}
            >
              <Plus size={14} /> Add unit
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 px-5 py-2 border-b border-slate-100 dark:border-slate-800">
          Units sit under the OPSC department (Ministry of the Prime Minister). For each unit, set <strong>Workflow route</strong> (ODU, HR, VIPAM, etc.) so submissions route to the correct manager queue.
        </p>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    checked={units.length > 0 && units.every(u => selectedUnit.has(u.id))}
                    onChange={toggleAllUnit}
                  />
                </th>
                <th>Ministry</th>
                <th>Department</th>
                <th>Code</th>
                <th>Unit name</th>
                <th>Route</th>
                <th className="sr-only">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Loading…</td></tr>
              ) : units.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">No units defined yet.</td></tr>
              ) : (
                units.map(u => (
                  <tr key={u.id} className={selectedUnit.has(u.id) ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded"
                        checked={selectedUnit.has(u.id)}
                        onChange={() => toggleOneUnit(u.id)}
                      />
                    </td>
                    <td><span className="text-sm text-slate-500">{u.ministry_name}</span></td>
                    <td><span className="text-sm text-slate-500">{u.department_name}</span></td>
                    <td><span className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400">{u.code}</span></td>
                    <td><span className="text-sm font-medium text-slate-800 dark:text-slate-200">{u.name}</span></td>
                    <td>
                      {u.routed_unit ? (
                        <span className="text-xs uppercase font-mono text-slate-600 dark:text-slate-400">{u.routed_unit}</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-0.5 justify-end">
                        <button
                          type="button"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                          onClick={() => {
                            setUnitForm({
                              department: String(u.department),
                              code: u.code,
                              name: u.name,
                              routed_unit: u.routed_unit || '',
                            })
                            setUnitModal(u)
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          onClick={() => deleteUnit(u)}
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
                className="input text-sm uppercase"
                value={deptForm.code}
                onChange={e => setDeptForm(f => ({ ...f, code: e.target.value }))}
                required
                maxLength={32}
              />
              {deptModal === 'create' && deptCodeExists(
                parseInt(deptForm.ministry, 10),
                deptForm.code,
              ) && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  This code is already used under the selected ministry. Use the existing row in the table or pick another code.
                </p>
              )}
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

      {unitModal && (
        <Modal title={unitModal === 'create' ? 'New unit' : 'Edit unit'} onClose={() => setUnitModal(null)} wide>
          <form onSubmit={saveUnit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Department *</label>
              <select
                className="input text-sm"
                value={unitForm.department}
                onChange={e => setUnitForm(f => ({ ...f, department: e.target.value }))}
                required
              >
                <option value="">Select department…</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {ministryName(d.ministry)} — {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Unit code *</label>
                <input
                  className="input text-sm"
                  value={unitForm.code}
                  onChange={e => setUnitForm(f => ({ ...f, code: e.target.value }))}
                  required
                  maxLength={32}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Workflow route</label>
                <select
                  className="input text-sm"
                  value={unitForm.routed_unit}
                  onChange={e => setUnitForm(f => ({ ...f, routed_unit: e.target.value }))}
                >
                  {ROUTED_UNIT_OPTIONS.map(o => (
                    <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Unit name *</label>
              <input
                className="input text-sm"
                value={unitForm.name}
                onChange={e => setUnitForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-outline text-sm py-2 px-4" onClick={() => setUnitModal(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-gradient text-sm py-2 px-4" disabled={saving || !unitForm.department}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

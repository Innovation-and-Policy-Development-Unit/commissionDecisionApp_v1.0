import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GripVertical, Edit2, Plus, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { userCanAccessAdminPanel } from '../../utils/adminAccess'
import { invalidateAgendaSectionsCache } from '../../hooks/useAgendaSections'
import PageHeader from '../../components/shared/PageHeader'

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className={`card w-full p-0 overflow-hidden animate-scale-in ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
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

const EMPTY_FORM = {
  code: '',
  label: '',
  is_special: false,
  is_active: true,
  receiver_roles: [],
}

/** Roles commonly configured as submission receivers (full list from role definitions). */
const RECEIVER_ROLE_HINTS = [
  'odu_manager',
  'hr_unit_manager',
  'vipam_manager',
  'compliance_manager',
  'csu_manager',
  'psc_officer',
  'psc_secretary',
  'odu_principal',
  'principal_org_dev_analyst',
  'principal_job_analyst',
  'hr_unit_principal',
  'vipam_principal',
]

export default function AgendaSectionsAdmin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [dragId, setDragId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [roleLabels, setRoleLabels] = useState({})

  useEffect(() => {
    if (user && !userCanAccessAdminPanel(user)) navigate('/', { replace: true })
  }, [user, navigate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/agenda-sections/')
      const list = (data.results ?? data).slice().sort(
        (a, b) => a.display_order - b.display_order || a.id - b.id,
      )
      setRows(list)
    } catch {
      toast.error('Could not load agenda sections.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    api.get('/role-defs/')
      .then(({ data }) => {
        const list = data.results ?? data
        const map = {}
        list.forEach(rd => {
          map[rd.role] = rd.role_label || rd.role
        })
        setRoleLabels(map)
      })
      .catch(() => {})
  }, [])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setModal('create')
  }

  const openEdit = row => {
    setForm({
      code: row.code,
      label: row.label,
      is_special: row.is_special,
      is_active: row.is_active,
      receiver_roles: row.receiver_roles || [],
    })
    setModal(row)
  }

  const toggleReceiverRole = roleCode => {
    setForm(f => {
      const current = f.receiver_roles || []
      const next = current.includes(roleCode)
        ? current.filter(r => r !== roleCode)
        : [...current, roleCode]
      return { ...f, receiver_roles: next.sort() }
    })
  }

  const save = async e => {
    e.preventDefault()
    if (!form.label.trim()) {
      toast.error('Label is required.')
      return
    }
    if (modal === 'create' && !form.code.trim()) {
      toast.error('Code is required.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        label: form.label.trim(),
        is_special: form.is_special,
        is_active: form.is_active,
        receiver_roles: form.receiver_roles || [],
      }
      if (modal === 'create') {
        payload.code = form.code.trim().toLowerCase().replace(/\s+/g, '_')
        await api.post('/agenda-sections/', payload)
        toast.success('Agenda section created.')
      } else {
        await api.patch(`/agenda-sections/${modal.id}/`, payload)
        toast.success('Agenda section updated.')
      }
      setModal(null)
      invalidateAgendaSectionsCache()
      await load()
    } catch (err) {
      const d = err.response?.data
      toast.error(typeof d === 'object' ? (d.detail || JSON.stringify(d)) : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async row => {
    const usage = row.usage || {}
    const total = (usage.submissions || 0) + (usage.agenda_items || 0) + (usage.form_types || 0)
    const ok = await confirm({
      title: 'Delete agenda section',
      message: total > 0
        ? `This section is in use (${usage.submissions || 0} submissions). Deactivate instead, or delete only if unused.`
        : `Delete "${row.label}"? This cannot be undone.`,
      confirmLabel: total > 0 ? 'Deactivate' : 'Delete',
    })
    if (!ok) return
    setSaving(true)
    try {
      if (total > 0) {
        await api.patch(`/agenda-sections/${row.id}/`, { is_active: false })
        toast.success('Section deactivated.')
      } else {
        await api.delete(`/agenda-sections/${row.id}/`)
        toast.success('Section deleted.')
      }
      invalidateAgendaSectionsCache()
      await load()
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Could not remove section.')
    } finally {
      setSaving(false)
    }
  }

  const persistOrder = async ordered => {
    try {
      await api.post('/agenda-sections/reorder/', { order: ordered.map(r => r.id) })
      invalidateAgendaSectionsCache()
      setRows(ordered)
      toast.success('Order saved.')
    } catch {
      toast.error('Could not save order.')
      await load()
    }
  }

  const onDragStart = (e, id) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(id))
  }

  const onDragOver = (e, id) => {
    e.preventDefault()
    if (dragId !== id) setDragOverId(id)
  }

  const onDrop = (e, targetId) => {
    e.preventDefault()
    const sourceId = dragId ?? Number(e.dataTransfer.getData('text/plain'))
    setDragId(null)
    setDragOverId(null)
    if (!sourceId || sourceId === targetId) return

    const next = [...rows]
    const fromIdx = next.findIndex(r => r.id === sourceId)
    const toIdx = next.findIndex(r => r.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    persistOrder(next)
  }

  const onDragEnd = () => {
    setDragId(null)
    setDragOverId(null)
  }

  return (
    <div>
      <PageHeader
        title="Agenda sections"
        subtitle="Manage agenda sections, submission routing (which roles receive new cases), and lodge form visibility."
        action={
          <button type="button" className="btn-primary flex items-center gap-2" onClick={openCreate}>
            <Plus size={16} />
            Add section
          </button>
        }
      />

      <div className="card overflow-hidden">
        <p className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
          Drag rows to reorder. Configure <strong>receiver roles</strong> per section (or under Administration → Roles).
          <strong> Meeting-only</strong> sections are hidden from ministry lodge. The <strong>code</strong> cannot change after creation.
        </p>

        {loading ? (
          <p className="p-8 text-sm text-slate-500 text-center">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-sm text-slate-500 text-center">No agenda sections defined.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map(row => (
              <li
                key={row.id}
                draggable
                onDragStart={e => onDragStart(e, row.id)}
                onDragOver={e => onDragOver(e, row.id)}
                onDrop={e => onDrop(e, row.id)}
                onDragEnd={onDragEnd}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 transition-colors',
                  dragOverId === row.id && 'bg-primary-50 dark:bg-primary-900/20',
                  !row.is_active && 'opacity-50',
                )}
              >
                <button
                  type="button"
                  className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600"
                  aria-label="Drag to reorder"
                  tabIndex={-1}
                >
                  <GripVertical size={18} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{row.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <code className="text-primary-600 dark:text-primary-400">{row.code}</code>
                    {row.is_special && (
                      <span className="ml-2 rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5">Meeting only</span>
                    )}
                    {!row.is_active && (
                      <span className="ml-2 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-1.5 py-0.5">Inactive</span>
                    )}
                  </p>
                  {(row.receiver_roles?.length > 0) && (
                    <p className="text-[10px] text-slate-500 mt-1 truncate">
                      Receivers:{' '}
                      {row.receiver_roles.map(r => roleLabels[r] || r).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                    onClick={() => openEdit(row)}
                    aria-label="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
                    onClick={() => remove(row)}
                    aria-label="Delete or deactivate"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal && (
        <Modal
          title={modal === 'create' ? 'Add agenda section' : `Edit — ${modal.label}`}
          onClose={() => setModal(null)}
          wide
        >
          <form onSubmit={save} className="space-y-4">
            {modal === 'create' && (
              <div>
                <label className="block text-sm font-medium mb-1">Code</label>
                <input
                  className="input font-mono text-sm"
                  required
                  placeholder="e.g. appointment"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                />
                <p className="text-xs text-slate-500 mt-1">Lowercase slug; used in API and database (cannot change later).</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Label</label>
              <input
                className="input"
                required
                placeholder="e.g. 5. Appointment / Acting Appointment"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_special}
                onChange={e => setForm(f => ({ ...f, is_special: e.target.checked }))}
              />
              Meeting-only (hide from ministry lodge form)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              />
              Active
            </label>
            <div>
              <label className="block text-sm font-medium mb-1">Roles that receive submissions</label>
              <p className="text-xs text-slate-500 mb-2">
                Users with these roles are notified when a case is lodged under this section.
                Leave empty to use the default routed-unit manager.
              </p>
              <div className="grid sm:grid-cols-2 gap-1 max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-lg p-2">
                {Object.keys(roleLabels).length > 0
                  ? Object.entries(roleLabels)
                    .sort((a, b) => a[1].localeCompare(b[1]))
                    .map(([code, label]) => (
                      <label key={code} className="flex items-center gap-2 text-xs cursor-pointer py-1 px-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <input
                          type="checkbox"
                          checked={(form.receiver_roles || []).includes(code)}
                          onChange={() => toggleReceiverRole(code)}
                        />
                        <span className="text-slate-700 dark:text-slate-300">{label}</span>
                      </label>
                    ))
                  : RECEIVER_ROLE_HINTS.map(code => (
                    <label key={code} className="flex items-center gap-2 text-xs cursor-pointer py-1 px-1">
                      <input
                        type="checkbox"
                        checked={(form.receiver_roles || []).includes(code)}
                        onChange={() => toggleReceiverRole(code)}
                      />
                      <code>{code}</code>
                    </label>
                  ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary px-5" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn-secondary px-5" onClick={() => setModal(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

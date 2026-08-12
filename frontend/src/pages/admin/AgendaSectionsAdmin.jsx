import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GripVertical, Edit2, Plus, Trash2, X, ArrowDown } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { userCanAccessAdminPanel } from '../../utils/adminAccess'
import { invalidateAgendaSectionsCache } from '../../hooks/useAgendaSections'
import PageHeader from '../../components/shared/PageHeader'
import BaseButton from '../../components/shared/BaseButton'
import BaseInput from '../../components/shared/BaseInput'
import BaseSelect from '../../components/shared/BaseSelect'
import BaseCheckbox from '../../components/shared/BaseCheckbox'

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className={`card w-full p-0 overflow-hidden animate-scale-in ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <BaseButton variant="ghost" size="icon" iconOnly onClick={onClose} icon={<X size={18} />} />
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

const CHAIN_STAGES = [
  { value: 'pending_manager_approval', label: 'Pending Manager Approval' },
  { value: 'pending_second_approval',  label: 'Pending Second Approval' },
]

const EMPTY_CHAIN_STEP = { stage: 'pending_manager_approval', roles: [], label: '' }

const EMPTY_FORM = {
  code: '',
  label: '',
  group: '',
  is_special: false,
  is_active: true,
  receiver_roles: [],
  digitized_form: null,
  approval_chain: [],
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
  'hr_unit_principal',
  'vipam_principal',
  'odu_senior',
  'hr_unit_senior',
  'vipam_senior',
  'csu_senior',
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
  const [formTypes, setFormTypes] = useState([])

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
        list.forEach(rd => { map[rd.role] = rd.role_label || rd.role })
        setRoleLabels(map)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    api.get('/form-types/', { params: { page_size: 200 } })
      .then(({ data }) => setFormTypes((data.results ?? data).filter(f => f.is_active)))
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
      group: row.group || '',
      is_special: row.is_special,
      is_active: row.is_active,
      receiver_roles: row.receiver_roles || [],
      digitized_form: row.digitized_form ?? null,
      approval_chain: row.approval_chain ?? [],
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
        group: form.group.trim(),
        is_special: form.is_special,
        is_active: form.is_active,
        receiver_roles: form.receiver_roles || [],
        digitized_form: form.digitized_form || null,
        approval_chain: (form.approval_chain || []).filter(s => s.stage && s.roles.length > 0),
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
          <BaseButton variant="primary" icon={<Plus size={16} />} onClick={openCreate}>
            Add section
          </BaseButton>
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
                <BaseButton
                  variant="ghost" size="icon" iconOnly
                  className="cursor-grab active:cursor-grabbing"
                  aria-label="Drag to reorder"
                  tabIndex={-1}
                  icon={<GripVertical size={18} />}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{row.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                    <code className="text-primary-600 dark:text-primary-400">{row.code}</code>
                    {row.group && (
                      <span className="rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5">{row.group}</span>
                    )}
                    {row.digitized_form_code && (
                      <span className="rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5">Form: {row.digitized_form_code}</span>
                    )}
                    {row.is_special && (
                      <span className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5">Meeting only</span>
                    )}
                    {!row.is_active && (
                      <span className="rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-1.5 py-0.5">Inactive</span>
                    )}
                  </p>
                  {(row.receiver_roles?.length > 0) && (
                    <p className="text-[10px] text-slate-500 mt-1 truncate">
                      Receivers:{' '}
                      {row.receiver_roles.map(r => roleLabels[r] || r).join(', ')}
                    </p>
                  )}
                  {(row.approval_chain?.length > 0) && (
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 truncate">
                      Chain: {row.approval_chain.map(s => s.label || s.stage).join(' → ')} → Secretary
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <BaseButton variant="ghost" size="icon" iconOnly onClick={() => openEdit(row)} aria-label="Edit" icon={<Edit2 size={16} />} />
                  <BaseButton variant="ghost" size="icon" iconOnly onClick={() => remove(row)} aria-label="Delete or deactivate" icon={<Trash2 size={16} />} />
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
                <BaseInput
                  label="Code"
                  required
                  placeholder="e.g. appointment"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  hint="Lowercase slug; used in API and database (cannot change later)."
                />
              </div>
            )}
            <BaseInput
              label="Label"
              required
              placeholder="e.g. Appointment / Acting Appointment"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              hint="Shown as the option text in the submission type dropdown."
            />
            <div>
              <BaseInput
                label="Group"
                list="group-suggestions"
                placeholder="e.g. Appointments"
                value={form.group}
                onChange={e => setForm(f => ({ ...f, group: e.target.value }))}
              />
              <datalist id="group-suggestions">
                {[...new Set(rows.map(r => r.group).filter(Boolean))].sort().map(g => (
                  <option key={g} value={g} />
                ))}
              </datalist>
              <p className="text-xs text-slate-500 mt-1">
                Sections with the same group appear together under an <code>&lt;optgroup&gt;</code> heading. Leave blank to appear ungrouped.
              </p>
            </div>
            <div>
              <BaseSelect
                label="Linked digitized form"
                placeholder="— None —"
                value={form.digitized_form != null ? String(form.digitized_form) : ''}
                options={formTypes
                  .slice()
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map(ft => ({ value: String(ft.id), label: `${ft.code} — ${ft.name}` }))}
                onChange={(_, v) => setForm(f => ({ ...f, digitized_form: v ? Number(v) : null }))}
              />
              <p className="text-xs text-slate-500 mt-1">When a submission is created under this type, this form opens automatically.</p>
            </div>
            <BaseCheckbox
              label="Meeting-only (hide from ministry lodge form)"
              checked={form.is_special}
              onChange={e => setForm(f => ({ ...f, is_special: e.target.checked }))}
            />
            <BaseCheckbox
              label="Active"
              checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
            />
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
                      <BaseCheckbox
                        key={code}
                        label={label}
                        checked={(form.receiver_roles || []).includes(code)}
                        onChange={() => toggleReceiverRole(code)}
                        className="py-1 px-1"
                      />
                    ))
                  : RECEIVER_ROLE_HINTS.map(code => (
                    <BaseCheckbox
                      key={code}
                      label={<code>{code}</code>}
                      checked={(form.receiver_roles || []).includes(code)}
                      onChange={() => toggleReceiverRole(code)}
                    />
                  ))}
              </div>
            </div>
            {/* ── Approval Chain ── */}
            <div>
              <label className="block text-sm font-medium mb-1">Approval chain</label>
              <p className="text-xs text-slate-500 mb-2">
                Steps required before the submission reaches the Secretary.
                Each step defines who approves and in what order.
                Leave empty for no pre-approval (submission goes straight to Secretary after creation).
              </p>

              {/* Step list */}
              <div className="space-y-2 mb-2">
                {(form.approval_chain || []).map((step, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-slate-500 w-6">#{idx + 1}</span>
                      <BaseInput
                        hideLabel label="Step label"
                        className="flex-1"
                        placeholder="Step label, e.g. VIPAM Manager Approval"
                        value={step.label}
                        onChange={e => setForm(f => {
                          const chain = [...(f.approval_chain || [])]
                          chain[idx] = { ...chain[idx], label: e.target.value }
                          return { ...f, approval_chain: chain }
                        })}
                      />
                      <BaseSelect
                        hideLabel label="Stage"
                        className="w-48"
                        value={step.stage}
                        options={CHAIN_STAGES.map(s => ({ value: s.value, label: s.label }))}
                        onChange={(_, v) => setForm(f => {
                          const chain = [...(f.approval_chain || [])]
                          chain[idx] = { ...chain[idx], stage: v }
                          return { ...f, approval_chain: chain }
                        })}
                      />
                      <BaseButton
                        variant="ghost" size="icon" iconOnly
                        aria-label="Remove step"
                        icon={<Trash2 size={14} />}
                        onClick={() => setForm(f => ({
                          ...f,
                          approval_chain: (f.approval_chain || []).filter((_, i) => i !== idx),
                        }))}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Roles that approve this step:</p>
                      <div className="grid sm:grid-cols-2 gap-1 max-h-36 overflow-y-auto border border-slate-100 dark:border-slate-700 rounded p-2">
                        {Object.keys(roleLabels).length > 0
                          ? Object.entries(roleLabels).sort((a, b) => a[1].localeCompare(b[1])).map(([code, rl]) => (
                            <BaseCheckbox
                              key={code}
                              label={rl}
                              checked={(step.roles || []).includes(code)}
                              onChange={() => setForm(f => {
                                const chain = [...(f.approval_chain || [])]
                                const current = chain[idx].roles || []
                                chain[idx] = {
                                  ...chain[idx],
                                  roles: current.includes(code)
                                    ? current.filter(r => r !== code)
                                    : [...current, code].sort(),
                                }
                                return { ...f, approval_chain: chain }
                              })}
                            />
                          ))
                          : <p className="text-xs text-slate-400 col-span-2">Loading roles…</p>
                        }
                      </div>
                    </div>
                    {idx < (form.approval_chain || []).length - 1 && (
                      <div className="flex justify-center mt-2 text-slate-400">
                        <ArrowDown size={14} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {(form.approval_chain || []).length < CHAIN_STAGES.length && (
                <BaseButton
                  variant="outline"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => setForm(f => ({
                    ...f,
                    approval_chain: [...(f.approval_chain || []), { ...EMPTY_CHAIN_STEP }],
                  }))}
                >
                  Add approval step
                </BaseButton>
              )}

              {(form.approval_chain || []).length > 0 && (
                <div className="mt-2 flex items-center gap-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
                  <ArrowDown size={12} className="shrink-0" />
                  <span>After all steps: submission is sent to Secretary / PSC</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <BaseButton type="submit" variant="primary" loading={saving} loadingLabel="Saving">Save</BaseButton>
              <BaseButton type="button" variant="secondary" onClick={() => setModal(null)}>Cancel</BaseButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

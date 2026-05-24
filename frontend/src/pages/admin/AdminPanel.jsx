/**
 * SCDMS Administration — Roles & Permissions hub
 *
 * Tabs: Users | Roles | Permissions
 * (API Keys, System Config, Security, and Backup & Restore use separate sidebar routes.)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Edit2,
  HardDrive,
  KeyRound,
  KeySquare,
  Lock,
  Mail,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Upload,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  userCanAccessAdminPanel, userCanManageRoles, userCanManageUsers,
} from '../../utils/adminAccess'

const TABS = [
  { id: 'users',       label: 'Users',            icon: Users,       needs: 'users'  },
  { id: 'roles',       label: 'Roles',            icon: Shield,      needs: 'roles'  },
  { id: 'permissions', label: 'Permissions',      icon: KeyRound,    needs: 'roles'  },
]

const ROLE_CHOICES = [
  { value: 'psc_admin', label: 'PSC Administrator' },
  { value: 'psc_officer', label: 'PSC Officer' },
  { value: 'psc_secretary', label: 'PSC Secretary' },
  { value: 'psc_commissioner', label: 'PSC Commissioner' },
  { value: 'psc_manager', label: 'OPSC Manager' },
  { value: 'principal_officer', label: 'Principal Officer' },
  { value: 'senior_officer', label: 'Senior Officer' },
  { value: 'ministry_hr', label: 'Ministry HR Officer' },
  { value: 'dept_admin', label: 'Department Admin Officer' },
  { value: 'compliance_manager', label: 'Compliance Manager' },
  { value: 'compliance_senior', label: 'Compliance Senior Officer' },
  { value: 'compliance_principal', label: 'Compliance Principal' },
]

const PERM_CATEGORIES = [
  { value: 'submissions', label: 'Submissions' },
  { value: 'workflow', label: 'Workflow & Transitions' },
  { value: 'reports', label: 'Reports & Analytics' },
  { value: 'secretariat', label: 'Secretariat Functions' },
  { value: 'tasks', label: 'Task Allocation' },
  { value: 'administration', label: 'System Administration' },
]

const ROLE_COLORS = {
  psc_admin: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  psc_officer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  psc_secretary: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  psc_commissioner: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  psc_manager: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  principal_officer: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  senior_officer: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  ministry_hr: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  dept_admin: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  compliance_manager: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  compliance_senior: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  compliance_principal: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
}

const CAT_COLORS = {
  submissions: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  workflow: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300',
  reports: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  secretariat: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  tasks: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300',
  administration: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
}

function RoleBadge({ role }) {
  const label = ROLE_CHOICES.find(r => r.value === role)?.label ?? role
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${ROLE_COLORS[role] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {label}
    </span>
  )
}

function CatBadge({ cat }) {
  const label = PERM_CATEGORIES.find(c => c.value === cat)?.label ?? cat
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${CAT_COLORS[cat] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {label}
    </span>
  )
}

function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null)
  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        ref={ref}
        className={`card p-0 overflow-hidden animate-scale-in w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function ErrorBanner({ error }) {
  if (!error) return null
  return (
    <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300 mb-4">
      <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
      {error}
    </div>
  )
}

function SuccessBanner({ message, onClear }) {
  if (!message) return null
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 mb-4 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-2">
        <Check size={16} />
        {message}
      </div>
      <button onClick={onClear}><X size={14} /></button>
    </div>
  )
}

const EMPTY_USER_FORM = {
  username: '',
  email: '',
  password: '',
  role: 'psc_officer',
  ministry_id: '',
  department_id: '',
}

function UsersTab({ users, ministries, departments, onRefresh }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [target, setTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_USER_FORM)
  const [pwForm, setPwForm] = useState({ password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(new Set())

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchQ = !q || u.username.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
    const matchR = !roleFilter || u.role === roleFilter
    return matchQ && matchR
  })

  const toggleAll = () => setSelected(prev =>
    prev.size === filtered.length ? new Set() : new Set(filtered.map(u => u.id))
  )
  const toggleOne = id => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const handleBulkDelete = async () => {
    const count = selected.size
    const ok = await confirm({
      title: `Delete ${count} User${count !== 1 ? 's' : ''}`,
      message: `Permanently delete ${count} selected user${count !== 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    const ids = [...selected]
    await Promise.all(ids.map(id => api.delete(`/users/${id}/`).catch(() => {})))
    toast.success(`${ids.length} user${ids.length !== 1 ? 's' : ''} deleted.`)
    setSelected(new Set())
    await onRefresh()
  }

  const openCreate = () => {
    setForm(EMPTY_USER_FORM)
    setError('')
    setModal('create')
  }
  const openEdit = u => {
    setTarget(u)
    setForm({
      username: u.username,
      email: u.email || '',
      password: '',
      role: u.role || 'psc_officer',
      ministry_id: u.ministry_id ?? '',
      department_id: u.department_id ?? '',
    })
    setError('')
    setModal('edit')
  }
  const openPw = u => {
    setTarget(u)
    setPwForm({ password: '' })
    setError('')
    setModal('password')
  }
  const close = () => {
    setModal(null)
    setError('')
  }

  const save = async () => {
    setLoading(true)
    setError('')
    try {
      const payload = {
        username: form.username,
        email: form.email,
        role: form.role,
        ministry_id: form.ministry_id || null,
        department_id: form.department_id || null,
      }
      if (modal === 'create') {
        await api.post('/users/', { ...payload, password: form.password })
        toast.success(`User "${form.username}" created successfully.`)
      } else {
        await api.patch(`/users/${target.id}/`, payload)
        toast.success(`User "${form.username}" updated.`)
      }
      await onRefresh()
      close()
    } catch (err) {
      const d = err.response?.data
      const msg = typeof d?.detail === 'string'
        ? d.detail
        : typeof d?.username?.[0] === 'string'
          ? d.username[0]
          : JSON.stringify(d) ?? 'Save failed.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const savePw = async () => {
    setLoading(true)
    setError('')
    try {
      await api.post(`/users/${target.id}/set-password/`, { password: pwForm.password })
      toast.success(`Password updated for ${target?.username}.`)
      close()
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Failed to update password.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async u => {
    try {
      await api.post(`/users/${u.id}/set-active/`, { is_active: !u.is_active })
      await onRefresh()
      toast.success(`${u.username} ${u.is_active ? 'deactivated' : 'reactivated'}.`)
    } catch {
      toast.error('Failed to update account status.')
    }
  }

  const unlockUser = async u => {
    try {
      await api.post(`/users/${u.id}/unlock/`)
      await onRefresh()
      toast.success(`${u.username}'s account unlocked.`)
    } catch {
      toast.error('Failed to unlock account.')
    }
  }

  const availDepts = departments.filter(d => !form.ministry_id || d.ministry === parseInt(form.ministry_id, 10))

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search username or email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setSelected(new Set()) }}
          />
        </div>
        <select className="input text-sm w-full sm:w-48" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setSelected(new Set()) }}>
          <option value="">All roles</option>
          {ROLE_CHOICES.map(r => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {selected.size > 0 && (
          <button type="button" onClick={handleBulkDelete} className="btn-danger py-2 px-4 text-sm whitespace-nowrap inline-flex items-center gap-1.5">
            <Trash2 size={14} /> Delete {selected.size}
          </button>
        )}
        <button type="button" onClick={openCreate} className="btn-gradient py-2 px-4 text-sm whitespace-nowrap inline-flex items-center gap-1.5">
          <Plus size={14} /> New User
        </button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded"
                  checked={filtered.length > 0 && filtered.every(u => selected.has(u.id))}
                  onChange={toggleAll}
                />
              </th>
              <th>User</th>
              <th>Role</th>
              <th>Ministry / Dept</th>
              <th className="text-center">Active</th>
              <th className="sr-only">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-400 text-sm">
                  No users found.
                </td>
              </tr>
            )}
            {filtered.map(u => (
              <tr key={u.id} className={`${!u.is_active ? 'opacity-60' : ''} ${selected.has(u.id) ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                <td>
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    checked={selected.has(u.id)}
                    onChange={() => toggleOne(u.id)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 ${u.is_active ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                        {u.username}
                        {u.role === 'psc_admin' && <Shield size={11} className="text-violet-500" />}
                        {!u.is_active && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            <UserX size={9} /> Deactivated
                          </span>
                        )}
                        {u.is_locked && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                            <Lock size={9} /> Locked{u.failed_attempts > 0 ? ` (${u.failed_attempts})` : ''}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">{u.email || '—'}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <RoleBadge role={u.role} />
                </td>
                <td className="text-xs text-slate-500 dark:text-slate-400">
                  {u.ministry_name || '—'}
                  {u.department_name && (
                    <>
                      <br />
                      {u.department_name}
                    </>
                  )}
                </td>
                <td className="text-center">
                  <button
                    type="button"
                    onClick={() => toggleActive(u)}
                    title={u.is_active ? 'Deactivate account' : 'Reactivate account'}
                    className="inline-flex items-center gap-1 group"
                  >
                    {u.is_active ? (
                      <ToggleRight size={22} className="text-emerald-500 group-hover:text-emerald-600" />
                    ) : (
                      <ToggleLeft size={22} className="text-slate-300 dark:text-slate-600 group-hover:text-emerald-400" />
                    )}
                  </button>
                </td>
                <td>
                  <div className="flex items-center gap-0.5 justify-end">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openPw(u)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                      title="Reset password"
                    >
                      <KeyRound size={13} />
                    </button>
                    {u.is_locked && (
                      <button
                        type="button"
                        onClick={() => unlockUser(u)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-orange-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                        title="Unlock account"
                      >
                        <UserCheck size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        {filtered.length} of {users.length} users
      </p>

      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'New User' : `Edit — ${target?.username}`} onClose={close}>
          <ErrorBanner error={error} />
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Username *</label>
                <input
                  className="input text-sm"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  className="input text-sm"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            {modal === 'create' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Password *</label>
                <input
                  type="password"
                  className="input text-sm"
                  minLength={8}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min 8 characters"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Role *</label>
              <select className="input text-sm" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLE_CHOICES.map(r => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Ministry</label>
                <select
                  className="input text-sm"
                  value={form.ministry_id}
                  onChange={e => setForm(f => ({ ...f, ministry_id: e.target.value, department_id: '' }))}
                >
                  <option value="">— None —</option>
                  {ministries.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                <select
                  className="input text-sm"
                  value={form.department_id}
                  onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                  disabled={!form.ministry_id}
                >
                  <option value="">— None —</option>
                  {availDepts.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={close} className="btn-outline py-2 px-4 text-sm">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={loading} className="btn-gradient py-2 px-4 text-sm disabled:opacity-60">
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'password' && (
        <Modal title={`Reset Password — ${target?.username}`} onClose={close}>
          <ErrorBanner error={error} />
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Set a new password for this account. The user will need to use it on their next sign-in.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">New Password *</label>
            <input
              type="password"
              className="input text-sm"
              minLength={8}
              placeholder="Min 8 characters"
              value={pwForm.password}
              onChange={e => setPwForm({ password: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={close} className="btn-outline py-2 px-4 text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={savePw}
              disabled={loading || pwForm.password.length < 8}
              className="btn-gradient py-2 px-4 text-sm disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Set Password'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function RolesTab({ roleDefs, permissions, onRefresh }) {
  const toast = useToast()
  const [selected, setSelected] = useState(null)
  const [desc, setDesc] = useState('')
  const [checked, setChecked] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const openRole = rd => {
    setSelected(rd)
    setDesc(rd.description)
    setChecked(new Set(rd.permissions.map(p => p.id)))
    setError('')
    setSaved(false)
  }

  const toggle = id => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSaved(false)
  }

  const save = async () => {
    if (!selected) return
    setLoading(true)
    setError('')
    setSaved(false)
    try {
      await api.patch(`/role-defs/${selected.id}/`, {
        description: desc,
        permission_ids: [...checked],
      })
      await onRefresh()
      setSaved(true)
      toast.success(`Role permissions updated.`)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Save failed.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const grouped = PERM_CATEGORIES.map(cat => ({
    ...cat,
    perms: permissions.filter(p => p.category === cat.value),
  })).filter(g => g.perms.length > 0)

  return (
    <div className="grid xl:grid-cols-5 gap-6">
      <div className="xl:col-span-2 space-y-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          System Roles
        </p>
        {roleDefs.map(rd => (
          <button
            key={rd.id}
            type="button"
            onClick={() => openRole(rd)}
            className={`w-full text-left rounded-xl px-4 py-3.5 transition-all border ${
              selected?.id === rd.id
                ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <RoleBadge role={rd.role} />
              {rd.is_builtin && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Lock size={9} /> built-in
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {rd.description || 'No description.'}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
              <span>{rd.permissions.length} permissions</span>
              <span>
                {rd.user_count} user{rd.user_count !== 1 ? 's' : ''}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="xl:col-span-3">
        {!selected ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center h-64 text-slate-400 text-sm">
            Select a role to view and edit its permissions
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <RoleBadge role={selected.role} />
                <span className="ml-2 text-xs text-slate-400">
                  {selected.user_count} user{selected.user_count !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {saved && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={13} /> Saved
                  </span>
                )}
                <button type="button" onClick={save} disabled={loading} className="btn-gradient py-1.5 px-3 text-xs disabled:opacity-60">
                  {loading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <ErrorBanner error={error} />
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Role Description</label>
                <textarea
                  rows={3}
                  className="input text-sm resize-none"
                  value={desc}
                  onChange={e => {
                    setDesc(e.target.value)
                    setSaved(false)
                  }}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Permissions ({checked.size} assigned)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setChecked(new Set(permissions.map(p => p.id)))
                        setSaved(false)
                      }}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        setChecked(new Set())
                        setSaved(false)
                      }}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                  {grouped.map(({ value, label, perms }) => (
                    <div key={value}>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">{label}</p>
                      <div className="space-y-1">
                        {perms.map(p => (
                          <label
                            key={p.id}
                            className="flex items-start gap-2.5 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <div
                              role="presentation"
                              onClick={() => toggle(p.id)}
                              className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                                checked.has(p.id) ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {checked.has(p.id) && <Check size={10} className="text-white" />}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{p.label}</p>
                              {p.description && <p className="text-[11px] text-slate-400 leading-snug">{p.description}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const EMPTY_PERM = { code: '', label: '', category: 'administration', description: '' }

function PermissionsTab({ permissions, onRefresh }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [catFilt, setCatFilt] = useState('')
  const [modal, setModal] = useState(null)
  const [target, setTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_PERM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = permissions.filter(p => {
    const q = search.toLowerCase()
    const matchQ = !q || p.code.toLowerCase().includes(q) || p.label.toLowerCase().includes(q)
    const matchC = !catFilt || p.category === catFilt
    return matchQ && matchC
  })

  const openCreate = () => {
    setForm(EMPTY_PERM)
    setError('')
    setModal('create')
  }
  const openEdit = p => {
    setTarget(p)
    setForm({ code: p.code, label: p.label, category: p.category, description: p.description })
    setError('')
    setModal('edit')
  }
  const close = () => {
    setModal(null)
    setError('')
  }

  const save = async () => {
    setLoading(true)
    setError('')
    try {
      if (modal === 'create') {
        await api.post('/permissions/', form)
        toast.success(`Permission "${form.code}" created.`)
      } else {
        await api.patch(`/permissions/${target.id}/`, form)
        toast.success(`Permission "${form.code}" updated.`)
      }
      await onRefresh()
      close()
    } catch (err) {
      const d = err.response?.data
      const msg = typeof d?.code?.[0] === 'string' ? d.code[0] : d?.detail ?? 'Save failed.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const del = async p => {
    if (p.is_builtin) return
    const ok = await confirm({
      title: 'Delete permission?',
      message: `"${p.code}" will be removed from all roles. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/permissions/${p.id}/`)
      await onRefresh()
      toast.success(`Permission "${p.code}" deleted.`)
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Delete failed.')
    }
  }

  const grouped = PERM_CATEGORIES.map(cat => ({
    ...cat,
    perms: filtered.filter(p => p.category === cat.value),
  })).filter(g => g.perms.length > 0)

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search code or label…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input text-sm w-full sm:w-52" value={catFilt} onChange={e => setCatFilt(e.target.value)}>
          <option value="">All categories</option>
          {PERM_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={openCreate} className="btn-gradient py-2 px-4 text-sm whitespace-nowrap inline-flex items-center gap-1.5">
          <Plus size={14} /> New Permission
        </button>
      </div>

      <div className="space-y-5">
        {grouped.length === 0 && <p className="text-center text-slate-400 text-sm py-10">No permissions found.</p>}
        {grouped.map(({ value, label, perms }) => (
          <div key={value}>
            <div className="flex items-center gap-2 mb-2">
              <CatBadge cat={value} />
              <span className="text-xs text-slate-400">
                {perms.length} permission{perms.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Label</th>
                    <th className="hidden md:table-cell">Description</th>
                    <th className="text-center">Built-in</th>
                    <th className="sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {perms.map(p => (
                    <tr key={p.id}>
                      <td>
                        <code className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                          {p.code}
                        </code>
                      </td>
                      <td className="font-medium text-slate-700 dark:text-slate-300 text-xs">{p.label}</td>
                      <td className="text-xs text-slate-400 hidden md:table-cell max-w-xs truncate">
                        {p.description || '—'}
                      </td>
                      <td className="text-center">
                        {p.is_builtin ? (
                          <Lock size={13} className="text-slate-400 mx-auto" />
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-0.5 justify-end">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          {!p.is_builtin && (
                            <button
                              type="button"
                              onClick={() => del(p)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-3">
        {filtered.length} of {permissions.length} permissions
      </p>

      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'New Permission' : `Edit — ${target?.code}`} onClose={close}>
          <ErrorBanner error={error} />
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Code *</label>
                <input
                  className="input text-sm"
                  placeholder="e.g. view_submissions"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  disabled={modal === 'edit' && target?.is_builtin}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Category *</label>
                <select className="input text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {PERM_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Label *</label>
              <input
                className="input text-sm"
                placeholder="Human-readable label"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea
                rows={2}
                className="input text-sm resize-none"
                placeholder="What does this permission grant?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={close} className="btn-outline py-2 px-4 text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={loading || !form.code || !form.label}
              className="btn-gradient py-2 px-4 text-sm disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function APIKeysTab({ apiKeys, users, onRefresh }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', user: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newKey, setNewKey] = useState('')

  const openCreate = () => {
    setForm({ name: '', user: '' })
    setNewKey('')
    setError('')
    setModal('create')
  }
  const close = () => {
    setModal(null)
    setError('')
    setNewKey('')
  }
  const save = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/api-keys/', form)
      setNewKey(res.data.key)
      await onRefresh()
      toast.success(`API key "${form.name}" generated.`)
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Failed to generate key.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }
  const del = async k => {
    const ok = await confirm({
      title: 'Revoke API key?',
      message: `"${k.name}" will be permanently deleted and any integrations using it will stop working.`,
      confirmLabel: 'Revoke',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await api.delete(`/api-keys/${k.id}/`)
      await onRefresh()
      toast.success(`API key "${k.name}" revoked.`)
    } catch {
      toast.error('Failed to revoke key.')
    }
  }
  const toggleActive = async k => {
    try {
      await api.patch(`/api-keys/${k.id}/`, { is_active: !k.is_active })
      await onRefresh()
      toast.success(`API key "${k.name}" ${k.is_active ? 'disabled' : 'enabled'}.`)
    } catch {
      toast.error('Failed to update key status.')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-slate-500">API keys allow external systems to interact with the SCDMS API.</p>
        <button type="button" onClick={openCreate} className="btn-gradient py-2 px-4 text-sm inline-flex items-center gap-1.5">
          <Plus size={14} /> New API Key
        </button>
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Key Name</th>
              <th>Owner</th>
              <th>Created</th>
              <th>Last Used</th>
              <th className="text-center">Active</th>
              <th className="sr-only">Actions</th>
            </tr>
          </thead>
          <tbody>
            {apiKeys.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-slate-400">No API keys found.</td></tr>
            )}
            {apiKeys.map(k => (
              <tr key={k.id}>
                <td className="font-medium text-slate-800 dark:text-slate-200">{k.name}</td>
                <td className="text-slate-500 dark:text-slate-400">{k.user_username}</td>
                <td className="text-xs text-slate-500 dark:text-slate-400">{new Date(k.created_at).toLocaleDateString()}</td>
                <td className="text-xs text-slate-500 dark:text-slate-400">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}</td>
                <td className="text-center">
                  <button type="button" onClick={() => toggleActive(k)}>
                    {k.is_active ? <ToggleRight size={22} className="text-emerald-500" /> : <ToggleLeft size={22} className="text-slate-300 dark:text-slate-600" />}
                  </button>
                </td>
                <td>
                  <div className="flex items-center gap-0.5 justify-end">
                    <button
                      type="button"
                      onClick={() => del(k)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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

      {modal === 'create' && (
        <Modal title="Generate New API Key" onClose={close}>
          <ErrorBanner error={error} />
          {!newKey ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Key Name *</label>
                <input className="input text-sm" placeholder="e.g. Stats Tool" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Owner User *</label>
                <select className="input text-sm" value={form.user} onChange={e => setForm({...form, user: e.target.value})}>
                  <option value="">— Select User —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button type="button" onClick={close} className="btn-outline py-2 px-4 text-sm">Cancel</button>
                <button type="button" onClick={save} disabled={loading || !form.name || !form.user} className="btn-gradient py-2 px-4 text-sm">Generate</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 p-4 rounded-lg">
                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium mb-2">Copy this key now. It will NOT be shown again.</p>
                <div className="bg-white dark:bg-slate-900 p-3 rounded border font-mono text-sm break-all select-all">{newKey}</div>
              </div>
              <button type="button" onClick={close} className="btn-primary w-full py-2 text-sm">I have copied it</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

export function SettingsTab({ settings, onRefresh }) {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const { refreshFeedbackStatus } = useTheme()
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [lockoutStats, setLockoutStats] = useState({ failure_limit: 5, cooloff_hours: 1, locked_accounts: 0 })
  const [lockoutLoading, setLockoutLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [testEmailTo, setTestEmailTo] = useState('')
  const [testEmailLoading, setTestEmailLoading] = useState(false)

  const fetchLockoutStats = useCallback(async () => {
    try {
      const res = await api.get('/users/lockout-stats/')
      setLockoutStats(res.data)
    } catch {
      /* best-effort */
    }
  }, [])

  useEffect(() => {
    fetchLockoutStats()
  }, [fetchLockoutStats])

  useEffect(() => {
    if (user?.email && !testEmailTo) setTestEmailTo(user.email)
  }, [user?.email, testEmailTo])

  useEffect(() => {
    const s = {}
    settings.forEach(item => { s[item.key] = item.value })
    const defaults = ['ENABLE_USER_FEEDBACK', 'TWO_FACTOR_REQUIRED', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_TLS', 'SMTP_SSL', 'DEFAULT_FROM_EMAIL', 'AXES_FAILURE_LIMIT', 'AXES_COOLOFF_HOURS', 'LOGIN_RATE_LIMIT', 'PASSWORD_MIN_LENGTH', 'PASSWORD_REQUIRE_UPPERCASE', 'PASSWORD_REQUIRE_LOWERCASE', 'PASSWORD_REQUIRE_DIGITS', 'PASSWORD_REQUIRE_SPECIAL', 'PASSWORD_HISTORY_COUNT']
    defaults.forEach(k => { if (s[k] === undefined) s[k] = '' })
    if (s.ENABLE_USER_FEEDBACK === '') s.ENABLE_USER_FEEDBACK = 'true'
    if (!s.PASSWORD_MIN_LENGTH)    s.PASSWORD_MIN_LENGTH    = '8'
    if (!s.PASSWORD_HISTORY_COUNT) s.PASSWORD_HISTORY_COUNT = '5'
    // Seed from live stats if not in DB settings yet
    if (!s.AXES_FAILURE_LIMIT) s.AXES_FAILURE_LIMIT = String(lockoutStats.failure_limit)
    if (!s.AXES_COOLOFF_HOURS) s.AXES_COOLOFF_HOURS = String(lockoutStats.cooloff_hours)
    setForm(s)
  }, [settings, lockoutStats])

  const save = async e => {
    e.preventDefault()
    setLoading(true)
    setSuccess('')
    setError('')
    try {
      await api.post('/settings/batch-update/', form)
      setSuccess('Settings updated successfully.')
      toast.success('Settings updated successfully.')
      await onRefresh()
      await fetchLockoutStats()
      if (refreshFeedbackStatus) await refreshFeedbackStatus()
    } catch {
      setError('Failed to update settings.')
      toast.error('Failed to update settings.')
    } finally {
      setLoading(false)
    }
  }

  const saveLockoutSettings = async () => {
    setLockoutLoading(true)
    setSuccess('')
    setError('')
    try {
      await api.post('/settings/batch-update/', {
        AXES_FAILURE_LIMIT: form.AXES_FAILURE_LIMIT,
        AXES_COOLOFF_HOURS: form.AXES_COOLOFF_HOURS,
        LOGIN_RATE_LIMIT: form.LOGIN_RATE_LIMIT,
      })
      await fetchLockoutStats()
      const msg = 'Account security settings saved. Login rate limit requires a server restart to take effect.'
      setSuccess(msg)
      toast.success(msg)
    } catch {
      setError('Failed to save security settings.')
      toast.error('Failed to save security settings.')
    } finally {
      setLockoutLoading(false)
    }
  }

  const resetAllLockouts = async () => {
    const ok = await confirm({
      title: 'Clear all lockouts?',
      message: 'All locked-out users will be able to sign in immediately. Use with caution.',
      confirmLabel: 'Clear All',
      variant: 'warning',
    })
    if (!ok) return
    setResetLoading(true)
    setSuccess('')
    setError('')
    try {
      const res = await api.post('/users/reset-all-lockouts/')
      await fetchLockoutStats()
      const msg = res.data.detail ?? 'All lockouts cleared.'
      setSuccess(msg)
      toast.success(msg)
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Failed to reset lockouts.'
      setError(msg)
      toast.error(msg)
    } finally {
      setResetLoading(false)
    }
  }

  const toggle = key => setForm(f => ({ ...f, [key]: f[key] === 'true' ? 'false' : 'true' }))

  const SMTP_SETTING_KEYS = [
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD',
    'SMTP_TLS', 'SMTP_SSL', 'DEFAULT_FROM_EMAIL',
  ]

  const sendTestEmail = async () => {
    const to = testEmailTo.trim()
    if (!to) {
      toast.error('Enter a recipient email address.')
      return
    }
    setTestEmailLoading(true)
    setSuccess('')
    setError('')
    try {
      const smtpPayload = {}
      SMTP_SETTING_KEYS.forEach(k => { smtpPayload[k] = form[k] ?? '' })
      await api.post('/settings/batch-update/', smtpPayload)
      const res = await api.post('/settings/test-email/', { to })
      const msg = res.data.detail ?? `Test email sent to ${to}.`
      setSuccess(msg)
      toast.success(msg)
    } catch (err) {
      const data = err.response?.data
      let msg = data?.detail ?? 'Failed to send test email.'
      if (data?.smtp && !data.password_configured) {
        msg += ' (No password is stored — re-enter the App Password and send again.)'
      }
      setError(msg)
      toast.error(typeof msg === 'string' ? msg : 'Failed to send test email.')
    } finally {
      setTestEmailLoading(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <SuccessBanner message={success} onClear={() => setSuccess('')} />
      <ErrorBanner error={error} />
      <form onSubmit={save} className="space-y-8">
        {/* ── Feature Toggles ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium border-b pb-2">
            <ToggleRight size={18} className="text-primary-500" />
            <h3>Feature Toggles</h3>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl border bg-white dark:bg-slate-800/40">
            <div>
              <p className="text-sm font-medium">Enable User Feedback System</p>
              <p className="text-xs text-slate-500">Show floating feedback button and admin management tools.</p>
            </div>
            <button type="button" onClick={() => toggle('ENABLE_USER_FEEDBACK')}>
              {form.ENABLE_USER_FEEDBACK === 'true' ? <ToggleRight size={32} className="text-primary-500" /> : <ToggleLeft size={32} className="text-slate-300" />}
            </button>
          </div>
        </section>

        {/* ── Two-Factor Authentication ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium border-b pb-2">
            <ShieldAlert size={18} className="text-primary-500" />
            <h3>Security & Authentication</h3>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl border bg-white dark:bg-slate-800/40">
            <div>
              <p className="text-sm font-medium">Enforce Two-Factor Authentication (2FA)</p>
              <p className="text-xs text-slate-500">Code verification required at login.</p>
            </div>
            <button type="button" onClick={() => toggle('TWO_FACTOR_REQUIRED')}>
              {form.TWO_FACTOR_REQUIRED === 'true' ? <ToggleRight size={32} className="text-primary-500" /> : <ToggleLeft size={32} className="text-slate-300" />}
            </button>
          </div>
        </section>

        {/* ── Account Lockout & Rate Limiting ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium border-b pb-2">
            <Lock size={18} className="text-orange-500" />
            <h3>Account Lockout &amp; Rate Limiting</h3>
            {lockoutStats.locked_accounts > 0 && (
              <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                <Lock size={11} /> {lockoutStats.locked_accounts} account{lockoutStats.locked_accounts !== 1 ? 's' : ''} currently locked
              </span>
            )}
            {lockoutStats.locked_accounts === 0 && (
              <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                <UserCheck size={11} /> No accounts locked
              </span>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Max Login Attempts
              </label>
              <input
                type="number"
                min={1}
                max={20}
                className="input text-sm"
                value={form.AXES_FAILURE_LIMIT || ''}
                onChange={e => setForm(f => ({ ...f, AXES_FAILURE_LIMIT: e.target.value }))}
              />
              <p className="text-[11px] text-slate-400">Failures before account lock (currently: {lockoutStats.failure_limit})</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Lockout Duration (hours)
              </label>
              <input
                type="number"
                min={0.25}
                max={72}
                step={0.25}
                className="input text-sm"
                value={form.AXES_COOLOFF_HOURS || ''}
                onChange={e => setForm(f => ({ ...f, AXES_COOLOFF_HOURS: e.target.value }))}
              />
              <p className="text-[11px] text-slate-400">Auto-unlock after (currently: {lockoutStats.cooloff_hours}h)</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Login Rate Limit
              </label>
              <input
                type="text"
                className="input text-sm font-mono"
                placeholder="e.g. 5/m"
                value={form.LOGIN_RATE_LIMIT || ''}
                onChange={e => setForm(f => ({ ...f, LOGIN_RATE_LIMIT: e.target.value }))}
              />
              <p className="text-[11px] text-slate-400">Per IP (e.g. 5/m, 20/h). Restart required.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Reset all lockouts danger action */}
            <div className="flex items-start gap-3 p-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 flex-1 min-w-0">
              <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-red-700 dark:text-red-400">Reset All Lockouts</p>
                <p className="text-[11px] text-red-600/70 dark:text-red-500/70">
                  Immediately unlock every locked-out account. Use with caution.
                </p>
              </div>
              <button
                type="button"
                onClick={resetAllLockouts}
                disabled={resetLoading || lockoutStats.locked_accounts === 0}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {resetLoading ? <RefreshCw size={12} className="animate-spin" /> : <UserCheck size={12} />}
                {resetLoading ? 'Resetting…' : 'Reset All'}
              </button>
            </div>

            {/* Save security settings button */}
            <button
              type="button"
              onClick={saveLockoutSettings}
              disabled={lockoutLoading}
              className="inline-flex items-center gap-2 py-2 px-5 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-60 transition-colors flex-shrink-0"
            >
              {lockoutLoading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              Save Security Settings
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium border-b pb-2">
            <Mail size={18} className="text-primary-500" />
            <h3>Email Server (SMTP)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><label className="text-xs font-medium text-slate-500">SMTP Host</label><input className="input text-sm" value={form.SMTP_HOST || ''} onChange={e => setForm({...form, SMTP_HOST: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-slate-500">SMTP Port</label><input type="number" className="input text-sm" value={form.SMTP_PORT || ''} onChange={e => setForm({...form, SMTP_PORT: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-slate-500">SMTP User</label><input className="input text-sm" value={form.SMTP_USER || ''} onChange={e => setForm({...form, SMTP_USER: e.target.value})} /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-slate-500">SMTP Password</label><input type="password" title="SMTP Password" name="smtp_password" className="input text-sm" value={form.SMTP_PASSWORD || ''} onChange={e => setForm({...form, SMTP_PASSWORD: e.target.value})} /></div>
            <div className="space-y-1 md:col-span-2"><label className="text-xs font-medium text-slate-500">Default From Email</label><input className="input text-sm" value={form.DEFAULT_FROM_EMAIL || ''} onChange={e => setForm({...form, DEFAULT_FROM_EMAIL: e.target.value})} /></div>
          </div>
          <div className="flex gap-6">
             <div className="flex items-center gap-2"><button type="button" onClick={() => toggle('SMTP_TLS')}>{form.SMTP_TLS === 'true' ? <ToggleRight size={24} className="text-emerald-500" /> : <ToggleLeft size={24} className="text-slate-300" />}</button><span className="text-xs">Use TLS</span></div>
             <div className="flex items-center gap-2"><button type="button" onClick={() => toggle('SMTP_SSL')}>{form.SMTP_SSL === 'true' ? <ToggleRight size={24} className="text-emerald-500" /> : <ToggleLeft size={24} className="text-slate-300" />}</button><span className="text-xs">Use SSL</span></div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gmail: <code className="text-[11px]">smtp.gmail.com</code>, port <code className="text-[11px]">587</code>, TLS on, SSL off.
              SMTP User = the Google account that owns the App Password. Paste the 16-character App Password
              (spaces are fine). Default From should use the same address. On Render, leave{' '}
              <code className="text-[11px]">SMTP_PASSWORD</code> empty in Environment if you save it here only.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-slate-500">Test recipient</label>
                <input
                  type="email"
                  className="input text-sm"
                  placeholder="you@example.com"
                  value={testEmailTo}
                  onChange={e => setTestEmailTo(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={sendTestEmail}
                disabled={testEmailLoading}
                className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium border border-primary-500 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-60 transition-colors sm:flex-shrink-0"
              >
                {testEmailLoading ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
                {testEmailLoading ? 'Sending…' : 'Send test email'}
              </button>
            </div>
          </div>
        </section>
        {/* ── Password Policy ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-medium border-b pb-2">
            <KeySquare size={18} className="text-violet-500" />
            <h3>Password Policy</h3>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Minimum Length</label>
              <input
                type="number" min={6} max={64} className="input text-sm"
                value={form.PASSWORD_MIN_LENGTH || '8'}
                onChange={e => setForm(f => ({ ...f, PASSWORD_MIN_LENGTH: e.target.value }))}
              />
              <p className="text-[11px] text-slate-400">Characters required (minimum 6).</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Password History</label>
              <input
                type="number" min={0} max={24} className="input text-sm"
                value={form.PASSWORD_HISTORY_COUNT || '5'}
                onChange={e => setForm(f => ({ ...f, PASSWORD_HISTORY_COUNT: e.target.value }))}
              />
              <p className="text-[11px] text-slate-400">Prevent reuse of last N passwords (0 = disabled).</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { key: 'PASSWORD_REQUIRE_UPPERCASE', label: 'Require uppercase letter', sub: 'At least one A–Z' },
              { key: 'PASSWORD_REQUIRE_LOWERCASE', label: 'Require lowercase letter', sub: 'At least one a–z' },
              { key: 'PASSWORD_REQUIRE_DIGITS',    label: 'Require digit',           sub: 'At least one 0–9' },
              { key: 'PASSWORD_REQUIRE_SPECIAL',   label: 'Require special character', sub: '!@#$%^&* etc.' },
            ].map(({ key, label, sub }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-800/40">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-slate-500">{sub}</p>
                </div>
                <button type="button" onClick={() => toggle(key)}>
                  {form[key] === 'true'
                    ? <ToggleRight size={28} className="text-violet-500" />
                    : <ToggleLeft  size={28} className="text-slate-300" />}
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end pt-4">
          <button type="submit" disabled={loading} className="btn-primary py-2.5 px-8 flex items-center gap-2">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />} Save Changes
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Cron schedule presets ─────────────────────────────────────────────────────
const SCHEDULE_PRESETS = [
  { label: 'Disabled', value: '' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 6:00 AM', value: '0 6 * * *' },
  { label: 'Daily at 11:00 PM', value: '0 23 * * *' },
  { label: 'Weekly — Sunday midnight', value: '0 0 * * 0' },
  { label: 'Weekly — Friday 6 PM', value: '0 18 * * 5' },
  { label: 'Monthly — 1st at midnight', value: '0 0 1 * *' },
  { label: 'Custom', value: '__custom__' },
]

function formatBytes(kb) {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`
  return `${kb} KB`
}

export function BackupTab() {
  const toast = useToast()
  const confirm = useConfirm()
  const [backups, setBackups] = useState([])
  const [schedule, setSchedule] = useState({ cron_expr: '', retention_days: '30', next_run: null })
  const [loading, setLoading] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [confirmRestore, setConfirmRestore] = useState(null)
  const [restoreFile, setRestoreFile] = useState(null)
  const [schedulePreset, setSchedulePreset] = useState('')
  const [customCron, setCustomCron] = useState('')
  const [retentionDays, setRetentionDays] = useState('30')
  const fileInputRef = useRef(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [bRes, sRes] = await Promise.allSettled([
        api.get('/backup/'),
        api.get('/backup/schedule/'),
      ])
      if (bRes.status === 'fulfilled') setBackups(bRes.value.data)
      if (sRes.status === 'fulfilled') {
        const s = sRes.value.data
        setSchedule(s)
        setRetentionDays(s.retention_days || '30')
        const preset = SCHEDULE_PRESETS.find(p => p.value === s.cron_expr && p.value !== '__custom__')
        setSchedulePreset(preset ? preset.value : (s.cron_expr ? '__custom__' : ''))
        setCustomCron(s.cron_expr || '')
      }
    } catch {
      setError('Failed to load backup data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const runBackup = async () => {
    setBackingUp(true)
    setSuccess('')
    setError('')
    try {
      await api.post('/backup/')
      setSuccess('Backup created successfully.')
      toast.success('Backup created successfully.')
      await fetchAll()
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Backup failed.'
      setError(msg)
      toast.error(msg)
    } finally {
      setBackingUp(false)
    }
  }

  const downloadBackup = filename => {
    const token = localStorage.getItem('psc_access')
    fetch(`/api/backup/download/?filename=${encodeURIComponent(filename)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error('Download failed')
        return res.blob()
      })
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.setAttribute('download', filename)
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
      .catch(() => setError('Download failed.'))
  }

  const deleteBackup = async filename => {
    const ok = await confirm({
      title: 'Delete backup?',
      message: `"${filename}" will be permanently removed from the server.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await api.post('/backup/delete-file/', { filename })
      setSuccess(`Deleted ${filename}.`)
      toast.success(`Backup "${filename}" deleted.`)
      await fetchAll()
    } catch {
      toast.error('Delete failed.')
      setError('Delete failed.')
    }
  }

  const handleRestoreFromFile = async () => {
    if (!restoreFile) return
    setRestoring(true)
    setError('')
    setSuccess('')
    const fd = new FormData()
    fd.append('file', restoreFile)
    try {
      await api.post('/backup/restore/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setSuccess('Database restored successfully from uploaded file.')
      toast.success('Database restored from uploaded file.')
      setRestoreFile(null)
      setConfirmRestore(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Restore failed.'
      setError(msg)
      toast.error(msg)
    } finally {
      setRestoring(false)
    }
  }

  const handleRestoreFromStored = async filename => {
    setRestoring(true)
    setError('')
    setSuccess('')
    try {
      await api.post('/backup/restore/', { filename })
      setSuccess(`Database restored from ${filename}.`)
      toast.success(`Database restored from ${filename}.`)
      setConfirmRestore(null)
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Restore failed.'
      setError(msg)
      toast.error(msg)
    } finally {
      setRestoring(false)
    }
  }

  const saveSchedule = async () => {
    const cron = schedulePreset === '__custom__' ? customCron.trim() : schedulePreset
    setScheduleLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.post('/backup/schedule/', { cron_expr: cron, retention_days: retentionDays })
      setSchedule(res.data)
      const msg = cron
        ? `Schedule saved. Next run: ${res.data.next_run ? new Date(res.data.next_run).toLocaleString() : '—'}`
        : 'Scheduled backups disabled.'
      setSuccess(msg)
      toast.success(msg)
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Failed to save schedule.'
      setError(msg)
      toast.error(msg)
    } finally {
      setScheduleLoading(false)
    }
  }

  const activeCron = schedulePreset === '__custom__' ? customCron : schedulePreset

  return (
    <div className="space-y-6 max-w-4xl">
      <SuccessBanner message={success} onClear={() => setSuccess('')} />
      <ErrorBanner error={error} />

      {/* ── Run backup now ── */}
      <div className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Archive size={18} className="text-primary-500" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Manual Backup</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create a complete snapshot of all application data right now.
            The file can be downloaded and stored off-site.
          </p>
        </div>
        <button
          type="button"
          onClick={runBackup}
          disabled={backingUp}
          className="btn-gradient py-2.5 px-5 text-sm whitespace-nowrap inline-flex items-center gap-2 disabled:opacity-60"
        >
          {backingUp ? <RefreshCw size={15} className="animate-spin" /> : <Archive size={15} />}
          {backingUp ? 'Creating backup…' : 'Run Backup Now'}
        </button>
      </div>

      {/* ── Scheduled backups ── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Calendar size={18} className="text-primary-500" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Scheduled Backups</h3>
          {schedule.next_run && activeCron && (
            <span className="ml-auto text-xs text-slate-400 flex items-center gap-1">
              <Clock size={12} /> Next: {new Date(schedule.next_run).toLocaleString()}
            </span>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Backup Frequency</label>
            <select
              className="input text-sm"
              value={schedulePreset}
              onChange={e => {
                setSchedulePreset(e.target.value)
                if (e.target.value !== '__custom__') setCustomCron(e.target.value)
              }}
            >
              {SCHEDULE_PRESETS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Retention Period (days)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              className="input text-sm"
              value={retentionDays}
              onChange={e => setRetentionDays(e.target.value)}
            />
          </div>
        </div>
        {schedulePreset === '__custom__' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Custom Cron Expression <span className="text-slate-400">(min hour day month weekday)</span>
            </label>
            <input
              className="input text-sm font-mono"
              placeholder="e.g.  0 2 * * *  =  every day at 2:00 AM"
              value={customCron}
              onChange={e => setCustomCron(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">
              Fields: minute (0–59) · hour (0–23) · day of month (1–31) · month (1–12) · weekday (0=Sun…6=Sat)
            </p>
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={saveSchedule}
            disabled={scheduleLoading}
            className="btn-primary py-2 px-5 text-sm inline-flex items-center gap-2 disabled:opacity-60"
          >
            {scheduleLoading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            Save Schedule
          </button>
        </div>
      </div>

      {/* ── Restore from upload ── */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Upload size={18} className="text-amber-500" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Restore from File</h3>
        </div>
        <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-700/40 dark:bg-amber-900/10">
          <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Restoring will <strong>overwrite all existing data</strong> with the contents of the backup.
            This action cannot be undone. Ensure all users are logged out before proceeding.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="block text-sm text-slate-600 dark:text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-900/20 dark:file:text-primary-300"
            onChange={e => setRestoreFile(e.target.files[0] || null)}
          />
          <button
            type="button"
            disabled={!restoreFile || restoring}
            onClick={() => setConfirmRestore('__upload__')}
            className="btn-outline border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 py-2 px-4 text-sm whitespace-nowrap inline-flex items-center gap-2 disabled:opacity-40"
          >
            {restoring ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
            Restore from Upload
          </button>
        </div>
      </div>

      {/* ── Backup list ── */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-slate-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
              Stored Backups ({backups.length})
            </span>
          </div>
          <button type="button" onClick={fetchAll} disabled={loading} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {backups.length === 0 ? (
          <p className="text-center py-10 text-slate-400 text-sm">
            No backups yet. Run a manual backup or configure a schedule above.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {backups.map(b => (
              <div key={b.filename} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 font-mono truncate">{b.filename}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(b.created_at).toLocaleString()} · {formatBytes(b.size_kb)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadBackup(b.filename)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Download size={13} /> Download
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRestore(b.filename)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700/40 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                  >
                    <Upload size={13} /> Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteBackup(b.filename)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete backup"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Restore confirmation modal ── */}
      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card p-0 overflow-hidden w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle size={16} /> Confirm Restore
              </h2>
              <button onClick={() => setConfirmRestore(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                You are about to restore the database from:
              </p>
              <p className="font-mono text-sm bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg break-all">
                {confirmRestore === '__upload__' ? restoreFile?.name : confirmRestore}
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                ⚠ All current data will be overwritten. This cannot be undone.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmRestore(null)}
                  className="btn-outline py-2 px-4 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={restoring}
                  onClick={() => {
                    if (confirmRestore === '__upload__') handleRestoreFromFile()
                    else handleRestoreFromStored(confirmRestore)
                  }}
                  className="py-2 px-4 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {restoring ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                  {restoring ? 'Restoring…' : 'Yes, Restore Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const VALID_TABS = new Set(['users', 'roles', 'permissions'])

function firstAllowedTab(user) {
  if (!user) return 'roles'
  if (userCanManageUsers(user)) return 'users'
  if (userCanManageRoles(user)) return 'roles'
  return 'roles'
}

function tabAllowedForUser(user, tabId) {
  if (tabId === 'users') return userCanManageUsers(user)
  return userCanManageRoles(user)
}

export default function AdminPanel() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [ministries, setMinistries] = useState([])
  const [departments, setDepartments] = useState([])
  const [roleDefs, setRoleDefs] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (user && !userCanAccessAdminPanel(user)) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    if (!user) return
    const t = searchParams.get('tab')
    if (t === 'api-keys') {
      navigate('/admin/api-keys', { replace: true })
      return
    }
    if (t === 'settings') {
      navigate('/admin/system-config', { replace: true })
      return
    }
    if (t === 'backup') {
      navigate('/admin/backup-restore', { replace: true })
      return
    }
    if (t === 'security') {
      navigate('/admin/security', { replace: true })
      return
    }
    const ok = t && VALID_TABS.has(t) && tabAllowedForUser(user, t)
    if (ok) { setTab(t); return }
    const next = firstAllowedTab(user)
    setTab(next)
    setSearchParams(p => { p.set('tab', next); return p }, { replace: true })
  }, [searchParams, setSearchParams, user, navigate])

  const visibleTabs = useMemo(() => TABS.filter(({ needs }) => {
    if (needs === 'users') return userCanManageUsers(user)
    return userCanManageRoles(user)
  }), [user])

  const setTabParam = id => { setTab(id); setSearchParams({ tab: id }, { replace: true }) }

  const fetchAll = useCallback(async () => {
    setLoadingData(true)
    try {
      const settled = await Promise.allSettled([
        api.get('/users/'), api.get('/ministries/'), api.get('/departments/'),
        api.get('/role-defs/'), api.get('/permissions/'),
      ])
      const pick = i => {
        if (settled[i].status !== 'fulfilled') return []
        const d = settled[i].value.data
        return d.results ?? d
      }
      setUsers(pick(0)); setMinistries(pick(1)); setDepartments(pick(2));
      setRoleDefs(pick(3)); setPermissions(pick(4));
    } finally { setLoadingData(false) }
    // BackupTab manages its own data fetch
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (!user || !userCanAccessAdminPanel(user)) return null

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Administration</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage users, roles, and permission definitions. Use the sidebar for API keys, system configuration, security, and backups.</p>
        </div>
        <button type="button" onClick={fetchAll} disabled={loadingData} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50">
          <RefreshCw size={15} className={loadingData ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit flex-wrap">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTabParam(id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm gap-2"><RefreshCw size={16} className="animate-spin" /> Loading…</div>
      ) : (
        <>
          {tab === 'users'       && <UsersTab users={users} ministries={ministries} departments={departments} onRefresh={fetchAll} />}
          {tab === 'roles'       && <RolesTab roleDefs={roleDefs} permissions={permissions} onRefresh={fetchAll} />}
          {tab === 'permissions' && <PermissionsTab permissions={permissions} onRefresh={fetchAll} />}
        </>
      )}
    </div>
  )
}

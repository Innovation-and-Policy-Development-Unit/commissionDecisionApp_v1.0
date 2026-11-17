import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Plus, Users, X } from 'lucide-react'
import clsx from 'clsx'

const STATUS = [
  { key: 'present', label: 'Present', on: 'bg-emerald-600 text-white border-emerald-600' },
  { key: 'absent', label: 'Absent', on: 'bg-red-600 text-white border-red-600' },
  { key: 'apology', label: 'Apology', on: 'bg-amber-500 text-white border-amber-500' },
]

const LABEL = 'block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5'

export function quorumFor(attendance, serverQuorum) {
  const members = attendance?.members || []
  const total = members.length
  const present = members.filter(m => m.status === 'present').length
  // Keep the server's rule (it may be a configured number) while the roster is
  // unchanged; once members are added or removed fall back to a simple majority.
  const needed = serverQuorum && serverQuorum.total === total ? serverQuorum.needed : (total ? Math.floor(total / 2) + 1 : 0)
  return { present, total, needed, met: total === 0 || present >= needed }
}

/**
 * Attendance for the sitting: who was present, absent or sent apologies, the
 * start time and opening prayer. Pre-filled from the Commission roster; the
 * minute-taker flips the exceptions and adds anyone missing.
 */
export default function AttendancePanel({ attendance, saved, serverQuorum, suggestions = [], onChange, disabled }) {
  const [open, setOpen] = useState(true)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('Commissioner')
  const [otherName, setOtherName] = useState('')
  const [otherRole, setOtherRole] = useState('')

  const att = attendance || { members: [], in_attendance: [], start_time: '', end_time: '', opening_prayer_by: '', closing_prayer_by: '' }
  const members = att.members || []
  const others = att.in_attendance || []
  const q = quorumFor(att, serverQuorum)
  const counts = {
    absent: members.filter(m => m.status === 'absent').length,
    apology: members.filter(m => m.status === 'apology').length,
  }

  const set = patch => onChange({ ...att, ...patch })
  const setMember = (idx, patch) => set({ members: members.map((m, i) => (i === idx ? { ...m, ...patch } : m)) })
  const setStatus = (idx, status) => setMember(idx, { status, ...(status !== 'present' ? { arrived: '', left: '' } : {}) })

  const addMember = () => {
    const name = newName.trim()
    if (!name) return
    set({ members: [...members, { user_id: null, name, role: newRole.trim() || 'Commissioner', status: 'present', arrived: '', left: '' }] })
    setNewName('')
  }
  const addOther = (name, role) => {
    const n = (name || '').trim()
    if (!n || others.some(o => o.name === n)) return
    set({ in_attendance: [...others, { name: n, role: (role || '').trim() }] })
    setOtherName(''); setOtherRole('')
  }

  const presentNames = members.filter(m => m.status === 'present').map(m => m.name)

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          <Users size={14} className="text-slate-500" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Attendance</span>
          <span className="text-xs text-slate-500 truncate">
            {q.present} present
            {counts.absent ? ` · ${counts.absent} absent` : ''}
            {counts.apology ? ` · ${counts.apology} apology` : ''}
          </span>
        </span>
        <span className={clsx('text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5',
          saved ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300')}>
          {saved ? 'Saved' : 'Not saved yet — check and save'}
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {!q.met && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-300 text-sm">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Only {q.present} of {q.total} Commission members are present — fewer than the {q.needed} needed for quorum. Confirm quorum before recording decisions.
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Time the meeting started</label>
              <input type="time" className="input text-sm bg-white" value={att.start_time || ''} disabled={disabled}
                onChange={e => set({ start_time: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Opening prayer by</label>
              <input className="input text-sm bg-white" list="attendance-present-names" value={att.opening_prayer_by || ''} disabled={disabled}
                placeholder="Choose or type a name" onChange={e => set({ opening_prayer_by: e.target.value })} />
              <datalist id="attendance-present-names">
                {presentNames.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div>
              <label className={LABEL}>Time the meeting ended</label>
              <input type="time" className="input text-sm bg-white" value={att.end_time || ''} disabled={disabled}
                onChange={e => set({ end_time: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Closing prayer by</label>
              <input className="input text-sm bg-white" list="attendance-present-names" value={att.closing_prayer_by || ''} disabled={disabled}
                placeholder="Choose or type a name" onChange={e => set({ closing_prayer_by: e.target.value })} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Commission members</label>
            {members.length === 0 && (
              <p className="text-sm text-slate-500 mb-2">No Commissioner accounts found — add the members who attended below.</p>
            )}
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {members.map((m, idx) => (
                <li key={`${m.user_id ?? 'x'}-${idx}`} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-[10rem] flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{m.name}</p>
                    <p className="text-[11px] text-slate-500">{m.role}</p>
                  </div>
                  <div className="flex rounded-lg overflow-hidden" role="group" aria-label={`Attendance of ${m.name}`}>
                    {STATUS.map(s => (
                      <button
                        key={s.key}
                        type="button"
                        disabled={disabled}
                        aria-pressed={m.status === s.key}
                        onClick={() => setStatus(idx, s.key)}
                        className={clsx('px-2.5 py-1 text-xs font-semibold border -ml-px first:ml-0',
                          m.status === s.key ? s.on : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600')}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {m.status === 'present' && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <label className="flex items-center gap-1">Arrived
                        <input type="time" className="input !py-0.5 !px-1.5 text-xs w-24 bg-white" value={m.arrived || ''} disabled={disabled}
                          onChange={e => setMember(idx, { arrived: e.target.value })} />
                      </label>
                      <label className="flex items-center gap-1">Left
                        <input type="time" className="input !py-0.5 !px-1.5 text-xs w-24 bg-white" value={m.left || ''} disabled={disabled}
                          onChange={e => setMember(idx, { left: e.target.value })} />
                      </label>
                    </div>
                  )}
                  <button type="button" disabled={disabled} aria-label={`Remove ${m.name}`}
                    onClick={() => set({ members: members.filter((_, i) => i !== idx) })}
                    className="text-slate-400 hover:text-red-600"><X size={14} /></button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <input className="input text-sm bg-white flex-1 min-w-[10rem]" placeholder="Add a member — name" value={newName} disabled={disabled}
                onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMember() } }} />
              <input className="input text-sm bg-white w-40" placeholder="Role" value={newRole} disabled={disabled} onChange={e => setNewRole(e.target.value)} />
              <button type="button" className="btn-secondary btn-sm inline-flex items-center gap-1" disabled={disabled || !newName.trim()} onClick={addMember}>
                <Plus size={12} /> Add
              </button>
            </div>
          </div>

          <div>
            <label className={LABEL}>Also in attendance</label>
            {others.length > 0 && (
              <ul className="mb-2 space-y-1">
                {others.map((o, idx) => (
                  <li key={`${o.name}-${idx}`} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <span>{o.name}{o.role ? `, ${o.role}` : ''}</span>
                    <button type="button" disabled={disabled} aria-label={`Remove ${o.name}`}
                      onClick={() => set({ in_attendance: others.filter((_, i) => i !== idx) })}
                      className="text-slate-400 hover:text-red-600"><X size={12} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <input className="input text-sm bg-white flex-1 min-w-[10rem]" placeholder="Name (e.g. the Acting Secretary)" value={otherName} disabled={disabled}
                onChange={e => setOtherName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOther(otherName, otherRole) } }} />
              <input className="input text-sm bg-white w-48" placeholder="Role, e.g. Acting Secretary - PSC" value={otherRole} disabled={disabled} onChange={e => setOtherRole(e.target.value)} />
              <button type="button" className="btn-secondary btn-sm inline-flex items-center gap-1" disabled={disabled || !otherName.trim()} onClick={() => addOther(otherName, otherRole)}>
                <Plus size={12} /> Add
              </button>
            </div>
            {suggestions.filter(s => !others.some(o => o.name === s.name)).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.filter(s => !others.some(o => o.name === s.name)).map(s => (
                  <button key={s.name} type="button" disabled={disabled} onClick={() => addOther(s.name, s.role)}
                    className="text-xs rounded-full border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                    + {s.name} ({s.role})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

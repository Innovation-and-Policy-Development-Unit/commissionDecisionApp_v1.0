import { useState, useEffect, useCallback, useRef } from 'react'
import { FileText, PenSquare, BellRing, PackageCheck, Plus, Loader2, Upload } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

const SECRETARY_ROLES = new Set(['psc_secretary', 'psc_admin'])
const MINISTRY_ROLES = new Set(['ministry_hr', 'dept_admin', 'head_of_agency'])
const SECRETARIAT_ROLES = new Set(['psc_secretary', 'senior_admin_officer', 'psc_admin'])

const STATUS_STYLE = {
  draft:            'bg-slate-100 text-slate-700',
  prepared:         'bg-blue-100 text-blue-700',
  printed:          'bg-indigo-100 text-indigo-700',
  signed:           'bg-amber-100 text-amber-700',
  ready_for_pickup: 'bg-violet-100 text-violet-700',
  picked_up:        'bg-emerald-100 text-emerald-700',
}

/**
 * Decision-letter workflow for a commission task: the unit prepares the letter,
 * the Secretary signs it (wet-ink record), the unit notifies HR for pickup, and
 * HR confirms collection.
 */
export default function DecisionLetterPanel({ task }) {
  const { user } = useAuth()
  const toast = useToast()
  const role = user?.role
  const [letters, setLetters] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const signFileRef = useRef(null)
  const [signTargetId, setSignTargetId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/decision-letters/?commission_task=${task.id}`)
      setLetters(Array.isArray(res.data) ? res.data : (res.data?.results || []))
    } catch { setLetters([]) } finally { setLoading(false) }
  }, [task.id])

  useEffect(() => { load() }, [load])

  const isSecretary = SECRETARY_ROLES.has(role)
  const isMinistry = MINISTRY_ROLES.has(role)
  const isSecretariat = SECRETARIAT_ROLES.has(role)

  const prepare = async (e) => {
    e.preventDefault()
    if (!subject.trim()) { toast.error('Subject is required.'); return }
    setBusy(true)
    try {
      await api.post('/decision-letters/', { commission_task: task.id, subject: subject.trim(), body_text: body })
      setSubject(''); setBody(''); setShowForm(false)
      toast.success('Letter prepared.')
      await load()
    } catch (ex) { toast.error(ex.response?.data?.detail || 'Could not prepare letter.') }
    finally { setBusy(false) }
  }

  const markSigned = async (letterId, file) => {
    setBusy(true)
    try {
      let payload, config
      if (file) {
        payload = new FormData(); payload.append('signed_scan', file)
        config = { headers: { 'Content-Type': 'multipart/form-data' } }
      }
      await api.post(`/decision-letters/${letterId}/mark-signed/`, payload || {}, config)
      toast.success('Letter marked as signed.')
      await load()
    } catch (ex) { toast.error(ex.response?.data?.detail || 'Could not mark signed.') }
    finally { setBusy(false); setSignTargetId(null) }
  }

  const notifyPickup = async (letterId) => {
    setBusy(true)
    try {
      const res = await api.post(`/decision-letters/${letterId}/notify-pickup/`)
      toast.success(`HR notified (${res.data?.notified ?? 0} recipient(s)).`)
      await load()
    } catch (ex) { toast.error(ex.response?.data?.detail || 'Could not notify HR.') }
    finally { setBusy(false) }
  }

  const markPickedUp = async (letterId) => {
    setBusy(true)
    try {
      await api.post(`/decision-letters/${letterId}/mark-picked-up/`, {})
      toast.success('Pickup confirmed.')
      await load()
    } catch (ex) { toast.error(ex.response?.data?.detail || 'Could not confirm pickup.') }
    finally { setBusy(false) }
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          <FileText size={14} /> Decision Letters
        </span>
        {!isMinistry && !showForm && (
          <button onClick={() => setShowForm(true)} className="text-xs font-semibold text-primary-600 inline-flex items-center gap-1">
            <Plus size={13} /> Prepare letter
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={prepare} className="space-y-2 mb-3">
          <input className="input text-sm" placeholder="Letter subject (e.g. Direct Appointment — J. Doe)" value={subject} onChange={e => setSubject(e.target.value)} />
          <textarea className="input text-sm min-h-[80px]" placeholder="Letter body (optional draft)…" value={body} onChange={e => setBody(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary btn-sm">{busy ? 'Saving…' : 'Save letter'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost btn-sm">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-3"><Loader2 size={18} className="animate-spin text-slate-300" /></div>
      ) : letters.length === 0 ? (
        <p className="text-xs text-slate-400">No letters prepared for this decision yet.</p>
      ) : (
        <ul className="space-y-2">
          {letters.map(l => (
            <li key={l.id} className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{l.subject}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {l.prepared_by_name ? `Prepared by ${l.prepared_by_name}` : ''}
                    {l.signed_by_name ? ` · Signed by ${l.signed_by_name}` : ''}
                    {l.picked_up_by_name ? ` · Collected by ${l.picked_up_by_name}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[l.status] || STATUS_STYLE.draft}`}>
                  {l.status_label}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {isSecretary && ['prepared', 'printed'].includes(l.status) && (
                  <>
                    <input ref={signFileRef} type="file" accept="application/pdf,image/*" className="hidden"
                      onChange={e => { markSigned(l.id, e.target.files?.[0]); e.target.value = '' }} />
                    <button disabled={busy} onClick={() => markSigned(l.id)} className="btn-sm bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold">
                      <PenSquare size={12} /> Mark Signed
                    </button>
                    <button disabled={busy} onClick={() => { setSignTargetId(l.id); signFileRef.current?.click() }} className="btn-sm inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold border border-slate-300 dark:border-slate-600">
                      <Upload size={12} /> Sign + attach scan
                    </button>
                  </>
                )}
                {!isMinistry && l.status === 'signed' && (
                  <button disabled={busy} onClick={() => notifyPickup(l.id)} className="btn-sm bg-violet-600 hover:bg-violet-700 text-white inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold">
                    <BellRing size={12} /> Notify HR for Pickup
                  </button>
                )}
                {(isMinistry || isSecretariat) && l.status === 'ready_for_pickup' && (
                  <button disabled={busy} onClick={() => markPickedUp(l.id)} className="btn-sm bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold">
                    <PackageCheck size={12} /> Confirm Pickup
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

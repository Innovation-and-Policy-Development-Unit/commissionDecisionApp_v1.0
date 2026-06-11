import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  Save, CheckCircle2, AlertCircle, ArrowLeft,
  ChevronDown, ChevronRight, Plus, Trash2, Loader2, PenSquare, Download,
  Lock, Share2, X, Search, Clock,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../../components/shared/PageHeader'
import api from '../../../api/client'
import { useAuth } from '../../../context/AuthContext'
import clsx from 'clsx'

const MINUTES_STATUS = {
  draft:    { label: 'Draft',    bg: 'bg-amber-100 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  reviewed: { label: 'Reviewed', bg: 'bg-blue-100 dark:bg-blue-900/20',  text: 'text-blue-700 dark:text-blue-300',  border: 'border-blue-200 dark:border-blue-800'  },
  signed:   { label: 'Signed',   bg: 'bg-emerald-100 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
}

function SectionEditor({ label, value, onChange, placeholder }) {
  return (
    <div className="mb-4">
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>
      <textarea
        className="input min-h-[80px] resize-y"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
      />
    </div>
  )
}

function AgendaItemEditor({ item, index, onChange, restricted, canManageAccess, onManageAccess }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <div className="w-full flex items-center bg-slate-50 dark:bg-slate-800/50">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {item.submission_ref || `Item ${index + 1}`}
            </span>
            {item.title && <span className="text-xs text-slate-500 ml-1">— {item.title}</span>}
            {restricted && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                <Lock size={9} /> Restricted
              </span>
            )}
          </div>
          <span className={clsx(
            'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
            item.decision_type === 'approved' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
            item.decision_type === 'rejected' && 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
            item.decision_type === 'deferred' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
            item.decision_type === 'returned' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
            item.decision_type === 'tabled' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
            !item.decision_type && 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
          )}>
            {item.decision_type || 'Pending'}
          </span>
        </button>
        {canManageAccess && (
          <button
            type="button"
            onClick={() => onManageAccess(item, index)}
            className="mx-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors whitespace-nowrap"
          >
            {restricted ? <Share2 size={13} /> : <Lock size={13} />}
            {restricted ? 'Manage access' : 'Restrict'}
          </button>
        )}
      </div>
      {expanded && (
        <div className="p-4 space-y-3 border-t border-slate-100 dark:border-slate-700">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ref</label>
              <input className="input text-sm" value={item.submission_ref || ''} onChange={e => onChange(index, 'submission_ref', e.target.value)} placeholder="e.g. PSC/01/2026" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Title</label>
              <input className="input text-sm" value={item.title || ''} onChange={e => onChange(index, 'title', e.target.value)} placeholder="Submission title" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Discussion</label>
            <textarea className="input min-h-[60px] resize-y text-sm" value={item.discussion || ''} onChange={e => onChange(index, 'discussion', e.target.value)} placeholder="Summary of discussion..." />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Decision</label>
            <textarea className="input min-h-[40px] resize-y text-sm" value={item.decision || ''} onChange={e => onChange(index, 'decision', e.target.value)} placeholder="Formal resolution wording..." />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Decision Type</label>
            <select className="input text-sm" value={item.decision_type || ''} onChange={e => onChange(index, 'decision_type', e.target.value)}>
              <option value="">— Select —</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="deferred">Deferred</option>
              <option value="returned">Returned</option>
              <option value="tabled">Tabled</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Action Items</label>
            {(item.action_items || []).map((ai, aiIdx) => (
              <div key={aiIdx} className="flex items-start gap-2 mb-2">
                <input className="input text-sm flex-1" value={ai.action || ''} onChange={e => {
                  const items = [...(item.action_items || [])]
                  items[aiIdx] = { ...items[aiIdx], action: e.target.value }
                  onChange(index, 'action_items', items)
                }} placeholder="Action description" />
                <input className="input text-sm w-36" value={ai.responsible || ''} onChange={e => {
                  const items = [...(item.action_items || [])]
                  items[aiIdx] = { ...items[aiIdx], responsible: e.target.value }
                  onChange(index, 'action_items', items)
                }} placeholder="Responsible" />
                <button type="button" onClick={() => {
                  const items = (item.action_items || []).filter((_, i) => i !== aiIdx)
                  onChange(index, 'action_items', items)
                }} className="p-2 text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => {
              const items = [...(item.action_items || []), { action: '', responsible: '', deadline: '' }]
              onChange(index, 'action_items', items)
            }} className="flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors">
              <Plus size={12} /> Add Action Item
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function RestrictedAgendaItem({ item, index, onRequestAccess, requesting }) {
  const status = item.my_request_status
  return (
    <div className="border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 bg-amber-50/60 dark:bg-amber-900/10">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-amber-500" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {item.submission_ref || `Item ${index + 1}`}
          </span>
          {item.title && <span className="text-xs text-slate-500 ml-1">— {item.title}</span>}
        </div>
        {status === 'pending' ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            <Clock size={9} /> Request pending
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onRequestAccess(item)}
            disabled={requesting}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors disabled:opacity-60"
          >
            {requesting ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}
            {status === 'denied' ? 'Request again' : 'Request access'}
          </button>
        )}
      </div>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
        This agenda item is restricted by the Secretariat.
        {status === 'denied' && ' Your previous request was declined.'}
      </p>
    </div>
  )
}

function UserSearchPicker({ minutesId, selected, onChange, excludeIds = [] }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    if (!q.trim()) { setResults([]); return undefined }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.get(`/minutes/${minutesId}/shareable-users/`, { params: { q } })
        setResults(res.data)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer.current)
  }, [q, minutesId])

  const hidden = new Set([...excludeIds, ...selected.map(u => u.id)])
  const visible = results.filter(u => !hidden.has(u.id))

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(u => (
            <span key={u.id} className="inline-flex items-center gap-1 text-xs font-semibold bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full px-2.5 py-1">
              {u.full_name || u.username}
              <button type="button" onClick={() => onChange(selected.filter(s => s.id !== u.id))} className="hover:text-primary-900">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input text-sm pl-8"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search users by name..."
        />
      </div>
      {(visible.length > 0 || searching) && (
        <div className="mt-1 border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700 max-h-44 overflow-y-auto">
          {searching && <div className="px-3 py-2 text-xs text-slate-400">Searching…</div>}
          {visible.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => { onChange([...selected, u]); setQ('') }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="font-semibold text-slate-700 dark:text-slate-200">{u.full_name || u.username}</span>
              {u.role && <span className="text-xs text-slate-400 ml-2">{u.role}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ManageAccessModal({ minutes, item, index, restriction, onClose, onUpdated, onError }) {
  const [reason, setReason] = useState(restriction?.reason || '')
  const [toShare, setToShare] = useState([])
  const [busy, setBusy] = useState(false)

  const call = async (path, payload) => {
    setBusy(true)
    try {
      const res = await api.post(`/minutes/${minutes.id}/${path}/`, payload)
      onUpdated(res.data)
      return true
    } catch (err) {
      onError(err.response?.data?.detail || 'Action failed.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const restrictNow = async () => {
    const ok = await call('restrict-item', { index, reason, user_ids: toShare.map(u => u.id) })
    if (ok) onClose()
  }
  const shareNow = async () => {
    if (!toShare.length) return
    const ok = await call('grant-access', { restriction_id: restriction.id, user_ids: toShare.map(u => u.id) })
    if (ok) setToShare([])
  }

  const grantedIds = (restriction?.visible_to || []).map(u => u.id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center text-amber-600">
              <Lock size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                {restriction ? 'Manage access' : 'Restrict agenda item'}
              </h3>
              <p className="text-xs text-slate-500">
                {item.submission_ref || `Item ${index + 1}`}{item.title ? ` — ${item.title}` : ''}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {!restriction && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Everyone who can open these minutes will see this item as locked. Only the
              Secretary, Administrator, and people you share it with can read it.
            </p>
            <div className="mb-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Reason (optional)</label>
              <textarea className="input min-h-[60px] resize-y text-sm" value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this item restricted?" />
            </div>
            <div className="mb-5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Share with (optional)</label>
              <UserSearchPicker minutesId={minutes.id} selected={toShare} onChange={setToShare} />
            </div>
            <button type="button" onClick={restrictNow} disabled={busy} className="btn-gradient w-full py-2.5 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              Restrict this item
            </button>
          </>
        )}

        {restriction && (
          <>
            {restriction.reason && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 italic">Reason: {restriction.reason}</p>
            )}

            {(restriction.pending_requests || []).length > 0 && (
              <div className="mb-5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pending access requests</label>
                <div className="space-y-2">
                  {restriction.pending_requests.map(req => (
                    <div key={req.id} className="flex items-center justify-between gap-3 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{req.requested_by_name}</p>
                        {req.message && <p className="text-xs text-slate-500 truncate">{`"${req.message}"`}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => call('decide-request', { request_id: req.id, approve: true })}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 transition-colors disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => call('decide-request', { request_id: req.id, approve: false })}
                          className="text-xs font-bold text-red-500 hover:text-red-600 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 transition-colors disabled:opacity-60"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">People with access</label>
              {(restriction.visible_to || []).length === 0 && (
                <p className="text-xs text-slate-400 mb-2">Only the Secretary and Administrator can see this item.</p>
              )}
              <div className="space-y-1.5">
                {(restriction.visible_to || []).map(u => (
                  <div key={u.id} className="flex items-center justify-between gap-3 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{u.full_name || u.username}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => call('revoke-access', { restriction_id: restriction.id, user_id: u.id })}
                      className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Share with more people</label>
              <UserSearchPicker minutesId={minutes.id} selected={toShare} onChange={setToShare} excludeIds={grantedIds} />
              {toShare.length > 0 && (
                <button type="button" onClick={shareNow} disabled={busy} className="btn-primary btn-sm mt-2 inline-flex items-center gap-1.5 disabled:opacity-60">
                  <Share2 size={13} /> Share
                </button>
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await call('unrestrict-item', { restriction_id: restriction.id })
                  if (ok) onClose()
                }}
                className="text-sm font-bold text-red-500 hover:text-red-600 transition-colors disabled:opacity-60"
              >
                Remove restriction — make visible to everyone
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ReadOnlySection({ label, value }) {
  if (!value) return null
  return (
    <div className="mb-4">
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>
      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function ReadOnlyAgendaItem({ item, index, restricted, canManageAccess, onManageAccess }) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
            {item.submission_ref || `Item ${index + 1}`}
          </span>
          {item.title && <span className="text-xs text-slate-500 truncate">— {item.title}</span>}
          {restricted && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 whitespace-nowrap">
              <Lock size={9} /> Restricted
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={clsx(
            'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
            item.decision_type === 'approved' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
            item.decision_type === 'rejected' && 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
            item.decision_type === 'deferred' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
            item.decision_type === 'returned' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
            item.decision_type === 'tabled' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
            !item.decision_type && 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
          )}>
            {item.decision_type || 'Pending'}
          </span>
          {canManageAccess && (
            <button
              type="button"
              onClick={() => onManageAccess(item, index)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors whitespace-nowrap"
            >
              {restricted ? <Share2 size={13} /> : <Lock size={13} />}
              {restricted ? 'Manage access' : 'Restrict'}
            </button>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3 border-t border-slate-100 dark:border-slate-700">
        {item.discussion && (
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Discussion</label>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{item.discussion}</p>
          </div>
        )}
        {item.decision && (
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Decision</label>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{item.decision}</p>
          </div>
        )}
        {(item.action_items || []).length > 0 && (
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Action Items</label>
            <ol className="list-decimal ml-5 space-y-1">
              {item.action_items.map((ai, aiIdx) => (
                <li key={aiIdx} className="text-sm text-slate-700 dark:text-slate-300">
                  {ai.action}
                  {ai.responsible && <span className="text-slate-500"> — {ai.responsible}</span>}
                  {ai.deadline && <span className="text-slate-400"> (Due: {ai.deadline})</span>}
                </li>
              ))}
            </ol>
          </div>
        )}
        {!item.discussion && !item.decision && !(item.action_items || []).length && (
          <p className="text-xs text-slate-400">No minute recorded for this item yet.</p>
        )}
      </div>
    </div>
  )
}

const itemKeyOf = (item) =>
  item?.agenda_item_id ? `ai-${item.agenda_item_id}` : (item?.item_key || null)

export default function MinutesEditor() {
  const { t } = useTranslation()
  const { meetingId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const viewMode = searchParams.get('mode') === 'view'

  const [meeting, setMeeting] = useState(null)
  const [minutes, setMinutes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [content, setContent] = useState({
    opening: '',
    confirmation_previous_minutes: '',
    agenda_items: [],
    any_other_business: '',
    closing: '',
    next_meeting_date: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mRes, minsRes] = await Promise.allSettled([
        api.get(`/meetings/${meetingId}/`),
        api.get(`/minutes/?meeting=${meetingId}`),
      ])

      if (mRes.status === 'fulfilled') setMeeting(mRes.value.data)
      if (minsRes.status === 'fulfilled' && minsRes.value.data.length > 0) {
        const m = minsRes.value.data[0]
        setMinutes(m)
        if (m.content && typeof m.content === 'object') {
          setContent(m.content)
        }
      }
    } catch {
      setError('Failed to load meeting data.')
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  useEffect(() => { load() }, [load])

  const handleAgendaChange = (index, field, value) => {
    setContent(prev => {
      const items = [...(prev.agenda_items || [])]
      if (index >= items.length) {
        items.push({})
      }
      items[index] = { ...items[index], [field]: value }
      return { ...prev, agenda_items: items }
    })
  }

  // ── Per-item visibility locks (restrict / share / request access) ─────────
  const [manageTarget, setManageTarget] = useState(null) // { item, index }
  const [requestingKey, setRequestingKey] = useState(null)

  const accessControl = minutes?.access_control || { can_manage: false, restrictions: [] }
  const restrictionByKey = Object.fromEntries(
    (accessControl.restrictions || []).map(r => [r.item_key, r]),
  )
  const canManageAccess = Boolean(accessControl.can_manage) && minutes?.status === 'signed'

  const refreshFromResponse = (data) => {
    setMinutes(data)
    if (data?.content && typeof data.content === 'object') setContent(data.content)
  }

  const requestAccess = async (item) => {
    const key = itemKeyOf(item)
    if (!key || !minutes?.id) return
    setRequestingKey(key)
    setError('')
    setSuccess('')
    try {
      const res = await api.post(`/minutes/${minutes.id}/request-access/`, { item_key: key })
      refreshFromResponse(res.data)
      setSuccess('Access request sent to the Secretariat.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to request access.')
    } finally {
      setRequestingKey(null)
    }
  }

  const saveMinutes = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = { meeting: parseInt(meetingId), content }
      if (minutes?.id) {
        const res = await api.patch(`/minutes/${minutes.id}/`, payload)
        setMinutes(res.data)
        setSuccess('Minutes saved as draft.')
      } else {
        const res = await api.post('/minutes/', payload)
        setMinutes(res.data)
        setSuccess('Minutes created.')
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save minutes.')
    } finally {
      setSaving(false)
    }
  }

  const [showPinModal, setShowPinModal] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')

  const changeStatus = async (action, pin) => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const method = action === 'sign' ? 'sign' : 'mark-reviewed'
      const payload = action === 'sign' ? { pin } : {}
      const res = await api.post(`/minutes/${minutes.id}/${method}/`, payload)
      setMinutes(res.data)
      setSuccess(action === 'sign' ? 'Minutes signed.' : 'Minutes marked as reviewed.')
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to ${action} minutes.`)
    } finally {
      setSaving(false)
    }
  }

  const handleSignClick = () => {
    setPinInput('')
    setPinError('')
    setShowPinModal(true)
  }

  const handlePinSubmit = async (e) => {
    e.preventDefault()
    if (pinInput.length < 4) {
      setPinError('PIN must be at least 4 digits.')
      return
    }
    setShowPinModal(false)
    await changeStatus('sign', pinInput)
  }

  const downloadPdf = async () => {
    setError('')
    setSuccess('')
    try {
      const res = await api.get(`/minutes/${minutes.id}/pdf/`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `minutes_${meeting?.reference_number || meetingId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('PDF generation not available yet.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-slate-300" />
      </div>
    )
  }

  const statusCfg = minutes ? MINUTES_STATUS[minutes.status] || MINUTES_STATUS.draft : null

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
        <button onClick={() => navigate('/secretariat/meetings')} className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          <ArrowLeft size={16} /> Back to Sittings
        </button>
        {!viewMode && (
          <Link
            to={`/secretariat/minute-intake/${meetingId}`}
            className="btn-primary btn-sm inline-flex items-center gap-1.5"
          >
            <PenSquare size={14} />
            {t('nav.minute_intake')}
          </Link>
        )}
      </div>

      <PageHeader
        title={meeting?.title || `Meeting #${meetingId}`}
        subtitle={
          <span className="flex items-center gap-3 mt-1">
            <span className="font-mono text-xs">{meeting?.reference_number}</span>
            <span>{meeting?.date}</span>
            {minutes && statusCfg && (
              <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border shadow-sm', statusCfg.bg, statusCfg.text, statusCfg.border)}>
                <CheckCircle2 size={10} />
                {statusCfg.label}
              </span>
            )}
          </span>
        }
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm">
          <CheckCircle2 size={14} />
          {success}
        </div>
      )}

      {!viewMode && (
        <div className="card card-compact mb-6 border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
            <PenSquare size={18} className="text-primary-600" />
            {t('meeting_room.minutes_intake_banner_title')}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            {t('meeting_room.minutes_intake_banner_desc')}
          </p>
          <Link
            to={`/secretariat/minute-intake/${meetingId}`}
            className="btn-primary inline-flex items-center gap-2"
          >
            <PenSquare size={16} />
            {t('meeting_room.minutes_open_intake')}
          </Link>
        </div>
      )}

      {viewMode && (
        <div className="space-y-4">
          <ReadOnlySection label="Opening" value={content.opening} />
          <ReadOnlySection label="Confirmation of Previous Minutes" value={content.confirmation_previous_minutes} />

          <div className="mb-4">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Agenda Items</label>
            {(content.agenda_items || []).length === 0 && (
              <p className="text-sm text-slate-400">No agenda items recorded yet.</p>
            )}
            {(content.agenda_items || []).map((item, idx) => (
              <div key={idx} className="mb-3">
                {item.restricted ? (
                  <RestrictedAgendaItem
                    item={item}
                    index={idx}
                    onRequestAccess={requestAccess}
                    requesting={requestingKey === itemKeyOf(item)}
                  />
                ) : (
                  <ReadOnlyAgendaItem
                    item={item}
                    index={idx}
                    restricted={Boolean(restrictionByKey[itemKeyOf(item)])}
                    canManageAccess={canManageAccess}
                    onManageAccess={(it, i) => setManageTarget({ item: it, index: i })}
                  />
                )}
              </div>
            ))}
          </div>

          <ReadOnlySection label="Any Other Business" value={content.any_other_business} />
          <ReadOnlySection label="Closing" value={content.closing} />
          <ReadOnlySection label="Next Meeting Date" value={content.next_meeting_date} />

          <div className="mt-8 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-6">
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="btn-secondary px-5 py-2.5 text-sm inline-flex items-center gap-2"
            >
              <PenSquare size={16} />
              Open Editor
            </button>
            {minutes?.id && (
              <button onClick={downloadPdf} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                <Download size={16} />
                Export PDF
              </button>
            )}
          </div>
        </div>
      )}

      {!viewMode && (
      <>
      <div className="space-y-4">
        <SectionEditor label="Opening" value={content.opening} placeholder="e.g. The meeting opened at 9:30 AM with a prayer led by..." onChange={v => setContent(prev => ({ ...prev, opening: v }))} />
        <SectionEditor label="Confirmation of Previous Minutes" value={content.confirmation_previous_minutes} placeholder="e.g. The minutes of the previous sitting were confirmed as a true record..." onChange={v => setContent(prev => ({ ...prev, confirmation_previous_minutes: v }))} />

        <div className="mb-4">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Agenda Items</label>
          {(content.agenda_items || []).map((item, idx) => (
            <div key={idx} className="mb-3">
              {item.restricted ? (
                <RestrictedAgendaItem
                  item={item}
                  index={idx}
                  onRequestAccess={requestAccess}
                  requesting={requestingKey === itemKeyOf(item)}
                />
              ) : (
                <AgendaItemEditor
                  item={item}
                  index={idx}
                  onChange={handleAgendaChange}
                  restricted={Boolean(restrictionByKey[itemKeyOf(item)])}
                  canManageAccess={canManageAccess}
                  onManageAccess={(it, i) => setManageTarget({ item: it, index: i })}
                />
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setContent(prev => ({ ...prev, agenda_items: [...(prev.agenda_items || []), { sequence: (prev.agenda_items?.length || 0) + 1, submission_ref: '', title: '', discussion: '', decision: '', decision_type: '', action_items: [] }] }))}
            className="flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors"
          >
            <Plus size={14} /> Add Agenda Item
          </button>
        </div>

        <SectionEditor label="Any Other Business" value={content.any_other_business} placeholder="e.g. The Commission noted the update on..." onChange={v => setContent(prev => ({ ...prev, any_other_business: v }))} />
        <SectionEditor label="Closing" value={content.closing} placeholder="e.g. There being no further business, the meeting closed at..." onChange={v => setContent(prev => ({ ...prev, closing: v }))} />

        <div className="mb-4">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Next Meeting Date</label>
          <input className="input" type="text" value={content.next_meeting_date || ''} placeholder="e.g. TBC, or a specific date" onChange={e => setContent(prev => ({ ...prev, next_meeting_date: e.target.value }))} />
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-6">
        <div className="flex items-center gap-3">
          <button
            onClick={saveMinutes}
            disabled={saving}
            className="btn-gradient px-6 py-2.5 text-sm inline-flex items-center gap-2 disabled:opacity-60 shadow-lg shadow-primary-500/20"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : minutes?.id ? 'Save Draft' : 'Create Draft'}
          </button>
          {minutes?.id && minutes.status !== 'signed' && (
            <>
              {minutes.status === 'draft' && (
                <button onClick={() => changeStatus('review')} className="btn-secondary px-5 py-2.5 text-sm inline-flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  Mark Reviewed
                </button>
              )}
              {minutes.status === 'reviewed' && (
                <>
                  {!user?.signature && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                      <PenSquare size={14} />
                      <span>No signature uploaded — <a href="/pages/account" className="underline font-semibold">add one in Account settings</a> so it appears on the signed PDF.</span>
                    </div>
                  )}
                  <button onClick={handleSignClick} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-sm font-bold rounded-xl inline-flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-60">
                    <CheckCircle2 size={16} />
                    Sign Minutes
                  </button>
                </>
              )}
            </>
          )}
        </div>
        {minutes?.id && (
          <button onClick={downloadPdf} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            <Download size={16} />
            Export PDF
          </button>
        )}
      </div>
      </>
      )}

      {manageTarget && minutes?.id && (
        <ManageAccessModal
          minutes={minutes}
          item={manageTarget.item}
          index={manageTarget.index}
          restriction={restrictionByKey[itemKeyOf(manageTarget.item)] || null}
          onClose={() => setManageTarget(null)}
          onUpdated={refreshFromResponse}
          onError={setError}
        />
      )}

      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPinModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <PenSquare size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Confirm Signature</h3>
                <p className="text-xs text-slate-500">Enter your session PIN to sign the minutes.</p>
              </div>
            </div>

            {pinError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pinError}</div>
            )}

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Session PIN
                </label>
                <input
                  type="password"
                  className="input text-center text-xl font-mono"
                  style={{ borderRadius: 10, letterSpacing: '0.4em' }}
                  maxLength={6}
                  placeholder="••••••"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving || pinInput.length < 4}
                  className="btn-gradient flex-1 py-2.5 text-sm"
                >
                  {saving ? 'Signing…' : 'Confirm & Sign'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="btn-outline py-2.5 px-5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

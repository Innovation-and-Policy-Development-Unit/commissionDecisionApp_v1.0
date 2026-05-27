/**
 * Agenda — PSC Commission Meeting Agenda Builder & Generator
 *
 * Matches the official PSC Board Agenda template:
 *   AGENDA OF PSC MEETING No. X OF [DAY DATE] AT [VENUE], TIME [TIME]
 *   1. Adoption of Agenda  (auto)
 *   2. Confirmation of endorsement  (auto)
 *   3. MATTERS ARISING  (sub-items a, b, c…)
 *   [CATEGORY HEADING]
 *   4. [Item]  5. [Item]  …
 *   [Next CATEGORY HEADING]
 *   N. [Item]  …
 *   [Signature block]
 */
import { useEffect, useState, useMemo, useRef } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import Modal from '../../components/shared/Modal'
import AiTextSkeleton from '../../components/shared/AiTextSkeleton'
import api from '../../api/client'
import { normalizeListPayload, normalizeFieldPayload } from '../../utils/listPayload'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus, X, RefreshCw, Printer, Pencil, Check,
  ChevronUp, ChevronDown, AlertCircle, ClipboardList,
  Send, ThumbsUp, Mail, ChevronsRight, Tablet,
} from 'lucide-react'
import { useAgendaSections } from '../../hooks/useAgendaSections'

// Sub-item letters a, b, c … z, aa, ab …
function subLetter(idx) {
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  if (idx < 26) return letters[idx]
  return letters[Math.floor(idx / 26) - 1] + letters[idx % 26]
}

function formatMeetingDate(meeting) {
  if (!meeting) return ''
  const d = new Date(meeting.date + 'T00:00')
  const day  = d.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase()
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
  return `${day} ${date}`
}

function ordinalDate(meeting) {
  if (!meeting) return ''
  const d = new Date(meeting.date + 'T00:00')
  const n = d.getDate()
  const suffix = ['th','st','nd','rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 3)] || 'th'
  return `${n}${suffix} ${d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12  = hour % 12 || 12
  return `${h12}.${m} ${ampm}`
}

// Build meeting number from reference_number e.g. "MTG-2025-012" → "12"
function meetingNo(meeting) {
  if (!meeting) return ''
  const m = meeting.reference_number?.match(/(\d+)$/)
  return m ? String(parseInt(m[1])) : meeting.reference_number
}

// ── Main ────────────────────────────────────────────────────────────────────

export default function Agenda() {
  const { t } = useTranslation()
  const toast   = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const printRef = useRef()
  const {
    sections: CATEGORIES,
    categoryOrder: CATEGORY_ORDER,
    agendaSectionLabel: categoryLabel,
  } = useAgendaSections()

  const [meetings, setMeetings]         = useState([])
  const [selectedId, setSelectedId]     = useState('')
  const [items, setItems]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [modalOpen, setModalOpen]       = useState(false)
  const [editingItem, setEditingItem]   = useState(null)   // item being category-edited inline
  const [submissions, setSubmissions]   = useState([])
  const [loadingSubs, setLoadingSubs]   = useState(false)
  const [saving, setSaving]             = useState(false)
  const [workflowBusy, setWorkflowBusy] = useState(false)

  const [form, setForm] = useState({
    submission_id: '',
    category: 'other',
    matters_arising_meeting_ref: '',
    matters_arising_agenda_no: '',
  })

  // ── Data fetching ──────────────────────────────────────────────────────

  const fetchMeetings = async () => {
    setLoading(true)
    try {
      const r = await api.get('/meetings/')
      const data = normalizeListPayload(r.data)
      setMeetings(data)
      if (data.length > 0 && !selectedId) setSelectedId(String(data[0].id))
    } catch { /* handled below */ }
    finally { setLoading(false) }
  }

  const fetchItems = async (id) => {
    if (!id) return
    try {
      const r = await api.get(`/agenda-items/?meeting=${id}`)
      setItems(normalizeListPayload(r.data))
    } catch { toast.error('Failed to load agenda items.') }
  }

  const hasPendingBlurbs = items.some(i => !i.agenda_blurb_processed)

  useEffect(() => {
    if (!selectedId || !hasPendingBlurbs) return undefined
    const t = setInterval(() => fetchItems(selectedId), 5000)
    return () => clearInterval(t)
  }, [selectedId, hasPendingBlurbs])

  const fetchSubmissions = async () => {
    setLoadingSubs(true)
    try {
      const r = await api.get('/submissions/?page_size=500')
      const all = normalizeListPayload(r.data)
      // Eligible: forwarded_to_commission, commission_sitting, matters_arising, or tabled
      const eligible = all.filter(s => [
        'forwarded_to_commission', 'commission_sitting',
        'matters_arising', 'tabled', 'awaiting_legal_advice',
      ].includes(s.current_stage))
      setSubmissions(eligible)
    } catch { toast.error('Failed to load submissions.') }
    finally { setLoadingSubs(false) }
  }

  useEffect(() => { fetchMeetings() }, [])
  useEffect(() => { if (selectedId) fetchItems(selectedId) }, [selectedId])

  const selectedMeeting = useMemo(
    () => meetings.find(m => String(m.id) === String(selectedId)),
    [meetings, selectedId],
  )

  // ── Group items by category in template order ──────────────────────────

  const grouped = useMemo(() => {
    const map = {}
    for (const item of items) {
      const cat = item.category || 'other'
      if (!map[cat]) map[cat] = []
      map[cat].push(item)
    }
    // Sort within each category by sequence then added_at
    for (const cat of Object.keys(map)) {
      map[cat].sort((a, b) => a.sequence - b.sequence || a.id - b.id)
    }
    return map
  }, [items])

  // Group matters arising by meeting reference
  const groupedMattersArising = useMemo(() => {
    const maItems = grouped['matters_arising'] || []
    const groups = []
    let currentGroup = null

    maItems.forEach((item, i) => {
      const ref = item.matters_arising_meeting_ref || 'Previous Meetings'
      if (!currentGroup || currentGroup.ref !== ref) {
        currentGroup = { ref, items: [] }
        groups.push(currentGroup)
      }
      currentGroup.items.push({ ...item, subLetter: subLetter(i) })
    })
    return groups
  }, [grouped])

  // Compute sequential agenda numbers (Item 3+ across categories 3-15)
  const numberedItems = useMemo(() => {
    let counter = 3
    const result = {}
    for (const cat of CATEGORY_ORDER) {
      if (cat === 'preliminaries' || cat === 'matters_arising') continue
      const catItems = grouped[cat] || []
      result[cat] = catItems.map(item => ({ ...item, agendaNo: counter++ }))
    }
    return result
  }, [grouped, CATEGORY_ORDER])

  // ── CRUD ────────────────────────────────────────────────────────────────

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const catItems = grouped[form.category] || []
      await api.post('/agenda-items/', {
        meeting: selectedId,
        submission: form.submission_id,
        category: form.category,
        sequence: catItems.length + 1,
        matters_arising_meeting_ref: form.matters_arising_meeting_ref,
        matters_arising_agenda_no:   form.matters_arising_agenda_no,
      })
      await fetchItems(selectedId)
      setModalOpen(false)
      setForm({ submission_id: '', category: 'other', matters_arising_meeting_ref: '', matters_arising_agenda_no: '' })
      toast.success('Item added to agenda.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add item.')
    } finally { setSaving(false) }
  }

  const handleRemove = async (id) => {
    const ok = await confirm({ title: 'Remove item?', message: 'Remove this item from the agenda?', confirmLabel: 'Remove' })
    if (!ok) return
    try {
      await api.delete(`/agenda-items/${id}/`)
      await fetchItems(selectedId)
      toast.success('Item removed.')
    } catch { toast.error('Failed to remove item.') }
  }

  const handleCategoryUpdate = async (item, newCat) => {
    try {
      await api.patch(`/agenda-items/${item.id}/`, { category: newCat })
      await fetchItems(selectedId)
      setEditingItem(null)
      toast.success('Category updated.')
    } catch { toast.error('Failed to update category.') }
  }

  const handleMove = async (item, direction) => {
    const catItems = (grouped[item.category] || []).sort((a, b) => a.sequence - b.sequence)
    const idx = catItems.findIndex(i => i.id === item.id)
    const swapWith = direction === 'up' ? catItems[idx - 1] : catItems[idx + 1]
    if (!swapWith) return
    try {
      await Promise.all([
        api.patch(`/agenda-items/${item.id}/`,     { sequence: swapWith.sequence }),
        api.patch(`/agenda-items/${swapWith.id}/`, { sequence: item.sequence }),
      ])
      await fetchItems(selectedId)
    } catch { toast.error('Failed to reorder.') }
  }

  const handlePushToNext = async (item) => {
    const ok = await confirm({
      title: 'Defer to next meeting?',
      message: `Move "${item.submission_title}" to the next scheduled meeting?`,
      confirmLabel: 'Defer',
    })
    if (!ok) return
    try {
      const r = await api.post(`/agenda-items/${item.id}/push-to-next/`)
      await fetchItems(selectedId)
      toast.success(r.data.detail)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to defer item.')
    }
  }

  // ── Print ────────────────────────────────────────────────────────────────

  const handlePrint = () => {
    window.print()
  }

  // ── Workflow actions ─────────────────────────────────────────────────────

  const doWorkflowAction = async (action, label) => {
    if (!selectedId) return
    const ok = await confirm({ title: `${label}?`, message: `Confirm: ${label.toLowerCase()} for this meeting?`, confirmLabel: label })
    if (!ok) return
    setWorkflowBusy(true)
    try {
      await api.post(`/meetings/${selectedId}/${action}/`)
      toast.success(`${label} completed.`)
      await fetchMeetings()   // refresh meeting list (agenda_status updated)
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed: ${label}.`)
    } finally { setWorkflowBusy(false) }
  }

  // ── Role helpers ─────────────────────────────────────────────────────────

  const role = user?.role || ''
  const isSecretaryOrAdmin = ['psc_secretary', 'senior_admin_officer', 'psc_admin'].includes(role)
  const isChairperson      = ['chairperson', 'psc_admin'].includes(role)
  const canSittingPack = [
    'psc_commissioner', 'chairperson', 'psc_secretary',
    'senior_admin_officer', 'psc_admin', 'psc_manager',
  ].includes(role)

  // ── Render helpers ───────────────────────────────────────────────────────

  const isCompleted  = selectedMeeting?.status === 'completed'
  const totalItems   = items.length
  const agendaStatus = selectedMeeting?.agenda_status || 'draft'
  const maxItems     = selectedMeeting?.max_items ?? 30
  const capacityPct  = maxItems > 0 ? Math.min(totalItems / maxItems, 1) : 0
  const isOverCapacity = totalItems > maxItems
  const isNearCapacity = !isOverCapacity && capacityPct >= 0.8

  // Categories that actually have items
  const activeCategories = CATEGORY_ORDER.filter(cat => (grouped[cat] || []).length > 0)

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Screen-only header */}
      <div className="print:hidden">
        <PageHeader
          title="Meeting Agenda"
          subtitle="Build and generate the formal PSC Commission meeting agenda"
          action={
            selectedMeeting && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {canSittingPack && (
                  <Link
                    to={`/secretariat/agenda/sitting-pack?meeting=${selectedId}`}
                    className="btn-outline flex items-center gap-2 px-4 py-2 border-indigo-300 text-indigo-800 dark:text-indigo-200"
                  >
                    <Tablet size={15} />
                    {t('sitting_pack.enter', { defaultValue: 'Sitting Pack' })}
                  </Link>
                )}
                {!isCompleted && (
                <button
                  onClick={handlePrint}
                  className="btn-outline flex items-center gap-2 px-4 py-2"
                >
                  <Printer size={15} /> Print / Export
                </button>
                )}
                {!isCompleted && (
                <button
                  onClick={() => { fetchSubmissions(); setModalOpen(true) }}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus size={16} /> Add Item
                </button>
                )}
              </div>
            )
          }
        />

        {/* Meeting selector */}
        <div className="card p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Select Meeting</label>
            <select
              className="input sm:w-96"
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
            >
              {meetings.length === 0 && <option value="">No meetings scheduled</option>}
              {meetings.map(m => (
                <option key={m.id} value={m.id}>
                  {m.reference_number} — {m.title} ({new Date(m.date + 'T00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})
                </option>
              ))}
            </select>
          </div>
          {selectedMeeting && (
            <div className="flex items-center gap-3 sm:ml-4 flex-wrap">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                📍 {selectedMeeting.venue}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                🕘 {formatTime(selectedMeeting.time)}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                selectedMeeting.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                selectedMeeting.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {selectedMeeting.status?.replace('_', ' ')}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${
                  isOverCapacity ? 'text-red-600 dark:text-red-400' :
                  isNearCapacity ? 'text-orange-600 dark:text-orange-400' :
                  'text-slate-500 dark:text-slate-400'
                }`}>
                  {totalItems} / {maxItems} items
                </span>
                <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOverCapacity ? 'bg-red-500' :
                      isNearCapacity ? 'bg-orange-400' :
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${capacityPct * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          <div className="flex-1" />
          <button onClick={() => fetchItems(selectedId)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-primary-500 transition-colors">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        {/* Workflow status bar */}
        {selectedMeeting && (
          <AgendaWorkflowBar
            status={agendaStatus}
            isCompleted={isCompleted}
            isSecretaryOrAdmin={isSecretaryOrAdmin}
            isChairperson={isChairperson}
            busy={workflowBusy}
            onSubmit={() => doWorkflowAction('submit-agenda',   'Submit to Secretary')}
            onApprove={() => doWorkflowAction('approve-agenda', 'Approve Agenda')}
            onCirculate={() => doWorkflowAction('circulate-agenda', 'Circulate Agenda')}
          />
        )}
      </div>

      {/* ── Capacity overflow warning ─────────────────────────────────── */}
      {selectedMeeting && isOverCapacity && !isCompleted && (
        <div className="mb-4 print:hidden rounded-lg border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20 px-4 py-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 dark:text-red-300">
            <span className="font-semibold">Agenda is over capacity</span> —{' '}
            {totalItems - maxItems} item{totalItems - maxItems !== 1 ? 's' : ''} over the {maxItems}-item limit.{' '}
            Use the <strong>→</strong> button on individual items to defer them to the next meeting.
          </div>
        </div>
      )}
      {selectedMeeting && isNearCapacity && !isCompleted && (
        <div className="mb-4 print:hidden rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20 px-4 py-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-orange-500 shrink-0 mt-0.5" />
          <div className="text-sm text-orange-700 dark:text-orange-300">
            <span className="font-semibold">Approaching capacity</span> —{' '}
            {totalItems} of {maxItems} slots used. Consider deferring lower-priority items to the next meeting.
          </div>
        </div>
      )}

      {/* ── The Agenda Document ─────────────────────────────────────────── */}
      {selectedMeeting ? (
        <div ref={printRef} className="print:m-0">

          {/* Agenda document — styled to match PSC template */}
          <div className="bg-white dark:bg-slate-900 print:bg-white rounded-xl border border-slate-200 dark:border-slate-700 print:border print:border-slate-400 overflow-hidden">

            {/* ── Document header ── */}
            <div className="border-b-2 border-slate-300 dark:border-slate-600 print:border-slate-800">
              <div className="px-8 py-6 text-left">
                <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 print:text-black uppercase tracking-wide leading-snug">
                  AGENDA OF PSC MEETING NO. {meetingNo(selectedMeeting)}
                </h1>
                <div className="mt-2 space-y-0.5 text-sm font-semibold text-slate-700 dark:text-slate-300 print:text-black">
                  <p><span className="inline-block w-20">Date:</span> {formatMeetingDate(selectedMeeting)}</p>
                  <p><span className="inline-block w-20">Location:</span> {selectedMeeting.venue}</p>
                  <p><span className="inline-block w-20">Time:</span> {formatTime(selectedMeeting.time)}</p>
                </div>
              </div>
            </div>

            {/* ── 1. Preliminaries & Endorsements ── */}
            <AgendaSection label="1. Preliminaries & Endorsements" isNumbered />
            <div className="px-8 py-3 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-sm text-slate-400 print:text-black mt-1">•</span>
                <p className="text-sm text-slate-800 dark:text-slate-200 print:text-black">
                  <strong>Adoption of Agenda:</strong> PSC Meeting No. {meetingNo(selectedMeeting)} of {formatMeetingDate(selectedMeeting)}.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-slate-400 print:text-black mt-1">•</span>
                <div className="flex-1">
                  <p className="text-sm text-slate-800 dark:text-slate-200 print:text-black">
                    <strong>Confirmation of Endorsement:</strong>
                  </p>
                  <ul className="mt-1 ml-4 space-y-1">
                    {(grouped['preliminaries'] || []).length > 0 ? (
                      grouped['preliminaries'].map((item, idx) => (
                        <li key={item.id} className="flex items-start gap-3 group">
                          <span className="text-sm text-slate-400 print:text-black leading-tight">o</span>
                          <p className="text-sm text-slate-700 dark:text-slate-400 print:text-black">
                            <span className="mr-2">{subLetter(idx)}.</span>
                            {item.submission_title}
                          </p>
                          {!isCompleted && (
                            <button onClick={() => handleRemove(item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 print:hidden">
                              <X size={10} />
                            </button>
                          )}
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-slate-400 italic print:hidden ml-6">(Add items like previous minutes to this section)</li>
                    )}
                  </ul>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-slate-400 print:text-black mt-1">•</span>
                <p className="text-sm text-slate-800 dark:text-slate-200 print:text-black">
                  Secretary presentation report on previous commission decision actions progress
                </p>
              </div>
            </div>

            {/* ── 2. Matters Arising ── */}
            <AgendaSection label="2. MATTERS ARISING" isNumbered />
            {groupedMattersArising.length === 0 ? (
              <div className="px-8 py-3 print:hidden">
                <p className="text-xs text-slate-400 italic">No Matters Arising items added yet.</p>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                {groupedMattersArising.map((group) => (
                  <div key={group.ref}>
                    <div className="px-8 py-1">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 print:text-black">
                        {group.ref}
                      </p>
                    </div>
                    {group.items.map((item, idx) => (
                      <MattersArisingRow
                        key={item.id}
                        item={item}
                        isCompleted={isCompleted}
                        canDefer={isSecretaryOrAdmin}
                        onRemove={handleRemove}
                        onMoveUp={() => handleMove(item, 'up')}
                        onMoveDown={() => handleMove(item, 'down')}
                        onPushToNext={() => handlePushToNext(item)}
                        isFirst={idx === 0}
                        isLastInCat={idx === group.items.length - 1}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* ── 3-15 Variable sections ── */}
            {CATEGORY_ORDER.slice(2).map(cat => {
              const catItems = numberedItems[cat] || []
              if (catItems.length === 0) return null
              return (
                <div key={cat}>
                  <AgendaSection label={categoryLabel(cat)} />
                  {catItems.map((item, idx) => (
                    <StandardRow
                      key={item.id}
                      item={item}
                      isCompleted={isCompleted}
                      canDefer={isSecretaryOrAdmin}
                      editingItem={editingItem}
                      setEditingItem={setEditingItem}
                      onRemove={handleRemove}
                      onCategoryUpdate={handleCategoryUpdate}
                      onMoveUp={() => handleMove(item, 'up')}
                      onMoveDown={() => handleMove(item, 'down')}
                      onPushToNext={() => handlePushToNext(item)}
                      isFirst={idx === 0}
                      isLastInCat={idx === catItems.length - 1}
                    />
                  ))}
                </div>
              )
            })}

            {/* Empty state */}
            {totalItems === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 print:hidden">
                <ClipboardList size={40} className="mb-3 opacity-40" />
                <p className="text-sm">No agenda items yet. Click <strong>Add Item</strong> to begin.</p>
              </div>
            )}

            {/* ── Signature block ── */}
            <div className="px-8 py-8 mt-4 border-t border-slate-200 dark:border-slate-700 print:border-slate-400">
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <div className="w-48 border-b border-slate-400 mb-1" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 print:text-black">
                    Manager – CSU
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 print:text-black">
                    Office of the Public Service Commission
                  </p>
                </div>
                <div className="text-right space-y-1 print:hidden">
                  <p className="text-xs text-slate-400">
                    {totalItems} submission{totalItems !== 1 ? 's' : ''} on agenda
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-16 text-slate-400 print:hidden">
          <AlertCircle size={32} className="mb-3 opacity-40" />
          <p className="text-sm">No meeting selected.</p>
        </div>
      )}

      {/* ── Add Item Modal ─────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        title="Add Agenda Item"
        onClose={() => setModalOpen(false)}
        size="md"
      >
          <form onSubmit={handleAdd} className="space-y-4">
            {/* Submission — pick first so we can auto-fill category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Submission <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                required
                value={form.submission_id}
                onChange={e => {
                  const id = e.target.value
                  const sub = submissions.find(s => String(s.id) === id)
                  // If it's in the 'matters_arising' stage, it belongs in the Matters Arising section.
                  // Otherwise, fall back to the submission's default agenda category.
                  const autoCat = sub?.current_stage === 'matters_arising'
                    ? 'matters_arising'
                    : (sub?.agenda_category || sub?.form_agenda_category || 'other')
                  setForm(f => ({
                    ...f,
                    submission_id: id,
                    category: autoCat,
                  }))
                }}
                disabled={loadingSubs}
              >
                <option value="">
                  {loadingSubs ? 'Loading…' : '— Select submission —'}
                </option>
                {submissions.map(s => (
                  <option key={s.id} value={s.id}>
                    [{s.form_type_code || categoryLabel(s.agenda_category || s.form_agenda_category || 'other')}] {s.reference_number} — {s.title}
                    {s.ministry_name ? ` (${s.ministry_name})` : ''}
                  </option>
                ))}
                {!loadingSubs && submissions.length === 0 && (
                  <option disabled>No eligible submissions found</option>
                )}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Shows submissions forwarded to, or currently with, the Commission.
              </p>
            </div>

            {/* Category — auto-populated from form type, still editable for override */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Agenda Section <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                required
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {form.submission_id && (
                <p className="mt-1 text-xs text-slate-400">
                  Auto-detected from submission type. Change only if incorrect.
                </p>
              )}
            </div>

            {/* Matters Arising extra fields */}
            {form.category === 'matters_arising' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Previous Meeting Reference
                  </label>
                  <input
                    className="input"
                    placeholder='e.g. "From PSC Meeting No. 10 (Monday 30th June 2025)"'
                    value={form.matters_arising_meeting_ref}
                    onChange={e => setForm(f => ({ ...f, matters_arising_meeting_ref: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Previous Agenda Number
                  </label>
                  <input
                    className="input"
                    placeholder="e.g. Agenda 20"
                    value={form.matters_arising_agenda_no}
                    onChange={e => setForm(f => ({ ...f, matters_arising_agenda_no: e.target.value }))}
                  />
                </div>
              </>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !form.submission_id}
                className="btn-primary px-6 py-2.5 disabled:opacity-50"
              >
                {saving ? 'Adding…' : 'Add to Agenda'}
              </button>
              <button
                type="button"
                className="btn-outline px-6 py-2.5"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
      </Modal>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:m-0, .print\\:m-0 * { visibility: visible; }
          .print\\:hidden { display: none !important; }
          .print\\:m-0 { position: absolute; left: 0; top: 0; width: 100%; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

// Agenda workflow status + action bar
const WORKFLOW_STEPS = [
  { key: 'draft',             label: 'Draft' },
  { key: 'with_chairman',     label: 'With Secretary' },
  { key: 'chairman_approved', label: 'Secretary Approved' },
  { key: 'circulated',        label: 'Circulated' },
]

function AgendaWorkflowBar({ status, isCompleted, isSecretaryOrAdmin, isChairperson, busy, onSubmit, onApprove, onCirculate }) {
  const currentIdx = WORKFLOW_STEPS.findIndex(s => s.key === status)

  return (
    <div className="card card-compact mb-4">
      {/* Step indicators */}
      <div className="flex items-center gap-0 mb-4">
        {WORKFLOW_STEPS.map((step, idx) => {
          const done   = idx < currentIdx
          const active = idx === currentIdx
          return (
            <div key={step.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                  ${done    ? 'bg-emerald-500 border-emerald-500 text-white' :
                    active  ? 'bg-primary-600 border-primary-600 text-white' :
                              'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400'}`}
                >
                  {done ? <Check size={13} /> : idx + 1}
                </div>
                <span className={`mt-1 text-[10px] font-medium text-center leading-tight max-w-[70px]
                  ${active ? 'text-primary-600 dark:text-primary-400' :
                    done   ? 'text-emerald-600 dark:text-emerald-400' :
                             'text-slate-400 dark:text-slate-500'}`}
                >
                  {step.label}
                </span>
              </div>
              {idx < WORKFLOW_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors
                  ${idx < currentIdx ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Action button(s) for current step */}
      {!isCompleted && (
        <div className="flex flex-wrap gap-2">
          {status === 'draft' && isSecretaryOrAdmin && (
            <button
              onClick={onSubmit}
              disabled={busy}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              <Send size={14} /> Submit to Secretary
            </button>
          )}
          {status === 'with_chairman' && isChairperson && (
            <button
              onClick={onApprove}
              disabled={busy}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              <ThumbsUp size={14} /> Approve Agenda
            </button>
          )}
          {status === 'chairman_approved' && isSecretaryOrAdmin && (
            <button
              onClick={onCirculate}
              disabled={busy}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              <Mail size={14} /> Circulate to Members
            </button>
          )}
          {status === 'circulated' && (
            <span className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              <Check size={14} /> Agenda has been circulated to Commission members.
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function AgendaSection({ label, isNumbered }) {
  return (
    <div className={`px-8 py-2 ${isNumbered ? 'pt-3' : 'pt-4'} border-t border-slate-200 dark:border-slate-700 print:border-slate-400 bg-slate-50 dark:bg-slate-800/40 print:bg-transparent`}>
      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 print:text-black">
        {label}
      </p>
    </div>
  )
}

function MattersArisingRow({ item, isCompleted, canDefer, onRemove, onMoveUp, onMoveDown, onPushToNext, isFirst, isLastInCat }) {
  return (
    <div className="px-8 py-1.5 flex items-start gap-4 group">
      <span className="text-sm font-medium text-slate-400 print:text-black shrink-0 w-8 text-right">•</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 dark:text-slate-200 print:text-black">
          <span className="font-medium mr-2">{item.subLetter}.</span>
          {item.matters_arising_agenda_no && (
            <span className="font-semibold">{item.matters_arising_agenda_no}: </span>
          )}
          {item.submission_title}
          {item.submission_ministry && (
            <span className="text-slate-400 dark:text-slate-500"> — {item.submission_ministry}</span>
          )}
        </p>
      </div>
      {/* Screen-only controls */}
      {!isCompleted && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden shrink-0">
          <button onClick={onMoveUp}   disabled={isFirst}     className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-20"><ChevronUp   size={13} /></button>
          <button onClick={onMoveDown} disabled={isLastInCat} className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-20"><ChevronDown size={13} /></button>
          {canDefer && (
            <button onClick={onPushToNext} title="Defer to next meeting" className="p-1 rounded text-slate-400 hover:text-amber-500">
              <ChevronsRight size={13} />
            </button>
          )}
          <button onClick={() => onRemove(item.id)} className="p-1 rounded text-slate-400 hover:text-red-500"><X size={13} /></button>
        </div>
      )}
    </div>
  )
}

function StandardRow({ item, isCompleted, canDefer, editingItem, setEditingItem, onRemove, onCategoryUpdate, onMoveUp, onMoveDown, onPushToNext, isFirst, isLastInCat }) {
  const isEditing = editingItem === item.id
  const [pendingCat, setPendingCat] = useState(item.category)

  return (
    <div className="px-8 py-2.5 border-t border-slate-100 dark:border-slate-800 print:border-slate-300 flex items-start gap-4 group">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 print:text-black shrink-0 w-8">
        {item.agendaNo}.
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 dark:text-slate-200 print:text-black leading-snug">
          {item.submission_title}
          {item.submission_ministry && (
            <span className="text-slate-400 dark:text-slate-500"> — {item.submission_ministry}</span>
          )}
        </p>
        {item.agenda_blurb && (
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed print:text-black">
            {item.agenda_blurb}
          </p>
        )}
        {!item.agenda_blurb_processed && !item.agenda_blurb && (
          <AiTextSkeleton
            className="mt-1.5 print:hidden"
            lines={3}
            statusLabel="Generating AI blurb…"
          />
        )}
        {item.agenda_blurb && (
          <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1 print:hidden">AI draft — verify</p>
        )}
        <p className="text-[11px] text-slate-400 font-mono mt-0.5 print:hidden">{item.submission_reference}</p>

        {/* Inline category editor */}
        {isEditing && (
          <div className="flex items-center gap-2 mt-2 print:hidden">
            <select
              className="input text-xs py-1"
              value={pendingCat}
              onChange={e => setPendingCat(e.target.value)}
              autoFocus
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <button
              onClick={() => onCategoryUpdate(item, pendingCat)}
              className="p-1.5 rounded-md bg-primary-600 text-white hover:bg-primary-700"
            >
              <Check size={12} />
            </button>
            <button
              onClick={() => setEditingItem(null)}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Screen-only controls */}
      {!isCompleted && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden shrink-0">
          <button onClick={onMoveUp}   disabled={isFirst}     className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-20"><ChevronUp   size={13} /></button>
          <button onClick={onMoveDown} disabled={isLastInCat} className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-20"><ChevronDown size={13} /></button>
          <button
            onClick={() => { setEditingItem(isEditing ? null : item.id); setPendingCat(item.category) }}
            className="p-1 rounded text-slate-400 hover:text-primary-500"
            title="Change category"
          >
            <Pencil size={12} />
          </button>
          {canDefer && (
            <button
              onClick={onPushToNext}
              title="Defer to next meeting"
              className="p-1 rounded text-slate-400 hover:text-amber-500"
            >
              <ChevronsRight size={13} />
            </button>
          )}
          <button onClick={() => onRemove(item.id)} className="p-1 rounded text-slate-400 hover:text-red-500">
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

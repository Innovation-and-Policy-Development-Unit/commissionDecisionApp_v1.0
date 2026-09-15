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
import { useEffect, useState, useMemo, useRef, Fragment } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import Modal from '../../components/shared/Modal'
import AiTextSkeleton from '../../components/shared/AiTextSkeleton'
import api from '../../api/client'
import { isTabVisible } from '../../hooks/useVisibilityAwareInterval'
import { normalizeListPayload, normalizeFieldPayload } from '../../utils/listPayload'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus, X, RefreshCw, Printer, Check, Tag, Search,
  ChevronUp, ChevronDown, AlertCircle, ClipboardList,
  Send, ThumbsUp, ChevronsRight, Tablet, LayoutGrid, StickyNote,
  FileDown, Users, Eye, Mail,
} from 'lucide-react'
import { useAgendaSections } from '../../hooks/useAgendaSections'
import AgendaReadinessChip, { computeReadiness } from '../../components/shared/AgendaReadinessChip'

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
  const advancedMenuRef = useRef()
  const [advancedMenuOpen, setAdvancedMenuOpen] = useState(false)
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
  const [circulateModalOpen, setCirculateModalOpen]       = useState(false)
  const [circulatePreview, setCirculatePreview]           = useState(null)
  const [circulatePreviewLoading, setCirculatePreviewLoading] = useState(false)
  const [circulationStatus, setCirculationStatus]         = useState(null)
  const [circulationStatusOpen, setCirculationStatusOpen] = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')

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
      let data = normalizeListPayload(r.data)
      if (endorsedOnlyViewer) {
        // Read-only OPSC viewers only ever see circulated agendas — endorsing
        // now auto-circulates, so there's no separate "endorsed but not yet
        // circulated" state to include any more.
        data = data.filter(m => m.agenda_status === 'circulated')
      }
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
    } catch { toast.error(t('agenda.toast_load_items_failed')) }
  }

  const hasPendingBlurbs = items.some(i => !i.agenda_blurb_processed)

  useEffect(() => {
    if (!selectedId || !hasPendingBlurbs) return undefined
    const timer = setInterval(() => {
      if (isTabVisible()) fetchItems(selectedId)
    }, 5000)
    return () => clearInterval(timer)
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
    } catch { toast.error(t('agenda.toast_load_submissions_failed')) }
    finally { setLoadingSubs(false) }
  }

  useEffect(() => { fetchMeetings() }, [])
  useEffect(() => { if (selectedId) fetchItems(selectedId) }, [selectedId])

  // Close the "Advanced" (manual placement) menu on outside click
  useEffect(() => {
    if (!advancedMenuOpen) return
    const onClickOutside = (e) => {
      if (advancedMenuRef.current && !advancedMenuRef.current.contains(e.target)) {
        setAdvancedMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [advancedMenuOpen])

  // A live on-screen search filter must never carry over into an actual
  // print — clear it around the browser's print dialog and restore
  // afterwards, so window.print() always renders the full agenda regardless
  // of what was being scanned for a moment ago.
  const searchQueryRef = useRef('')
  useEffect(() => { searchQueryRef.current = searchQuery }, [searchQuery])
  const printSearchBackupRef = useRef('')
  useEffect(() => {
    const clearForPrint = () => { printSearchBackupRef.current = searchQueryRef.current; setSearchQuery('') }
    const restoreAfterPrint = () => setSearchQuery(printSearchBackupRef.current)
    window.addEventListener('beforeprint', clearForPrint)
    window.addEventListener('afterprint', restoreAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', clearForPrint)
      window.removeEventListener('afterprint', restoreAfterPrint)
    }
  }, [])

  // The search/jump-nav card is sticky (top-16, clearing the fixed h-16 app
  // header) but its own height varies — the jump-nav pills wrap onto more
  // lines as more categories match or the viewport narrows. A jump target's
  // scroll-margin-top has to track that real height, not a guessed constant,
  // or a section heading ends up scrolled to sit right underneath the card
  // instead of visible below it.
  const searchBarRef = useRef(null)
  useEffect(() => {
    const el = searchBarRef.current
    if (!el) return undefined
    const APP_HEADER_HEIGHT = 64 // Header.jsx: fixed h-16
    const BREATHING_ROOM = 12
    const applyOffset = () => {
      document.documentElement.style.setProperty(
        '--agenda-scroll-offset',
        `${APP_HEADER_HEIGHT + el.getBoundingClientRect().height + BREATHING_ROOM}px`
      )
    }
    applyOffset()
    const observer = new ResizeObserver(applyOffset)
    observer.observe(el)
    return () => observer.disconnect()
  }, [searchQuery])

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

  // Preliminaries items, lettered once up front — a live search filter only
  // ever hides rows below, it never renumbers the official document lettering.
  const preliminariesItems = useMemo(
    () => (grouped['preliminaries'] || []).map((item, idx) => ({ ...item, subLetter: subLetter(idx) })),
    [grouped],
  )

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

  // ── Search / filter ──────────────────────────────────────────────────────
  // A scanning aid only — numbering above is always computed off the full
  // list first, filtering only affects which already-numbered rows render.

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const matchesSearch = (item) => {
    if (!normalizedQuery) return true
    const haystack = `${item.submission_title || ''} ${item.submission_ministry || ''} ${item.submission_reference || ''}`.toLowerCase()
    return haystack.includes(normalizedQuery)
  }
  const hasSearchResults = !normalizedQuery || items.some(matchesSearch)

  // Make the search box actually feel like it "takes you there": scroll the
  // first section with a match into view shortly after the user stops
  // typing, rather than leaving a passive filter the user has to notice by
  // scrolling past it themselves.
  useEffect(() => {
    if (!normalizedQuery) return undefined
    const timer = setTimeout(() => {
      const order = ['preliminaries', 'matters_arising', ...CATEGORY_ORDER.slice(2)]
      for (const cat of order) {
        const list = grouped[cat] || []
        if (list.some(matchesSearch)) {
          document.getElementById(`agenda-section-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          break
        }
      }
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedQuery, grouped, CATEGORY_ORDER])

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
      toast.success(t('agenda.toast_item_added'))
    } catch (err) {
      toast.error(err.response?.data?.detail || t('agenda.toast_add_failed'))
    } finally { setSaving(false) }
  }

  const handleRemove = async (id) => {
    const ok = await confirm({
      title: t('agenda.toast_remove_confirm_title'),
      message: t('agenda.toast_remove_confirm_message'),
      confirmLabel: t('agenda.toast_remove_confirm_label'),
    })
    if (!ok) return
    try {
      await api.delete(`/agenda-items/${id}/`)
      await fetchItems(selectedId)
      toast.success(t('agenda.toast_item_removed'))
    } catch { toast.error(t('agenda.toast_remove_failed')) }
  }

  const handleCategoryUpdate = async (item, newCat) => {
    try {
      await api.patch(`/agenda-items/${item.id}/`, { category: newCat })
      await fetchItems(selectedId)
      setEditingItem(null)
      toast.success(t('agenda.toast_category_updated'))
    } catch (err) {
      toast.error(err.response?.data?.detail || t('agenda.toast_category_update_failed'))
    }
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
    } catch { toast.error(t('agenda.toast_reorder_failed')) }
  }

  const handlePushToNext = async (item) => {
    const ok = await confirm({
      title: t('agenda.toast_defer_confirm_title'),
      message: t('agenda.toast_defer_confirm_message', { title: item.submission_title }),
      confirmLabel: t('agenda.toast_defer_confirm_label'),
    })
    if (!ok) return
    try {
      const r = await api.post(`/agenda-items/${item.id}/push-to-next/`)
      await fetchItems(selectedId)
      toast.success(r.data.detail)
    } catch (err) {
      toast.error(err.response?.data?.detail || t('agenda.toast_defer_failed'))
    }
  }

  // ── Print / export ──────────────────────────────────────────────────────

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPdf = async () => {
    if (!selectedId) return
    try {
      const r = await api.get(`/meetings/${selectedId}/agenda-pdf/`, { responseType: 'blob' })
      const blobUrl = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `agenda_${(selectedMeeting?.reference_number || 'meeting').replace(/\//g, '-')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    } catch {
      toast.error(t('agenda.toast_download_pdf_failed'))
    }
  }

  // ── Workflow actions ─────────────────────────────────────────────────────

  const doWorkflowAction = async (action, { confirmTitle, confirmMessage, confirmLabel, successMsg, failMsg }) => {
    if (!selectedId) return
    const ok = await confirm({ title: confirmTitle, message: confirmMessage, confirmLabel })
    if (!ok) return
    setWorkflowBusy(true)
    try {
      await api.post(`/meetings/${selectedId}/${action}/`)
      toast.success(successMsg)
      await fetchMeetings()   // refresh meeting list (agenda_status updated)
    } catch (err) {
      toast.error(err.response?.data?.detail || failMsg)
    } finally { setWorkflowBusy(false) }
  }

  // Endorse & Circulate is one-way (immediately emails every Commission
  // member) — show who/how-much before committing, instead of a plain
  // yes/no confirm.
  const openCirculateModal = async () => {
    if (!selectedId) return
    setCirculateModalOpen(true)
    setCirculatePreviewLoading(true)
    setCirculatePreview(null)
    try {
      const r = await api.get(`/meetings/${selectedId}/circulation-preview/`)
      setCirculatePreview(r.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || t('agenda.toast_circulation_preview_failed'))
      setCirculateModalOpen(false)
    } finally {
      setCirculatePreviewLoading(false)
    }
  }

  const confirmCirculate = async () => {
    if (!selectedId) return
    setWorkflowBusy(true)
    try {
      await api.post(`/meetings/${selectedId}/approve-agenda/`)
      toast.success(t('agenda.toast_circulated_success'))
      setCirculateModalOpen(false)
      await fetchMeetings()
    } catch (err) {
      toast.error(err.response?.data?.detail || t('agenda.toast_circulate_failed'))
    } finally {
      setWorkflowBusy(false)
    }
  }

  // ── Role helpers ─────────────────────────────────────────────────────────

  const role = user?.role || ''
  const isAdminUser = Boolean(user?.is_superuser || user?.is_staff)
  const isSecretaryOrAdmin = isAdminUser
    || ['psc_secretary', 'senior_admin_officer', 'psc_admin'].includes(role)
  // Stage-B agenda chain: Senior Admin Officer and Secretary can both build/
  // edit the agenda's content (canManageAgenda below); only the Secretary
  // submits it to the Chairman, who then endorses it.
  const isSecretary        = ['psc_secretary', 'psc_admin'].includes(role) || isAdminUser
  const isChairperson      = ['chairperson', 'psc_admin'].includes(role) || isAdminUser
  const canSittingPack = isAdminUser || [
    'psc_commissioner', 'chairperson', 'psc_secretary',
    'senior_admin_officer', 'psc_admin', 'psc_manager',
  ].includes(role)
  // Everyone else within OPSC (unit managers, principals, officers…) is a
  // read-only viewer who may only see Chairman-endorsed / circulated agendas.
  const canManageAgenda = isSecretaryOrAdmin
  const isCommissionMember = ['psc_commissioner', 'chairperson'].includes(role)
  const endorsedOnlyViewer = !canManageAgenda && !isCommissionMember

  // ── Render helpers ───────────────────────────────────────────────────────

  const isCompleted  = selectedMeeting?.status === 'completed'
  // Read-only: completed sittings for everyone; always for non-secretariat viewers.
  const readOnly     = isCompleted || !canManageAgenda
  const totalItems   = items.length
  const agendaStatus = selectedMeeting?.agenda_status || 'draft'
  const maxItems     = selectedMeeting?.max_items ?? 30
  const minItems     = selectedMeeting?.min_items ?? 5
  const capacityPct  = maxItems > 0 ? Math.min(totalItems / maxItems, 1) : 0
  const isOverCapacity = totalItems > maxItems
  const isNearCapacity = !isOverCapacity && capacityPct >= 0.8
  // Chairman's agenda-readiness signal — recomputed live as items are edited.
  const readiness    = computeReadiness(totalItems, minItems, maxItems)
  const belowReadiness = !isCompleted && (readiness.level === 'empty' || readiness.level === 'building')

  // Secretary/Chairperson: who has actually opened a circulated agenda ahead
  // of the sitting, not just that an email went out.
  useEffect(() => {
    if (!selectedId || agendaStatus !== 'circulated' || !(isSecretaryOrAdmin || isChairperson)) {
      setCirculationStatus(null)
      return undefined
    }
    let cancelled = false
    api.get(`/meetings/${selectedId}/circulation-status/`)
      .then(r => { if (!cancelled) setCirculationStatus(r.data) })
      .catch(() => { if (!cancelled) setCirculationStatus(null) })
    return () => { cancelled = true }
  }, [selectedId, agendaStatus, isSecretaryOrAdmin, isChairperson])

  // Commission member/Chairperson: record that this circulated agenda was
  // opened (best-effort, no UI feedback needed).
  useEffect(() => {
    if (!selectedId || agendaStatus !== 'circulated' || !isCommissionMember) return
    api.post(`/meetings/${selectedId}/mark-agenda-viewed/`).catch(() => { /* best-effort */ })
  }, [selectedId, agendaStatus, isCommissionMember])

  // Categories that actually have items
  const activeCategories = CATEGORY_ORDER.filter(cat => (grouped[cat] || []).length > 0)

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Screen-only header */}
      <div className="print:hidden">
        <PageHeader
          title={t('agenda.title')}
          subtitle={t('agenda.subtitle')}
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
                {(isCommissionMember || isAdminUser) && (
                  <Link
                    to={`/secretariat/agenda/my-notes?meeting=${selectedId}`}
                    className="btn-outline flex items-center gap-2 px-4 py-2"
                  >
                    <StickyNote size={15} /> {t('agenda.my_notes')}
                  </Link>
                )}
                {!isCompleted && (
                <button
                  onClick={handlePrint}
                  className="btn-outline flex items-center gap-2 px-4 py-2"
                  title={t('agenda.print_hint')}
                >
                  <Printer size={15} /> {t('agenda.print')}
                </button>
                )}
                {!isCompleted && (
                <button
                  onClick={handleDownloadPdf}
                  className="btn-outline flex items-center gap-2 px-4 py-2"
                  title={t('agenda.download_pdf_hint')}
                >
                  <FileDown size={15} /> {t('agenda.download_pdf')}
                </button>
                )}
                {/* Add Item lives at the top level (not behind Advanced) since it's
                    the only path for Matters Arising carry-overs, which come up
                    at every meeting, not just as an exception. */}
                {!readOnly && (
                  <button
                    onClick={() => { fetchSubmissions(); setModalOpen(true) }}
                    className="btn-outline flex items-center gap-2 px-4 py-2"
                    title={t('agenda.add_item_hint')}
                  >
                    <Plus size={15} /> {t('agenda.add_item')}
                  </button>
                )}
                {/* Sitting Workspace — drag-and-drop tool for genuine exceptions
                    (no meeting scheduled yet, or reordering), tucked behind
                    Advanced rather than sitting alongside everyday actions. */}
                {canManageAgenda && (
                  <div className="relative" ref={advancedMenuRef}>
                    <button
                      onClick={() => setAdvancedMenuOpen(o => !o)}
                      className="btn-outline flex items-center gap-2 px-4 py-2"
                      title={t('agenda.advanced_hint')}
                    >
                      {t('agenda.advanced')} <ChevronDown size={15} />
                    </button>
                    {advancedMenuOpen && (
                      <div className="absolute right-0 mt-2 w-72 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg z-20 py-1">
                        <Link
                          to={`/secretariat/meetings/${selectedId}/workspace`}
                          onClick={() => setAdvancedMenuOpen(false)}
                          className="flex items-start gap-2 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        >
                          <LayoutGrid size={15} className="mt-0.5 shrink-0" />
                          <span>
                            <span className="block font-medium text-slate-800 dark:text-slate-100">{t('agenda.sitting_workspace')}</span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400">
                              {t('agenda.sitting_workspace_hint')}
                            </span>
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          }
        />

        {/* Meeting selector */}
        <div className="card p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">{t('agenda.select_meeting')}</label>
            <select
              className="input sm:w-96"
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
            >
              {meetings.length === 0 && (
                <option value="">
                  {endorsedOnlyViewer ? t('agenda.no_endorsed_agendas') : t('agenda.no_meetings_scheduled')}
                </option>
              )}
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
                {selectedMeeting.status === 'completed' ? t('agenda.status_completed') :
                 selectedMeeting.status === 'in_progress' ? t('agenda.status_in_progress') :
                 t('agenda.status_scheduled')}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${
                  isOverCapacity ? 'text-red-600 dark:text-red-400' :
                  isNearCapacity ? 'text-orange-600 dark:text-orange-400' :
                  'text-slate-500 dark:text-slate-400'
                }`}>
                  {t('agenda.items_count', { count: totalItems, max: maxItems })}
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
              <AgendaReadinessChip readiness={readiness} size="sm" />
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
            isSecretary={isSecretary}
            isChairperson={isChairperson}
            busy={workflowBusy}
            onSubmit={() => doWorkflowAction('submit-to-chairman', {
              confirmTitle: t('agenda.confirm_submit_title'),
              confirmMessage: t('agenda.confirm_submit_message'),
              confirmLabel: t('agenda.workflow_submit_to_chairman'),
              successMsg: t('agenda.toast_submit_success'),
              failMsg: t('agenda.toast_submit_failed'),
            })}
            onApprove={openCirculateModal}
            onAdopt={() => doWorkflowAction('adopt-agenda', {
              confirmTitle: t('agenda.confirm_adopt_title'),
              confirmMessage: t('agenda.confirm_adopt_message'),
              confirmLabel: t('agenda.workflow_adopt'),
              successMsg: t('agenda.toast_adopt_success'),
              failMsg: t('agenda.toast_adopt_failed'),
            })}
            agendaAdopted={Boolean(selectedMeeting?.agenda_adopted_at)}
            canSeeCirculationStatus={isSecretaryOrAdmin || isChairperson}
            circulationStatus={circulationStatus}
            circulationStatusOpen={circulationStatusOpen}
            onToggleCirculationStatus={() => setCirculationStatusOpen(o => !o)}
          />
        )}

        {/* Search + section jump nav — helps scanning a long agenda. Sticky so
            it stays reachable while scrolling through a long document instead
            of scrolling away with the header above it. */}
        {selectedMeeting && totalItems > 0 && (
          <div ref={searchBarRef} className="card card-compact mb-4 p-3 space-y-3 sticky top-16 z-10 shadow-md">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('agenda.search_placeholder')}
                className="input pl-8 text-sm py-1.5"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="font-semibold text-slate-400 uppercase tracking-wide mr-1 shrink-0">{t('agenda.jump_to')}</span>
              {(() => {
                const count = (grouped['matters_arising'] || []).filter(matchesSearch).length
                if (count === 0) return null
                return (
                  <a
                    href="#agenda-section-matters_arising"
                    className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-900/30 text-slate-600 dark:text-slate-300 whitespace-nowrap"
                  >
                    {t('agenda.matters_arising_nav')} <span className="text-slate-400">({count})</span>
                  </a>
                )
              })()}
              {CATEGORY_ORDER.slice(2).map(cat => {
                const count = (grouped[cat] || []).filter(matchesSearch).length
                if (count === 0) return null
                return (
                  <a
                    key={cat}
                    href={`#agenda-section-${cat}`}
                    className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-900/30 text-slate-600 dark:text-slate-300 whitespace-nowrap"
                  >
                    {categoryLabel(cat)} <span className="text-slate-400">({count})</span>
                  </a>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Agenda readiness (Chairman: enough to convene?) ─────────────── */}
      {selectedMeeting && belowReadiness && (
        <div className="mb-4 print:hidden rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 px-4 py-3 flex items-start gap-3">
          <ClipboardList size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700 dark:text-amber-300">
            <span className="font-semibold">
              {readiness.level === 'empty' ? t('agenda.readiness_empty_title') : t('agenda.readiness_building_title')}
            </span>{' '}
            {t('agenda.readiness_placed', { count: totalItems, min: minItems })}{' '}
            {readiness.shortfall > 0 && t('agenda.readiness_add_more', { count: readiness.shortfall })}
          </div>
        </div>
      )}
      {selectedMeeting && !isCompleted && readiness.is_ready && !isOverCapacity && !isNearCapacity && (
        <div className="mb-4 print:hidden rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20 px-4 py-3 flex items-start gap-3">
          <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-700 dark:text-emerald-300">
            <span className="font-semibold">{t('agenda.readiness_ready_title')}</span> —{' '}
            {t('agenda.readiness_ready_detail', { count: totalItems, min: minItems })}
          </div>
        </div>
      )}

      {/* ── Capacity overflow warning ─────────────────────────────────── */}
      {selectedMeeting && isOverCapacity && !isCompleted && (
        <div className="mb-4 print:hidden rounded-lg border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20 px-4 py-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 dark:text-red-300">
            <span className="font-semibold">{t('agenda.capacity_over_title')}</span> —{' '}
            {t('agenda.capacity_over_detail', { count: totalItems - maxItems, max: maxItems })}{' '}
            {t('agenda.capacity_over_hint')}
          </div>
        </div>
      )}
      {selectedMeeting && isNearCapacity && !isCompleted && (
        <div className="mb-4 print:hidden rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20 px-4 py-3 flex items-start gap-3">
          <AlertCircle size={16} className="text-orange-500 shrink-0 mt-0.5" />
          <div className="text-sm text-orange-700 dark:text-orange-300">
            <span className="font-semibold">{t('agenda.capacity_near_title')}</span> —{' '}
            {t('agenda.capacity_near_detail', { count: totalItems, max: maxItems })}
          </div>
        </div>
      )}

      {/* ── No search results ────────────────────────────────────────── */}
      {selectedMeeting && normalizedQuery && !hasSearchResults && (
        <div className="mb-4 print:hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          {t('agenda.search_no_results', { query: searchQuery })}
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
                  {t('agenda.doc_heading', { number: meetingNo(selectedMeeting) })}
                </h1>
                <div className="mt-2 space-y-0.5 text-sm font-semibold text-slate-700 dark:text-slate-300 print:text-black">
                  <p><span className="inline-block w-20">{t('agenda.doc_date_label')}</span> {formatMeetingDate(selectedMeeting)}</p>
                  <p><span className="inline-block w-20">{t('agenda.doc_location_label')}</span> {selectedMeeting.venue}</p>
                  <p><span className="inline-block w-20">{t('agenda.doc_time_label')}</span> {formatTime(selectedMeeting.time)}</p>
                </div>
              </div>
            </div>

            {/* ── 1. Preliminaries & Endorsements ── */}
            <AgendaSection label={t('agenda.doc_section_preliminaries')} isNumbered id="agenda-section-preliminaries" />
            <div className="px-8 py-3 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-sm text-slate-400 print:text-black mt-1">•</span>
                <p className="text-sm text-slate-800 dark:text-slate-200 print:text-black">
                  <strong>{t('agenda.doc_adoption_of_agenda')}</strong>{' '}
                  {t('agenda.doc_adoption_of_agenda_detail', { number: meetingNo(selectedMeeting), date: formatMeetingDate(selectedMeeting) })}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-slate-400 print:text-black mt-1">•</span>
                <div className="flex-1">
                  <p className="text-sm text-slate-800 dark:text-slate-200 print:text-black">
                    <strong>{t('agenda.doc_confirmation_of_endorsement')}</strong>
                  </p>
                  <ul className="mt-1 ml-4 space-y-1">
                    {preliminariesItems.filter(matchesSearch).length > 0 ? (
                      preliminariesItems.filter(matchesSearch).map((item) => (
                        <li key={item.id} className="flex items-start gap-3 group">
                          <span className="text-sm text-slate-400 print:text-black leading-tight">o</span>
                          <p className="text-sm text-slate-700 dark:text-slate-400 print:text-black">
                            <span className="mr-2">{item.subLetter}.</span>
                            {item.submission_title}
                          </p>
                          {!readOnly && (
                            <button onClick={() => handleRemove(item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 print:hidden">
                              <X size={10} />
                            </button>
                          )}
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-slate-400 italic print:hidden ml-6">{t('agenda.doc_add_previous_minutes_hint')}</li>
                    )}
                  </ul>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-slate-400 print:text-black mt-1">•</span>
                <p className="text-sm text-slate-800 dark:text-slate-200 print:text-black">
                  {t('agenda.doc_secretary_report')}
                </p>
              </div>
            </div>

            {/* ── 2. Matters Arising ── */}
            <AgendaSection label={t('agenda.doc_section_matters_arising')} isNumbered id="agenda-section-matters_arising" />
            {groupedMattersArising.length === 0 ? (
              <div className="px-8 py-3 print:hidden">
                <p className="text-xs text-slate-400 italic">{t('agenda.doc_no_matters_arising')}</p>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                {groupedMattersArising.map((group) => {
                  const visibleItems = group.items.filter(matchesSearch)
                  if (visibleItems.length === 0) return null
                  return (
                    <div key={group.ref}>
                      <div className="px-8 py-1">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 print:text-black">
                          {group.ref}
                        </p>
                      </div>
                      {visibleItems.map((item, idx) => (
                        <MattersArisingRow
                          key={item.id}
                          item={item}
                          isCompleted={readOnly}
                          canDefer={isSecretaryOrAdmin}
                          onRemove={handleRemove}
                          onMoveUp={() => handleMove(item, 'up')}
                          onMoveDown={() => handleMove(item, 'down')}
                          onPushToNext={() => handlePushToNext(item)}
                          isFirst={idx === 0}
                          isLastInCat={idx === visibleItems.length - 1}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── 3-15 Variable sections ── */}
            {CATEGORY_ORDER.slice(2).map(cat => {
              const allCatItems = numberedItems[cat] || []
              const catItems = allCatItems.filter(matchesSearch)
              if (catItems.length === 0) return null
              // Sub-group by submission type (e.g. all Voluntary Resignations
              // together) — only show the sub-headers when the category
              // actually mixes more than one type.
              const distinctTypes = new Set(catItems.map(it => it.form_type_code || ''))
              const showTypeHeaders = distinctTypes.size > 1
              return (
                <div key={cat}>
                  <AgendaSection label={categoryLabel(cat)} id={`agenda-section-${cat}`} />
                  {catItems.map((item, idx) => {
                    const isNewTypeGroup = showTypeHeaders &&
                      (idx === 0 || item.form_type_code !== catItems[idx - 1].form_type_code)
                    return (
                      <Fragment key={item.id}>
                        {isNewTypeGroup && (
                          <div className="px-8 pt-2 pb-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 print:text-black">
                              {item.form_type_display || t('agenda.doc_other_type')}
                            </p>
                          </div>
                        )}
                        <StandardRow
                          item={item}
                          isCompleted={readOnly}
                          canDefer={isSecretaryOrAdmin}
                          categories={CATEGORIES}
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
                      </Fragment>
                    )
                  })}
                </div>
              )
            })}

            {/* Empty state */}
            {totalItems === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 print:hidden">
                <ClipboardList size={40} className="mb-3 opacity-40" />
                <p className="text-sm">{t('agenda.doc_empty_state')}</p>
              </div>
            )}

          </div>
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-16 text-slate-400 print:hidden">
          <AlertCircle size={32} className="mb-3 opacity-40" />
          <p className="text-sm">{t('agenda.no_meeting_selected')}</p>
        </div>
      )}

      {/* ── Add Item Modal ─────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        title={t('agenda.add_modal_title')}
        onClose={() => setModalOpen(false)}
        size="md"
      >
          <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1 mb-3">
            {t('agenda.add_modal_workspace_hint')}
          </p>
          <form onSubmit={handleAdd} className="space-y-4">
            {/* Submission — pick first so we can auto-fill category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('agenda.add_modal_submission_label')} <span className="text-red-500">*</span>
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
                  {loadingSubs ? t('agenda.add_modal_loading') : t('agenda.add_modal_submission_select')}
                </option>
                {submissions.map(s => (
                  <option key={s.id} value={s.id}>
                    [{s.form_type_code || categoryLabel(s.agenda_category || s.form_agenda_category || 'other')}] {s.reference_number} — {s.title}
                    {s.ministry_name ? ` (${s.ministry_name})` : ''}
                  </option>
                ))}
                {!loadingSubs && submissions.length === 0 && (
                  <option disabled>{t('agenda.add_modal_no_eligible')}</option>
                )}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                {t('agenda.add_modal_submission_hint')}
              </p>
            </div>

            {/* Category — auto-populated from form type, still editable for override */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('agenda.add_modal_section_label')} <span className="text-red-500">*</span>
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
                  {t('agenda.add_modal_section_hint')}
                </p>
              )}
            </div>

            {/* Matters Arising extra fields */}
            {form.category === 'matters_arising' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('agenda.add_modal_prev_ref_label')}
                  </label>
                  <input
                    className="input"
                    placeholder={t('agenda.add_modal_prev_ref_placeholder')}
                    value={form.matters_arising_meeting_ref}
                    onChange={e => setForm(f => ({ ...f, matters_arising_meeting_ref: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('agenda.add_modal_prev_no_label')}
                  </label>
                  <input
                    className="input"
                    placeholder={t('agenda.add_modal_prev_no_placeholder')}
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
                {saving ? t('agenda.add_modal_submitting') : t('agenda.add_modal_submit')}
              </button>
              <button
                type="button"
                className="btn-outline px-6 py-2.5"
                onClick={() => setModalOpen(false)}
              >
                {t('agenda.cancel')}
              </button>
            </div>
          </form>
      </Modal>

      {/* ── Endorse & Circulate confirm modal ─────────────────────────────── */}
      <Modal
        open={circulateModalOpen}
        title={t('agenda.circulate_modal_title')}
        subtitle={t('agenda.circulate_modal_subtitle')}
        onClose={() => setCirculateModalOpen(false)}
        size="md"
        footer={
          <>
            <button className="btn-outline px-4 py-2" onClick={() => setCirculateModalOpen(false)}>
              {t('agenda.cancel')}
            </button>
            <button
              className="btn-primary flex items-center gap-2 px-4 py-2 disabled:opacity-50"
              disabled={circulatePreviewLoading || workflowBusy || !circulatePreview?.recipient_count}
              onClick={confirmCirculate}
            >
              <ThumbsUp size={14} /> {workflowBusy ? t('agenda.circulate_modal_confirming') : t('agenda.circulate_modal_confirm')}
            </button>
          </>
        }
      >
        {circulatePreviewLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('agenda.circulate_modal_loading')}</p>
        ) : circulatePreview ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
              <Users size={15} className="mt-0.5 shrink-0" />
              <span>
                {t('agenda.circulate_modal_summary', {
                  reference: circulatePreview.meeting_reference,
                  count: circulatePreview.item_count,
                  recipients: circulatePreview.recipient_count,
                })}
              </span>
            </p>
            {circulatePreview.short_notice && (
              <p className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>
                  {t('agenda.notice_short', {
                    days: circulatePreview.notice_days,
                    min: circulatePreview.recommended_minimum_notice_days,
                  })}
                </span>
              </p>
            )}
            <ul className="space-y-1.5 max-h-60 overflow-y-auto">
              {circulatePreview.recipients.map(r => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 text-sm px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60"
                >
                  <span className="text-slate-800 dark:text-slate-200 truncate">{r.name}</span>
                  {r.has_email ? (
                    <span className="text-xs text-slate-400 shrink-0 truncate max-w-[45%]">{r.email}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-500 shrink-0">
                      <AlertCircle size={12} /> {t('agenda.circulate_modal_no_email')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {circulatePreview.recipient_count === 0 && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle size={14} /> {t('agenda.circulate_modal_no_recipients')}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-red-500">{t('agenda.circulate_modal_load_failed')}</p>
        )}
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
  { key: 'draft',         labelKey: 'agenda.workflow_draft' },
  { key: 'with_chairman', labelKey: 'agenda.workflow_with_chairman' },
  { key: 'circulated',    labelKey: 'agenda.workflow_circulated' },
]

function AgendaWorkflowBar({
  status, isCompleted, isSecretary, isChairperson, busy, onSubmit, onApprove, onAdopt, agendaAdopted,
  canSeeCirculationStatus, circulationStatus, circulationStatusOpen, onToggleCirculationStatus,
}) {
  const { t } = useTranslation()
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
                             'text-slate-500 dark:text-slate-400'}`}
                >
                  {t(step.labelKey)}
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
          {status === 'draft' && isSecretary && (
            <button
              onClick={onSubmit}
              disabled={busy}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              <Send size={14} /> {t('agenda.workflow_submit_to_chairman')}
            </button>
          )}
          {status === 'with_chairman' && isChairperson && (
            <button
              onClick={onApprove}
              disabled={busy}
              title={t('agenda.workflow_endorse_circulate_hint')}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              <ThumbsUp size={14} /> {t('agenda.workflow_endorse_circulate')}
            </button>
          )}
          {status === 'circulated' && !agendaAdopted && (
            <>
              <span className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                <Check size={14} /> {t('agenda.workflow_circulated_message')}
              </span>
              {isChairperson && (
                <button
                  onClick={onAdopt}
                  disabled={busy}
                  className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
                  title={t('agenda.workflow_adopt_hint')}
                >
                  <ThumbsUp size={14} /> {t('agenda.workflow_adopt')}
                </button>
              )}
            </>
          )}
          {status === 'circulated' && agendaAdopted && (
            <span className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              <Check size={14} /> {t('agenda.workflow_adopted_message')}
            </span>
          )}
        </div>
      )}

      {status === 'circulated' && canSeeCirculationStatus && (
        <CirculationStatusPanel
          status={circulationStatus}
          open={circulationStatusOpen}
          onToggle={onToggleCirculationStatus}
        />
      )}
    </div>
  )
}

function CirculationStatusPanel({ status, open, onToggle }) {
  const { t } = useTranslation()
  if (!status) {
    return (
      <p className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400">
        {t('agenda.workflow_loading_status')}
      </p>
    )
  }
  const { recipients, notified_count: notifiedCount, viewed_count: viewedCount } = status
  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400"
      >
        <Eye size={13} />
        {t('agenda.workflow_opened_count', { viewed: viewedCount, notified: notifiedCount })}
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {recipients.map(r => (
            <li key={r.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-slate-800/60">
              <span className="text-slate-700 dark:text-slate-300">{r.name}</span>
              {r.viewed_at ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Eye size={12} /> {t('agenda.workflow_viewed')}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-400">
                  <Mail size={12} /> {t('agenda.workflow_notified_not_viewed')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AgendaSection({ label, isNumbered, id }) {
  return (
    <div
      id={id}
      style={id ? { scrollMarginTop: 'var(--agenda-scroll-offset, 9rem)' } : undefined}
      className={`px-8 py-2 ${isNumbered ? 'pt-3' : 'pt-4'} border-t border-slate-200 dark:border-slate-700 print:border-slate-400 bg-slate-50 dark:bg-slate-800/40 print:bg-transparent`}
    >
      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 print:text-black">
        {label}
      </p>
    </div>
  )
}

function MattersArisingRow({ item, isCompleted, canDefer, onRemove, onMoveUp, onMoveDown, onPushToNext, isFirst, isLastInCat }) {
  const { t } = useTranslation()
  return (
    <div className="px-8 py-1.5 flex items-start gap-4 group">
      <span className="text-sm font-medium text-slate-400 print:text-black shrink-0 w-8 text-right">•</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 dark:text-slate-200 print:text-black">
          <span className="font-medium mr-2">{item.subLetter}.</span>
          {item.matters_arising_agenda_no && (
            <span className="font-semibold">{item.matters_arising_agenda_no}: </span>
          )}
          <Link
            to={`/submissions/${item.submission}`}
            className="hover:underline hover:text-primary-600 dark:hover:text-primary-400 print:no-underline print:text-black"
            title={t('agenda.doc_open_submission')}
          >
            {item.submission_title}
          </Link>
          {item.submission_ministry && (
            <span className="text-slate-500 dark:text-slate-400"> — {item.submission_ministry}</span>
          )}
        </p>
      </div>
      {/* Screen-only controls */}
      {!isCompleted && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden shrink-0">
          <button onClick={onMoveUp}   disabled={isFirst}     className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-20"><ChevronUp   size={13} /></button>
          <button onClick={onMoveDown} disabled={isLastInCat} className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-20"><ChevronDown size={13} /></button>
          {canDefer && (
            <button onClick={onPushToNext} title={t('agenda.doc_defer_to_next')} className="p-1 rounded text-slate-400 hover:text-amber-500">
              <ChevronsRight size={13} />
            </button>
          )}
          <button onClick={() => onRemove(item.id)} className="p-1 rounded text-slate-400 hover:text-red-500"><X size={13} /></button>
        </div>
      )}
    </div>
  )
}

function StandardRow({ item, isCompleted, canDefer, categories, editingItem, setEditingItem, onRemove, onCategoryUpdate, onMoveUp, onMoveDown, onPushToNext, isFirst, isLastInCat }) {
  const { t } = useTranslation()
  const isEditing = editingItem === item.id
  const [pendingCat, setPendingCat] = useState(item.category)

  return (
    <div className="px-8 py-2.5 border-t border-slate-100 dark:border-slate-800 print:border-slate-300 flex items-start gap-4 group">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 print:text-black shrink-0 w-8">
        {item.agendaNo}.
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 dark:text-slate-200 print:text-black leading-snug">
          <Link
            to={`/submissions/${item.submission}`}
            className="hover:underline hover:text-primary-600 dark:hover:text-primary-400 print:no-underline print:text-black"
            title={t('agenda.doc_open_submission')}
          >
            {item.submission_title}
          </Link>
          {item.submission_ministry && (
            <span className="text-slate-500 dark:text-slate-400"> — {item.submission_ministry}</span>
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
            statusLabel={t('agenda.doc_generating_summary')}
          />
        )}
        {item.agenda_blurb && (
          <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1 print:hidden">{t('agenda.doc_draft_verify')}</p>
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
              {categories.map(c => (
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
            title={t('agenda.doc_change_category')}
          >
            <Tag size={12} />
          </button>
          {canDefer && (
            <button
              onClick={onPushToNext}
              title={t('agenda.doc_defer_to_next')}
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

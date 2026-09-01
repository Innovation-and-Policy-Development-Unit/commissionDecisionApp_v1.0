import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, X, Tablet } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'
import { normalizeListPayload } from '../../utils/listPayload'
import { useAuth } from '../../context/AuthContext'
import { buildSittingPackRows } from '../../utils/agendaGrouping'
import { useAgendaSections } from '../../hooks/useAgendaSections'
import DigitalSealOverlay from '../../components/sitting-pack/DigitalSealOverlay'
import ExecutiveBriefPanel from '../../components/sitting-pack/ExecutiveBriefPanel'
import SittingPackPapersPanel from '../../components/sitting-pack/SittingPackPapersPanel'
import MeetingHistoryPanel from '../../components/sitting-pack/MeetingHistoryPanel'
import PrivateNotePanel from '../../components/submissions/PrivateNotePanel'
import AiTextSkeleton from '../../components/shared/AiTextSkeleton'
import BaseButton from '../../components/shared/BaseButton'
import BaseBadge from '../../components/shared/BaseBadge'
import { userIsOpscInternal, userCanRegenerateAiBrief } from '../../utils/opscAccess'

const HEARTBEAT_MS = 60_000

function formatMeetingHeader(meeting) {
  if (!meeting) return ''
  const d = new Date(`${meeting.date}T00:00`)
  const dateStr = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return `${meeting.reference_number} · ${dateStr}`
}

export default function AgendaSittingPack() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const meetingId = searchParams.get('meeting')
  const { user } = useAuth()

  const [meeting, setMeeting] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [sessionError, setSessionError] = useState(null)
  const [rightTab, setRightTab] = useState('papers')
  const [upcomingMeetings, setUpcomingMeetings] = useState(null)

  const canViewBrief = userIsOpscInternal(user)
  const canRegenerateBrief = userCanRegenerateAiBrief(user)
  // Matches the backend's my-note permission check (SubmissionViewSet.my_note).
  const canUseNotes = user && ['psc_commissioner', 'chairperson', 'psc_admin'].includes(user.role)

  const { categoryOrder, allSections } = useAgendaSections()
  const rows = useMemo(() => buildSittingPackRows(items, categoryOrder, allSections), [items, categoryOrder, allSections])
  const selectedRow = useMemo(() => rows.find((r) => r.type === 'item' && r.id === selectedItemId), [rows, selectedItemId])
  const selectedSubmissionId = selectedRow?.item?.submission ?? null
  const selectedLabel = selectedRow?.item
    ? `${selectedRow.displayNo}. ${selectedRow.item.submission_reference} — ${selectedRow.item.submission_title}`
    : ''

  const loadData = useCallback(async () => {
    if (!meetingId) return
    setLoading(true)
    try {
      const [mRes, iRes] = await Promise.all([
        api.get(`/meetings/${meetingId}/`),
        api.get(`/agenda-items/?meeting=${meetingId}`),
      ])
      setMeeting(mRes.data)
      const list = normalizeListPayload(iRes.data)
      setItems(list)
      const firstItem = buildSittingPackRows(list).find((r) => r.type === 'item')
      if (firstItem) setSelectedItemId(firstItem.id)
    } catch {
      setMeeting(null); setItems([])
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  const startSession = useCallback(async () => {
    if (!meetingId) return
    setSessionError(null)
    try {
      const res = await api.post(`/meetings/${meetingId}/sitting-pack/start/`)
      setSession({ ...res.data, active: true })
    } catch (err) {
      setSessionError(err.response?.data?.detail || t('sitting_pack.session_failed'))
      setSession(null)
    }
  }, [meetingId, t])

  const endSession = useCallback(async () => {
    if (!meetingId) return
    try { await api.post(`/meetings/${meetingId}/sitting-pack/end/`) } catch { /* best effort */ }
    setSession((s) => (s ? { ...s, active: false } : null))
  }, [meetingId])

  const heartbeat = useCallback(async () => {
    if (!meetingId || !session?.session_id) return
    try {
      const res = await api.post(`/meetings/${meetingId}/sitting-pack/heartbeat/`, { session_id: session.session_id })
      setSession({ ...res.data, active: res.data.active !== false })
    } catch {
      setSession((s) => (s ? { ...s, active: false } : null))
    }
  }, [meetingId, session?.session_id])

  useEffect(() => { loadData() }, [loadData])

  const hasPendingBlurbs = items.some((i) => !i.agenda_blurb_processed)
  useEffect(() => {
    if (!meetingId || !hasPendingBlurbs) return undefined
    const id = setInterval(() => {
      api.get(`/agenda-items/?meeting=${meetingId}`).then((r) => setItems(normalizeListPayload(r.data))).catch(() => {})
    }, 5000)
    return () => clearInterval(id)
  }, [meetingId, hasPendingBlurbs])

  useEffect(() => {
    if (!meetingId) return undefined
    startSession()
    return () => { api.post(`/meetings/${meetingId}/sitting-pack/end/`).catch(() => {}) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per meeting
  }, [meetingId])

  useEffect(() => {
    if (!session?.active) return undefined
    const id = setInterval(heartbeat, HEARTBEAT_MS)
    return () => clearInterval(id)
  }, [session?.active, heartbeat])

  const handleExit = async () => {
    await endSession()
    navigate(`/secretariat/agenda${meetingId ? `?meeting=${meetingId}` : ''}`)
  }

  const rootCls = 'fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden'

  // No meeting selected: a tap-friendly picker of recent and upcoming
  // sittings, so commissioners never need the agenda-builder page.
  useEffect(() => {
    if (meetingId) return undefined
    let cancelled = false
    api.get('/meetings/', { params: { ordering: '-date' } })
      .then((r) => {
        if (cancelled) return
        const list = normalizeListPayload(r.data)
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 14)
        setUpcomingMeetings(
          list
            .filter((m) => m.status !== 'cancelled' && new Date(`${m.date}T00:00`) >= cutoff)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 12),
        )
      })
      .catch(() => { if (!cancelled) setUpcomingMeetings([]) })
    return () => { cancelled = true }
  }, [meetingId])

  if (!meetingId) {
    return (
      <div className={rootCls}>
        <header className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <Tablet size={20} className="text-primary-500" />
          <span className="font-semibold text-slate-800 dark:text-slate-100">{t('sitting_pack.title')}</span>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl mx-auto">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">{t('sitting_pack.choose_meeting')}</h2>
            <p className="text-sm text-slate-500 mb-5">{t('sitting_pack.choose_meeting_hint')}</p>
            {upcomingMeetings === null ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
                ))}
              </div>
            ) : upcomingMeetings.length === 0 ? (
              <p className="text-slate-500">{t('sitting_pack.no_upcoming')}</p>
            ) : (
              <div className="space-y-3">
                {upcomingMeetings.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => navigate(`/secretariat/agenda/sitting-pack?meeting=${m.id}`)}
                    className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-4 hover:border-primary-400 hover:shadow transition-all"
                  >
                    <span className="font-semibold block text-slate-800 dark:text-slate-100">{m.reference_number} — {m.title}</span>
                    <span className="text-sm text-slate-500">{formatMeetingHeader(m)}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-6 text-center">
              <BaseButton variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => navigate('/')}>{t('sitting_pack.exit')}</BaseButton>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={rootCls}>
      <DigitalSealOverlay session={session} />

      <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <Tablet size={20} className="text-primary-500" />
          <div className="min-w-0">
            <span className="font-semibold block truncate text-slate-800 dark:text-slate-100">{t('sitting_pack.title')}</span>
            <span className="text-sm block truncate text-slate-500">{formatMeetingHeader(meeting)}</span>
          </div>
          {session?.active && <BaseBadge color="success" size="small">{t('sitting_pack.session_active')} · {session.seal_code}</BaseBadge>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sessionError && <span className="text-sm text-red-600 max-w-[200px] truncate" title={sessionError}>{sessionError}</span>}
          <BaseButton variant="ghost" icon={<ArrowLeft size={16} />} onClick={handleExit}>{t('sitting_pack.exit')}</BaseButton>
          <BaseButton variant="ghost" size="icon" iconOnly icon={<X size={16} />} onClick={handleExit} aria-label={t('sitting_pack.exit')} />
        </div>
      </header>

      <div className="flex-1 grid gap-3 p-3 min-h-0 relative sitting-pack-split-stack" style={{ gridTemplateColumns: 'minmax(280px, 38%) 1fr' }}>
        <div className="min-h-0 overflow-hidden flex flex-col">
          <div className="card h-full flex flex-col overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="font-semibold block text-slate-800 dark:text-slate-100">{t('sitting_pack.agenda_panel')}</span>
              <span className="text-sm block text-slate-500">{t('sitting_pack.agenda_hint')}</span>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="h-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" style={{ width: `${90 - i * 5}%` }} />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <p className="p-6 text-center text-slate-500">{t('sitting_pack.no_items')}</p>
              ) : (
                rows.map((row) => {
                  if (row.type === 'heading') {
                    return (
                      <div key={row.id} className="px-4 py-2 mt-2 first:mt-0 sticky top-0 z-[1] bg-slate-100 dark:bg-slate-800">
                        <span className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{row.label}</span>
                      </div>
                    )
                  }
                  if (row.type === 'subheading') {
                    return (
                      <div key={row.id} className="px-4 pt-2 pb-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{row.label}</span>
                      </div>
                    )
                  }
                  const { item } = row
                  const selected = selectedItemId === row.id
                  const blurbPending = item.agenda_blurb_processed === false && !item.agenda_blurb
                  return (
                    <button
                      key={row.id}
                      type="button"
                      className={clsx(
                        'w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-800 transition-colors',
                        selected ? 'bg-primary-50 dark:bg-primary-900/30 border-l-[3px] border-l-primary-500' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50',
                      )}
                      onClick={() => setSelectedItemId(row.id)}
                    >
                      <div className="flex gap-2">
                        <span className="font-semibold shrink-0 w-8 text-slate-800 dark:text-slate-100">{row.displayNo}.</span>
                        <div className="min-w-0 flex-1">
                          <span className={clsx('block truncate text-slate-800 dark:text-slate-100', selected ? 'font-semibold' : 'font-normal')}>{item.submission_reference}</span>
                          <span className="text-sm block line-clamp-2 text-slate-600 dark:text-slate-300">{item.submission_title}</span>
                          {item.agenda_blurb ? (
                            <span className="text-[10px] block mt-1 line-clamp-2 opacity-80 text-slate-500">{item.agenda_blurb}</span>
                          ) : blurbPending ? (
                            <div className="mt-2"><AiTextSkeleton lines={2} statusLabel="" /></div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 overflow-hidden flex flex-col">
          <div className="shrink-0 flex gap-1 mb-2">
            {[
              { key: 'papers', label: t('sitting_pack.papers_tab') },
              ...(canViewBrief ? [{ key: 'brief', label: t('sitting_pack.brief_tab') }] : []),
              ...(canUseNotes ? [{ key: 'notes', label: t('sitting_pack.notes_tab') }] : []),
              { key: 'history', label: t('sitting_pack.history_tab') },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setRightTab(tab.key)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                  rightTab === tab.key
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {rightTab === 'papers' ? (
              <SittingPackPapersPanel submissionId={selectedSubmissionId} itemLabel={selectedLabel} />
            ) : rightTab === 'notes' && canUseNotes ? (
              selectedSubmissionId && <PrivateNotePanel submissionId={selectedSubmissionId} />
            ) : rightTab === 'brief' && canViewBrief ? (
              <ExecutiveBriefPanel submissionId={selectedSubmissionId} itemLabel={selectedLabel} canRegenerate={canRegenerateBrief} />
            ) : rightTab === 'history' ? (
              <MeetingHistoryPanel submissionId={selectedSubmissionId} itemLabel={selectedLabel} excludeMeetingId={meetingId} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

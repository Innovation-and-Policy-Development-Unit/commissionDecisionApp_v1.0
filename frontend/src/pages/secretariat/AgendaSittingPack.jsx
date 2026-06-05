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
import AiTextSkeleton from '../../components/shared/AiTextSkeleton'
import BaseButton from '../../components/shared/BaseButton'
import BaseBadge from '../../components/shared/BaseBadge'

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

  const role = user?.role || ''
  const canRegenerateBrief = ['psc_secretary', 'senior_admin_officer', 'psc_admin', 'psc_manager'].includes(role)

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

  if (!meetingId) {
    return (
      <div className={rootCls}>
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8">
          <span className="text-slate-600 dark:text-slate-300">{t('sitting_pack.no_meeting')}</span>
          <BaseButton variant="primary" onClick={() => navigate('/secretariat/agenda')}>{t('sitting_pack.back_agenda')}</BaseButton>
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
          <ExecutiveBriefPanel submissionId={selectedSubmissionId} itemLabel={selectedLabel} canRegenerate={canRegenerateBrief} />
        </div>
      </div>
    </div>
  )
}

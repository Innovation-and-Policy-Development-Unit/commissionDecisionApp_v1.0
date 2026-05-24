import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Card,
  Text,
  Badge,
  Skeleton,
  SkeletonItem,
  tokens,
  makeStyles,
} from '@fluentui/react-components'
import {
  ArrowLeftRegular,
  DismissRegular,
  TabletRegular,
} from '@fluentui/react-icons'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { buildSittingPackRows } from '../../utils/agendaGrouping'
import DigitalSealOverlay from '../../components/sitting-pack/DigitalSealOverlay'
import ExecutiveBriefPanel from '../../components/sitting-pack/ExecutiveBriefPanel'
import AiTextSkeleton from '../../components/shared/AiTextSkeleton'

const HEARTBEAT_MS = 60_000

const useStyles = makeStyles({
  root: {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground2,
    overflow: 'hidden',
  },
  toolbar: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 16px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  split: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 38%) 1fr',
    gap: '12px',
    padding: '12px',
    minHeight: 0,
    position: 'relative',
  },
  agendaPane: {
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  agendaScroll: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
  },
  briefPane: {
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  agendaItem: {
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  agendaItemSelected: {
    backgroundColor: tokens.colorBrandBackground2,
    borderLeftWidth: '3px',
    borderLeftStyle: 'solid',
    borderLeftColor: tokens.colorBrandStroke1,
  },
})

function formatMeetingHeader(meeting) {
  if (!meeting) return ''
  const d = new Date(`${meeting.date}T00:00`)
  const dateStr = d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return `${meeting.reference_number} · ${dateStr}`
}

export default function AgendaSittingPack() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const meetingId = searchParams.get('meeting')
  const { user } = useAuth()
  const styles = useStyles()

  const [meeting, setMeeting] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [sessionError, setSessionError] = useState(null)

  const role = user?.role || ''
  const canRegenerateBrief = [
    'psc_secretary',
    'senior_admin_officer',
    'psc_admin',
    'psc_manager',
  ].includes(role)

  const rows = useMemo(() => buildSittingPackRows(items), [items])

  const selectedRow = useMemo(
    () => rows.find((r) => r.type === 'item' && r.id === selectedItemId),
    [rows, selectedItemId],
  )

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
      const list = iRes.data.results ?? iRes.data
      setItems(list)
      const firstItem = buildSittingPackRows(list).find((r) => r.type === 'item')
      if (firstItem) setSelectedItemId(firstItem.id)
    } catch {
      setMeeting(null)
      setItems([])
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
    try {
      await api.post(`/meetings/${meetingId}/sitting-pack/end/`)
    } catch {
      /* best effort */
    }
    setSession((s) => (s ? { ...s, active: false } : null))
  }, [meetingId])

  const heartbeat = useCallback(async () => {
    if (!meetingId || !session?.session_id) return
    try {
      const res = await api.post(`/meetings/${meetingId}/sitting-pack/heartbeat/`, {
        session_id: session.session_id,
      })
      setSession({ ...res.data, active: res.data.active !== false })
    } catch {
      setSession((s) => (s ? { ...s, active: false } : null))
    }
  }, [meetingId, session?.session_id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const hasPendingBlurbs = items.some((i) => !i.agenda_blurb_processed)

  useEffect(() => {
    if (!meetingId || !hasPendingBlurbs) return undefined
    const t = setInterval(() => {
      api.get(`/agenda-items/?meeting=${meetingId}`).then((r) => {
        setItems(r.data.results ?? r.data)
      }).catch(() => {})
    }, 5000)
    return () => clearInterval(t)
  }, [meetingId, hasPendingBlurbs])

  useEffect(() => {
    if (!meetingId) return undefined
    startSession()
    return () => {
      api.post(`/meetings/${meetingId}/sitting-pack/end/`).catch(() => {})
    }
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

  if (!meetingId) {
    return (
      <div className={styles.root}>
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8">
          <Text>{t('sitting_pack.no_meeting')}</Text>
          <Button as={Link} to="/secretariat/agenda" appearance="primary">
            {t('sitting_pack.back_agenda')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <DigitalSealOverlay session={session} />

      <header className={styles.toolbar}>
        <div className="flex items-center gap-3 min-w-0">
          <TabletRegular style={{ color: tokens.colorBrandForeground1 }} />
          <div className="min-w-0">
            <Text weight="semibold" block truncate>
              {t('sitting_pack.title')}
            </Text>
            <Text size={200} truncate>
              {formatMeetingHeader(meeting)}
            </Text>
          </div>
          {session?.active && (
            <Badge appearance="filled" color="success" size="small">
              {t('sitting_pack.session_active')} · {session.seal_code}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sessionError && (
            <Text size={200} className="text-red-600 max-w-[200px] truncate" title={sessionError}>
              {sessionError}
            </Text>
          )}
          <Button
            appearance="subtle"
            icon={<ArrowLeftRegular />}
            onClick={handleExit}
          >
            {t('sitting_pack.exit')}
          </Button>
          <Button
            appearance="subtle"
            icon={<DismissRegular />}
            onClick={handleExit}
            aria-label={t('sitting_pack.exit')}
          />
        </div>
      </header>

      <div className={`${styles.split} sitting-pack-split-stack`}>
        <div className={styles.agendaPane}>
          <Card className="h-full flex flex-col overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-neutral-200 dark:border-neutral-700">
              <Text weight="semibold">{t('sitting_pack.agenda_panel')}</Text>
              <Text size={200} block>
                {t('sitting_pack.agenda_hint')}
              </Text>
            </div>
            <div className={styles.agendaScroll}>
              {loading ? (
                <div className="p-4 space-y-3">
                  <Skeleton>
                    {Array.from({ length: 8 }, (_, i) => (
                      <SkeletonItem key={i} size={16} style={{ width: `${90 - i * 5}%` }} />
                    ))}
                  </Skeleton>
                </div>
              ) : rows.length === 0 ? (
                <Text className="p-6 text-center">{t('sitting_pack.no_items')}</Text>
              ) : (
                rows.map((row) => {
                  if (row.type === 'heading') {
                    return (
                      <div
                        key={row.id}
                        className="px-4 py-2 mt-2 first:mt-0 sticky top-0 z-[1]"
                        style={{ backgroundColor: tokens.colorNeutralBackground3 }}
                      >
                        <Text size={200} weight="semibold" className="uppercase tracking-wide">
                          {row.label}
                        </Text>
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
                      className={`w-full text-left px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 ${styles.agendaItem} ${selected ? styles.agendaItemSelected : ''}`}
                      onClick={() => setSelectedItemId(row.id)}
                    >
                      <div className="flex gap-2">
                        <Text weight="semibold" className="shrink-0 w-8">
                          {row.displayNo}.
                        </Text>
                        <div className="min-w-0 flex-1">
                          <Text weight={selected ? 'semibold' : 'regular'} block truncate>
                            {item.submission_reference}
                          </Text>
                          <Text size={200} block className="line-clamp-2">
                            {item.submission_title}
                          </Text>
                          {item.agenda_blurb ? (
                            <Text size={100} block className="mt-1 line-clamp-2 opacity-80">
                              {item.agenda_blurb}
                            </Text>
                          ) : blurbPending ? (
                            <div className="mt-2">
                              <AiTextSkeleton lines={2} statusLabel="" />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </Card>
        </div>

        <div className={styles.briefPane}>
          <ExecutiveBriefPanel
            submissionId={selectedSubmissionId}
            itemLabel={selectedLabel}
            canRegenerate={canRegenerateBrief}
          />
        </div>
      </div>
    </div>
  )
}

import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { GripVertical, AlertCircle } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useToast } from '../../context/ToastContext'
import { stageLabel, stageBadgeClass } from '../../constants/stages'
import { SUBWAY_STATIONS } from '../../constants/subwayStations'
import { QualityScoreBadge } from './SubmissionQualityScore'
import SubmissionKanbanTransitionDialog from './SubmissionKanbanTransitionDialog'
import {
  KANBAN_TRANSITION_ROLES,
  allowedStagesForStation,
  pickDefaultTargetStage,
  stationIdForStage,
} from '../../utils/kanbanTransitions'

function KanbanCard({ submission, draggable, onDragStart, onDragEnd, showQuality }) {
  const { t } = useTranslation()
  const stage = submission.current_stage

  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={clsx(
        'rounded-lg border bg-white dark:bg-slate-800 shadow-sm p-3 space-y-2',
        'border-slate-200 dark:border-slate-600',
        draggable && 'cursor-grab active:cursor-grabbing hover:border-primary-300 dark:hover:border-primary-600',
      )}
    >
      <div className="flex items-start gap-2">
        {draggable && (
          <GripVertical
            size={14}
            className="shrink-0 mt-0.5 text-slate-300 dark:text-slate-500"
            aria-hidden
          />
        )}
        <div className="min-w-0 flex-1">
          <Link
            to={`/submissions/${submission.id}`}
            className="font-mono text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {submission.reference_number}
          </Link>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2 mt-0.5">
            {submission.title}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {[submission.category_name, submission.ministry_name].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        {showQuality && (
          <QualityScoreBadge submission={submission} compact />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={clsx(
            'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold',
            stageBadgeClass(stage),
          )}
        >
          {stageLabel(stage, t)}
        </span>
        {submission.is_assessment_overdue && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
            <AlertCircle size={11} />
            {t('submission.overdue')}
          </span>
        )}
      </div>
    </article>
  )
}

export default function SubmissionKanbanBoard({
  submissions,
  showQualityColumn,
  onRefresh,
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const canDrag = user && KANBAN_TRANSITION_ROLES.includes(user.role)

  const [draggingId, setDraggingId] = useState(null)
  const [dropTargetStation, setDropTargetStation] = useState(null)
  const [pending, setPending] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogBusy, setDialogBusy] = useState(false)
  const [dialogError, setDialogError] = useState('')

  const columns = useMemo(() => {
    return SUBWAY_STATIONS.map((station) => {
      const cards = submissions.filter(
        (s) => stationIdForStage(s.current_stage) === station.id,
      )
      return { station, cards }
    })
  }, [submissions])

  const openTransitionDialog = useCallback(async (submission, targetStationId) => {
    setDialogError('')
    try {
      const res = await api.get(`/submissions/${submission.id}/allowed_transitions/`)
      const allowed = res.data.allowed || []
      const inColumn = allowedStagesForStation(allowed, targetStationId)

      if (!inColumn.length) {
        const stationLabel = t(`subway.${targetStationId}`, {
          defaultValue: targetStationId,
        })
        toast.error(
          t('submission.kanban.no_transition', { station: stationLabel }),
        )
        return
      }

      const defaultTarget = pickDefaultTargetStage(inColumn, targetStationId)
      setPending({
        submission,
        targetStationId,
        stageOptions: inColumn,
        defaultTarget,
      })
      setDialogOpen(true)
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        t('submission.kanban.load_transitions_failed')
      toast.error(String(msg))
    }
  }, [t, toast])

  const handleDrop = useCallback(
    (targetStationId) => {
      if (!draggingId || !canDrag) return

      const submission = submissions.find((s) => s.id === draggingId)
      setDraggingId(null)
      setDropTargetStation(null)

      if (!submission) return

      const fromStation = stationIdForStage(submission.current_stage)
      if (fromStation === targetStationId) return

      openTransitionDialog(submission, targetStationId)
    },
    [draggingId, canDrag, submissions, openTransitionDialog],
  )

  const runTransition = async ({ targetStage, remarks }, acknowledgeGaps = false) => {
    if (!pending) return
    await api.post(`/submissions/${pending.submission.id}/transition/`, {
      new_stage: targetStage,
      remarks,
      acknowledge_gaps: acknowledgeGaps,
    })
  }

  const handleConfirmTransition = async ({ targetStage, remarks }) => {
    if (!pending) return
    setDialogBusy(true)
    setDialogError('')
    try {
      await runTransition({ targetStage, remarks }, false)
      setDialogOpen(false)
      setPending(null)
      toast.success(t('submission.kanban.success'))
      await onRefresh?.()
    } catch (err) {
      const data = err.response?.data
      const gaps = data?.package_gaps
      if (
        targetStage === 'submitted'
        && Array.isArray(gaps)
        && gaps.some((g) => g.severity === 'critical')
      ) {
        const proceed = await confirm({
          title: t('submission.kanban.gaps_title'),
          message: data.detail || t('submission.kanban.gaps_message'),
          confirmLabel: t('submission.kanban.gaps_confirm'),
        })
        if (proceed) {
          try {
            await runTransition({ targetStage, remarks }, true)
            setDialogOpen(false)
            setPending(null)
            toast.success(t('submission.kanban.success'))
            await onRefresh?.()
            return
          } catch (err2) {
            const msg2 =
              err2.response?.data?.detail || t('submission.kanban.failed')
            setDialogError(String(msg2))
            return
          }
        }
        setDialogError(data.detail || t('submission.kanban.gaps_blocked'))
        return
      }
      const msg =
        data?.detail ||
        (typeof data === 'object' ? JSON.stringify(data) : null) ||
        t('submission.kanban.failed')
      setDialogError(String(msg))
    } finally {
      setDialogBusy(false)
    }
  }

  return (
    <>
      {!canDrag && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          {t('submission.kanban.read_only')}
        </p>
      )}

      <div
        className="flex gap-3 overflow-x-auto pb-2 min-h-[420px]"
        role="region"
        aria-label={t('submission.kanban.aria_board')}
      >
        {columns.map(({ station, cards }) => {
          const label = t(`subway.${station.id}`, { defaultValue: station.label })
          const isDropTarget = dropTargetStation === station.id

          return (
            <div
              key={station.id}
              className={clsx(
                'flex-shrink-0 w-[min(100%,280px)] flex flex-col rounded-xl border',
                'bg-slate-50/80 dark:bg-slate-900/40',
                isDropTarget
                  ? 'border-primary-400 ring-2 ring-primary-200 dark:ring-primary-800'
                  : 'border-slate-200 dark:border-slate-700',
              )}
              onDragOver={(e) => {
                if (!canDrag) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDropTargetStation(station.id)
              }}
              onDragLeave={() => {
                setDropTargetStation((prev) => (prev === station.id ? null : prev))
              }}
              onDrop={(e) => {
                e.preventDefault()
                handleDrop(station.id)
              }}
            >
              <header className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {label}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('submission.kanban.card_count', {
                    count: cards.length,
                    defaultValue: `${cards.length} submission${cards.length === 1 ? '' : 's'}`,
                  })}
                </p>
              </header>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)] min-h-[120px]">
                {cards.length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6 px-2">
                    {t('submission.kanban.empty_column')}
                  </p>
                )}
                {cards.map((submission) => (
                  <KanbanCard
                    key={submission.id}
                    submission={submission}
                    draggable={canDrag}
                    showQuality={showQualityColumn}
                    onDragStart={(e) => {
                      setDraggingId(submission.id)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData(
                        'text/plain',
                        String(submission.id),
                      )
                    }}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setDropTargetStation(null)
                    }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <SubmissionKanbanTransitionDialog
        open={dialogOpen}
        onClose={() => {
          if (!dialogBusy) {
            setDialogOpen(false)
            setPending(null)
            setDialogError('')
          }
        }}
        submission={pending?.submission}
        targetStage={pending?.defaultTarget}
        stageOptions={pending?.stageOptions || []}
        onConfirm={handleConfirmTransition}
        busy={dialogBusy}
        error={dialogError}
      />
    </>
  )
}

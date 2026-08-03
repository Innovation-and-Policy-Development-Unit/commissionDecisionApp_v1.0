import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, ExternalLink, FolderOpen, Loader2 } from 'lucide-react'
import ExecutiveBriefPanel from '../sitting-pack/ExecutiveBriefPanel'
import SittingPackPapersPanel from '../sitting-pack/SittingPackPapersPanel'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { userIsOpscInternal, userCanRegenerateAiBrief } from '../../utils/opscAccess'

const humanizeStage = (stage) =>
  (stage || '').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/**
 * Right-hand context pane for the minute-intake split view: the AI executive
 * brief for the focused agenda item's submission, then a single collapsed
 * accordion holding the submission details and its filed attachments.
 */
export default function SubmissionContextPanel({ submissionId, itemLabel }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const canViewBrief = userIsOpscInternal(user)
  const canRegenerateBrief = userCanRegenerateAiBrief(user)
  const [accordionOpen, setAccordionOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(false)

  // Switching agenda items resets the pane to its collapsed default.
  useEffect(() => {
    setAccordionOpen(false)
    setDetail(null)
    setDetailError(false)
  }, [submissionId])

  // Submission details are fetched lazily, only when the accordion opens.
  useEffect(() => {
    if (!accordionOpen || !submissionId || detail) return undefined
    let cancelled = false
    setDetailLoading(true)
    api.get(`/submissions/${submissionId}/`)
      .then(r => { if (!cancelled) setDetail(r.data) })
      .catch(() => { if (!cancelled) setDetailError(true) })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [accordionOpen, submissionId, detail])

  if (!submissionId) {
    return (
      <div className="card p-6 text-center text-sm text-slate-500">
        {t('minute_intake.context_no_submission')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {canViewBrief && (
        <div className="h-[320px]">
          <ExecutiveBriefPanel submissionId={submissionId} itemLabel={itemLabel} canRegenerate={canRegenerateBrief} />
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setAccordionOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <FolderOpen size={15} className="text-primary-500" />
            {t('minute_intake.context_accordion')}
          </span>
          {accordionOpen
            ? <ChevronDown size={14} className="text-slate-400" />
            : <ChevronRight size={14} className="text-slate-400" />}
        </button>

        {accordionOpen && (
          <div className="border-t border-slate-100 dark:border-slate-700">
            <div className="p-4">
              {detailLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={18} className="animate-spin text-slate-400" />
                </div>
              ) : detailError ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t('minute_intake.context_details_failed')}
                </p>
              ) : detail ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    <span className="font-mono text-xs text-slate-500 mr-2">{detail.reference_number}</span>
                    {detail.title}
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {t('minute_intake.context_ministry')}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">{detail.ministry?.name || '—'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {t('minute_intake.context_stage')}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">{humanizeStage(detail.current_stage)}</span>
                    </div>
                  </div>
                  <Link
                    to={`/submissions/${submissionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400"
                  >
                    <ExternalLink size={12} />
                    {t('minute_intake.context_open_full')}
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="h-[420px] border-t border-slate-100 dark:border-slate-700">
              <SittingPackPapersPanel submissionId={submissionId} itemLabel={itemLabel} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

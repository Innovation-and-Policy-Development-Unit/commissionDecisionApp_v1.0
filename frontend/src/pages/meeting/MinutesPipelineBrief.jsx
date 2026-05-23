import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Copy, CheckCircle2, FileText, Mic, Brain, AlertCircle, Loader2,
} from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import api from '../../api/client'

const EXAMPLE_ROWS = [
  { key: 'spoken', labelKey: 'meeting_room.pipeline_col_spoken' },
  { key: 'zoom', labelKey: 'meeting_room.pipeline_col_zoom' },
  { key: 'final', labelKey: 'meeting_room.pipeline_col_final' },
]

export default function MinutesPipelineBrief() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const meetingId = searchParams.get('meetingId')
  const [meeting, setMeeting] = useState(null)
  const [loading, setLoading] = useState(!!meetingId)
  const [copied, setCopied] = useState(false)
  const [prompt, setPrompt] = useState('')

  const loadMeeting = useCallback(async () => {
    if (!meetingId) return
    setLoading(true)
    try {
      const [mRes, pRes] = await Promise.all([
        api.get(`/meetings/${meetingId}/`),
        api.get(`/meetings/${meetingId}/claude-prompt/`),
      ])
      setMeeting(mRes.data)
      setPrompt(pRes.data.prompt || '')
    } catch {
      setMeeting(null)
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  useEffect(() => { loadMeeting() }, [loadMeeting])

  const copyPrompt = async () => {
    const text = prompt || t('meeting_room.pipeline_copy_no_meeting')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="print-friendly-brief">
      <div className="mb-4 no-print">
        <Link
          to="/secretariat/meeting-room"
          className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <ArrowLeft size={16} />
          {t('meeting_room.back_hub')}
        </Link>
      </div>

      <PageHeader
        title={t('meeting_room.pipeline_title')}
        subtitle={t('meeting_room.pipeline_subtitle')}
      />

      <div className="card p-6 mb-8">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3">
          {t('meeting_room.pipeline_why_title')}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
          {t('meeting_room.pipeline_why_claude')}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          {t('meeting_room.pipeline_why_zoom')}
        </p>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
          {t('meeting_room.pipeline_sequential_intro')}
        </p>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 font-mono text-xs text-slate-700 dark:text-slate-300 space-y-1">
          <p>{t('meeting_room.pipeline_flow_audio')}</p>
          <p className="text-slate-400 text-center">↓</p>
          <p>1. {t('meeting_room.pipeline_flow_zoom')}</p>
          <p className="text-slate-400 text-center">↓</p>
          <p>2. {t('meeting_room.pipeline_flow_copy')}</p>
          <p className="text-slate-400 text-center">↓</p>
          <p>3. {t('meeting_room.pipeline_flow_claude')}</p>
        </div>
      </div>

      {meetingId && (
        <div className="mb-6 card p-4 flex items-center justify-between gap-4 no-print">
          {loading ? (
            <Loader2 size={20} className="animate-spin text-slate-400" />
          ) : meeting ? (
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{meeting.title}</p>
              <p className="text-xs text-slate-500 font-mono">{meeting.reference_number} · {meeting.date}</p>
            </div>
          ) : (
            <p className="text-sm text-red-600">{t('meeting_room.pipeline_meeting_not_found')}</p>
          )}
          <button type="button" onClick={copyPrompt} className="btn-primary btn-sm shrink-0">
            {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
            {copied ? t('meeting_room.copied') : t('meeting_room.copy_prompt')}
          </button>
        </div>
      )}

      <div className="card p-6 mb-8 border-l-4 border-l-primary-500">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3">
          {t('meeting_room.pipeline_delegate_title')}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
          {t('meeting_room.pipeline_overlap_problem')}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
          {t('meeting_room.pipeline_delegate_solution')}
        </p>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {t('meeting_room.pipeline_delegate_result')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-5 border-l-4 border-l-indigo-500">
          <Mic size={22} className="text-indigo-500 mb-2" />
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1">
            {t('meeting_room.pipeline_zoom_title')}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">{t('meeting_room.pipeline_zoom_desc')}</p>
        </div>
        <div className="card p-5 border-l-4 border-l-purple-500">
          <Brain size={22} className="text-purple-500 mb-2" />
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1">
            {t('meeting_room.pipeline_claude_title')}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">{t('meeting_room.pipeline_claude_desc')}</p>
        </div>
        <div className="card p-5 border-l-4 border-l-emerald-500">
          <FileText size={22} className="text-emerald-500 mb-2" />
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1">
            {t('meeting_room.pipeline_record_title')}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">{t('meeting_room.pipeline_record_desc')}</p>
        </div>
      </div>

      <div className="card p-6 mb-8">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
          {t('meeting_room.pipeline_example_title')}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 pr-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-28" />
                <th className="text-left py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {t('meeting_room.pipeline_col_text')}
                </th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLE_ROWS.map(row => (
                <tr key={row.key} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="py-3 pr-4 font-bold text-slate-600 dark:text-slate-300 align-top">
                    {t(row.labelKey)}
                  </td>
                  <td className="py-3 text-slate-700 dark:text-slate-300 font-mono text-xs leading-relaxed">
                    {t(`meeting_room.pipeline_example_${row.key}`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-100 flex items-start gap-2 mb-6">
        <AlertCircle size={16} className="shrink-0 mt-0.5" />
        <span>{t('meeting_room.pipeline_warning')}</span>
      </div>

      <div className="card p-6 no-print">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
          {t('meeting_room.pipeline_workflow_title')}
        </h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <li>{t('meeting_room.pipeline_step_1')}</li>
          <li>{t('meeting_room.pipeline_step_2')}</li>
          <li>{t('meeting_room.pipeline_step_3')}</li>
          <li>{t('meeting_room.pipeline_step_4')}</li>
        </ol>
        {meetingId && (
          <Link
            to={`/secretariat/meetings/${meetingId}/minutes`}
            className="inline-flex mt-4 text-sm font-bold text-primary-600 hover:underline"
          >
            {t('meeting_room.open_minutes')}
          </Link>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-friendly-brief { padding: 0; }
          .print-friendly-brief .card { break-inside: avoid; box-shadow: none; border: 1px solid #ccc; }
        }
      `}</style>
    </div>
  )
}

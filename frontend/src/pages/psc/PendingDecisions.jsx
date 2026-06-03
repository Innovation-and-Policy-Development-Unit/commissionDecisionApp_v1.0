import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gavel, AlertCircle, Clock, ExternalLink, RefreshCw } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import { STAGE_LABELS, stageBadgeClass } from '../../constants/stages'
import { useAgendaSections } from '../../hooks/useAgendaSections'

const STAGE_ORDER = [
  'commission_sitting',
  'forwarded_to_commission',
  'matters_arising',
  'tabled',
  'awaiting_legal_advice',
  'awaiting_cabinet_decision',
]

const STAGE_COLORS = {
  commission_sitting:      'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  forwarded_to_commission: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  matters_arising:         'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  tabled:                  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  awaiting_legal_advice:   'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  awaiting_cabinet_decision:'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
}

function daysSince(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export default function PendingDecisions() {
  const navigate = useNavigate()
  const { agendaSectionLabel } = useAgendaSections()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stageFilter, setStageFilter] = useState('all')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/ops/pending-decisions/')
      setData(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load pending decisions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const submissions = data?.submissions ?? []
  const byStage = data?.by_stage ?? {}
  const filtered = stageFilter === 'all' ? submissions : submissions.filter(s => s.current_stage === stageFilter)

  return (
    <div>
      <PageHeader
        title="Pending Decisions"
        subtitle="Submissions at Commission stage awaiting a decision"
        action={
          <button
            type="button"
            className="btn-outline flex items-center gap-2 py-2 px-3 text-sm"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Stage summary chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setStageFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            stageFilter === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}
        >
          All ({submissions.length})
        </button>
        {STAGE_ORDER.filter(s => byStage[s] > 0).map(stage => (
          <button
            key={stage}
            type="button"
            onClick={() => setStageFilter(stage)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              stageFilter === stage
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {STAGE_LABELS[stage] || stage} ({byStage[stage]})
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Gavel size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">No submissions pending at Commission stage.</p>
          </div>
        ) : (
          <table className="table w-full">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Title</th>
                <th>Ministry</th>
                <th>Stage</th>
                <th>Submission Type</th>
                <th>Days Pending</th>
                <th>Next Meeting</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const days = daysSince(s.received_at)
                const isLong = days !== null && days > 60
                return (
                  <tr
                    key={s.id}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                    onClick={() => navigate(s.url)}
                  >
                    <td className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 whitespace-nowrap">
                      {s.reference_number}
                    </td>
                    <td className="max-w-xs">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{s.title}</p>
                    </td>
                    <td className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap max-w-[160px] truncate">
                      {s.ministry || '—'}
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STAGE_COLORS[s.current_stage] || stageBadgeClass(s.current_stage)}`}>
                        {STAGE_LABELS[s.current_stage] || s.current_stage}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500 max-w-[140px] truncate">
                      {s.agenda_category ? agendaSectionLabel(s.agenda_category).replace(/^\d+\.\s*/, '') : '—'}
                    </td>
                    <td>
                      {days !== null ? (
                        <span className={`flex items-center gap-1 text-xs font-semibold ${isLong ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                          {isLong && <AlertCircle size={12} />}
                          {days}d
                        </span>
                      ) : '—'}
                    </td>
                    <td className="text-xs text-slate-500 whitespace-nowrap">
                      {s.scheduled_meeting_date
                        ? new Date(s.scheduled_meeting_date).toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })
                        : <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><Clock size={12} /> Unscheduled</span>
                      }
                    </td>
                    <td>
                      <ExternalLink size={14} className="text-slate-400" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

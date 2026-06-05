import { useState } from 'react'
import { History } from 'lucide-react'
import SubmissionComments from './SubmissionComments'
import ActivityTimeline from './ActivityTimeline'

const TABS = [
  { key: 'discussion', label: 'Discussion' },
  { key: 'activity', label: 'Activity' },
  { key: 'all', label: 'All' },
]

/**
 * A7 P3 — unified "story of this submission".
 *  • Discussion → interactive comment thread (post / reply / @mention)
 *  • Activity   → stage transitions + audit events (read-only)
 *  • All        → everything merged, newest first (read-only)
 * Each tab mounts its own component, so switching always shows a fresh feed.
 */
export default function SubmissionActivity({ submissionId }) {
  const [tab, setTab] = useState('discussion')
  const target = `submission:${submissionId}`

  return (
    <div className="card card-compact">
      <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700 flex-wrap">
        <div className="flex items-center gap-2">
          <History size={14} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Activity &amp; Discussion</h3>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                tab === t.key
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'discussion' && <SubmissionComments submissionId={submissionId} embedded />}
      {tab === 'activity' && <ActivityTimeline target={target} kind="activity" />}
      {tab === 'all' && <ActivityTimeline target={target} kind="all" />}
    </div>
  )
}

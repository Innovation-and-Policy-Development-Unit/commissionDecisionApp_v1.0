import { useEffect, useState, useCallback } from 'react'
import { MessageSquare, GitBranch, Activity, ShieldCheck, Lock } from 'lucide-react'
import DOMPurify from 'dompurify'
import { getActivity } from '../../api/activity'
import MentionText from '../shared/MentionText'

function timeAgo(iso) {
  if (!iso) return ''
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })
}

const KIND_META = {
  comment: { Icon: MessageSquare, cls: 'text-primary-500 bg-primary-50 dark:bg-primary-900/30' },
  stage: { Icon: GitBranch, cls: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' },
  activity: { Icon: Activity, cls: 'text-slate-500 bg-slate-100 dark:bg-slate-800' },
}

function Entry({ entry, last }) {
  const meta = KIND_META[entry.kind] || KIND_META.activity
  const { Icon } = meta
  return (
    <li className="relative flex gap-3 pb-5">
      {!last && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />}
      <span className={`relative z-10 w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${meta.cls}`}>
        <Icon size={15} />
      </span>
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          <span className="font-semibold text-slate-800 dark:text-slate-100">{entry.actor}</span>{' '}
          {entry.summary}
          {entry.is_internal && (
            <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Lock size={9} /> Internal
            </span>
          )}
          {entry.has_proof && (
            <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <ShieldCheck size={9} /> Sealed
            </span>
          )}
          <span className="ml-1.5 text-[11px] text-slate-400">· {timeAgo(entry.at)}</span>
        </p>
        {entry.kind === 'comment' && entry.body && (
          <MentionText body={entry.body} className="mt-0.5 text-sm text-slate-600 dark:text-slate-400" />
        )}
        {entry.kind !== 'comment' && entry.body_html ? (
          <div
            className="rich-note-prose mt-0.5 text-sm text-slate-600 dark:text-slate-400"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(entry.body_html) }}
          />
        ) : entry.kind !== 'comment' && entry.body && (
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words">{entry.body}</p>
        )}
      </div>
    </li>
  )
}

/** Read-only merged feed. `kind` = 'all' | 'activity' | 'discussion'. */
export default function ActivityTimeline({ target, kind = 'all', refreshKey = 0 }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!target) return
    setLoading(true)
    try {
      const data = await getActivity(target, kind)
      setEntries(data.results || [])
    } catch {
      /* non-critical */
    } finally {
      setLoading(false)
    }
  }, [target, kind])

  useEffect(() => { load() }, [load, refreshKey])

  if (loading) return <p className="text-sm text-slate-400 py-4 text-center">Loading activity…</p>
  if (entries.length === 0) return <p className="text-sm text-slate-400 py-4 text-center">No activity yet.</p>

  return (
    <ul className="mt-1">
      {entries.map((e, i) => (
        <Entry key={e.id} entry={e} last={i === entries.length - 1} />
      ))}
    </ul>
  )
}

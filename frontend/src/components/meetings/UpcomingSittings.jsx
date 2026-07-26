import { useState, useEffect } from 'react'
import { CalendarClock, Loader2 } from 'lucide-react'
import api from '../../api/client'

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : ''

/**
 * Compact list of upcoming commission sittings and their submission due dates,
 * so HR and unit managers know the deadlines (and which are still open).
 */
export default function UpcomingSittings({ limit = 4 }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.get('/upcoming-sittings/')
      .then((res) => { if (active) setRows(Array.isArray(res.data) ? res.data.slice(0, limit) : []) })
      .catch(() => { if (active) setRows([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [limit])

  if (!loading && rows.length === 0) return null

  return (
    <div className="card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
        <CalendarClock size={15} className="text-primary-500" /> Upcoming sittings &amp; due dates
      </h3>
      {loading ? (
        <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-slate-300" /></div>
      ) : (
        <ul className="space-y-2">
          {rows.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{m.reference_number}</p>
                <p className="text-xs text-slate-400">Sits {fmt(m.date)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-500">Due {fmt(m.due_date)}</p>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${m.is_open ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {m.is_open ? 'Open' : 'Closed'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

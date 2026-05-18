import { CalendarDays, Clock, MapPin, CheckCircle2, XCircle, MoreVertical } from 'lucide-react'
import { SITTING_STATUSES, SITTING_TYPES } from '../constants'
import clsx from 'clsx'

export default function ListView({ meetings, onSittingClick, getCapacity }) {
  return (
    <div className="card overflow-hidden">
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Sitting Reference</th>
              <th>Title &amp; Venue</th>
              <th>Date &amp; Time</th>
              <th>Type</th>
              <th className="text-center">Operational Load</th>
              <th>Status</th>
              <th className="sr-only">Action</th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((m) => {
              const status = SITTING_STATUSES[m.status] || {}
              const capacity = getCapacity(m.agenda_count || 0)
              return (
                <tr
                  key={m.id}
                  onClick={() => onSittingClick(m)}
                  className="group cursor-pointer"
                >
                  <td>
                    <span className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400">
                      {m.reference_number}
                    </span>
                  </td>
                  <td>
                    <div className="max-w-xs">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-0.5 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {m.title}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <MapPin size={10} />
                        <span className="truncate">{m.venue}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <CalendarDays size={12} className="text-slate-400" />
                        <span className="text-xs">{new Date(m.date + 'T00:00').toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock size={12} />
                        <span>{m.time.slice(0, 5)}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={clsx(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                      m.type === 'special' ? "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800" : "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-600"
                    )}>
                      {m.type}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="inline-flex flex-col items-center">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{m.agenda_count || 0}</span>
                      <span className={`text-[9px] font-bold uppercase text-${capacity.color}-500`}>{capacity.label}</span>
                    </div>
                  </td>
                  <td>
                    <div className={clsx(
                      "inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold border shadow-sm",
                      status.bg, status.text, status.border
                    )}>
                      {status.icon && <status.icon size={12} />}
                      {status.label}
                    </div>
                  </td>
                  <td>
                    <div className="flex justify-end">
                      <button className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <MoreVertical size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

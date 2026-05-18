import { Calendar, Filter, Plus, Clock, AlertTriangle, ChevronRight } from 'lucide-react'
import { SITTING_STATUSES, SITTING_TYPES } from '../constants'
import clsx from 'clsx'

export default function OperationalSidebar({ 
  statusFilter, 
  setStatusFilter, 
  typeFilter, 
  setTypeFilter, 
  onScheduleClick,
  conflicts = [],
  upcomingDeadlines = []
}) {
  return (
    <aside className="w-80 flex-shrink-0 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
      {/* Quick Actions */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Secretariat Actions</h3>
        <button 
          onClick={onScheduleClick}
          className="w-full btn-gradient py-3 flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20"
        >
          <Plus size={18} /> Schedule Sitting
        </button>
      </div>

      {/* Operational Conflicts */}
      {conflicts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-3">
            <AlertTriangle size={18} />
            <span className="text-sm font-bold">Operational Conflicts ({conflicts.length})</span>
          </div>
          <div className="space-y-3">
            {conflicts.slice(0, 3).map((conflict, i) => (
              <div key={i} className="text-xs text-red-600 dark:text-red-300 leading-relaxed">
                {conflict.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Filters */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-2">
          <Filter size={12} /> Filter by Status
        </h3>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button 
            onClick={() => setStatusFilter('')}
            className={clsx(
              "w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50",
              !statusFilter ? "bg-primary-50 dark:bg-primary-900/10 text-primary-600 font-semibold" : "text-slate-600 dark:text-slate-400"
            )}
          >
            <span>All Statuses</span>
            {!statusFilter && <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />}
          </button>
          {Object.entries(SITTING_STATUSES).map(([key, meta]) => (
            <button 
              key={key}
              onClick={() => setStatusFilter(key)}
              className={clsx(
                "w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700",
                statusFilter === key ? "bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 font-semibold" : "text-slate-600 dark:text-slate-400"
              )}
            >
              <div className="flex items-center gap-2">
                <div className={clsx("w-2 h-2 rounded-full", `bg-${meta.color}-500`)} 
                     style={{ backgroundColor: meta.calendarColor }} />
                <span>{meta.label}</span>
              </div>
              {statusFilter === key && <div className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-slate-100" />}
            </button>
          ))}
        </div>
      </div>

      {/* Meeting Type Filters */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-2">
          <Calendar size={12} /> Sitting Type
        </h3>
        <div className="flex flex-wrap gap-2">
          {SITTING_TYPES.map(type => (
            <button 
              key={type.value}
              onClick={() => setTypeFilter(typeFilter === type.value ? '' : type.value)}
              className={clsx(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                typeFilter === type.value 
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-md" 
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400"
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upcoming Deadlines */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upcoming Deadlines</h3>
          <Clock size={12} className="text-slate-400" />
        </div>
        <div className="space-y-2">
          {upcomingDeadlines.length > 0 ? upcomingDeadlines.map((dl, i) => (
            <div key={i} className="group cursor-pointer bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-400 dark:hover:border-primary-500 transition-all">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase">{dl.type}</span>
                <span className="text-[10px] text-slate-400 font-mono">{dl.date}</span>
              </div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                {dl.title}
              </p>
            </div>
          )) : (
            <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-400 italic px-4">No critical deadlines tracked for this period.</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

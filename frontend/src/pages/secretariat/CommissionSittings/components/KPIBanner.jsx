import { Calendar, CalendarDays, CheckCircle2, ListChecks, TrendingUp } from 'lucide-react'

export default function KPIBanner({ kpis }) {
  const stats = [
    { label: 'Total Sittings',    value: kpis.total,         icon: Calendar,     color: 'text-primary-600', bg: 'bg-primary-50' },
    { label: 'Scheduled',         value: kpis.scheduled,     icon: CalendarDays, color: 'text-sky-600',     bg: 'bg-sky-50' },
    { label: 'Completed',         value: kpis.completed,     icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Agenda Items',      value: kpis.totalAgenda,   icon: ListChecks,   color: 'text-amber-600',   bg: 'bg-amber-50' },
    { label: 'Decisions Recorded',value: kpis.totalDecisions,icon: TrendingUp,   color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {stats.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums leading-none">
              {value}
            </p>
          </div>
          <div className={`${bg} dark:bg-opacity-10 p-3 rounded-xl ${color}`}>
            <Icon size={24} />
          </div>
        </div>
      ))}
    </div>
  )
}

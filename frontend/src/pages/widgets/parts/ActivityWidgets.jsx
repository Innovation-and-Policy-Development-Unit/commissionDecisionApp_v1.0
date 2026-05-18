import { Bell, Eye, Activity, Clock, Target, ArrowUpRight } from 'lucide-react'
import Section from './Section'
import { activities } from './data'

const engagementMetrics = [
  { label: 'Page Views',  value: '284K',    change: '+8.2%', icon: Eye,      gradient: 'bg-primary-500' },
  { label: 'Bounce Rate', value: '24.8%',   change: '-2.1%', icon: Activity, gradient: 'bg-rose-500'   },
  { label: 'Avg Session', value: '4m 32s',  change: '+12%',  icon: Clock,    gradient: 'bg-emerald-500' },
  { label: 'Conversions', value: '3.2K',    change: '+5.4%', icon: Target,   gradient: 'bg-amber-500'  },
]

export default function ActivityWidgets() {
  return (
    <Section title="Activity & Notifications" subtitle="Real-time feed with engagement metrics">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">

        <div className="md:col-span-3 card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Activity Feed</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bell size={18} className="text-slate-400" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center font-bold">6</span>
              </div>
              <button className="btn btn-ghost btn-sm text-xs">Mark all read</button>
            </div>
          </div>
          <div className="space-y-0">
            {activities.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-3.5 border-b border-slate-100 dark:border-slate-700 last:border-0 group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/20 -mx-2 px-2 rounded-xl transition-colors">
                {item.img ? (
                  <img src={item.img} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className={`w-8 h-8 rounded-full ${item.dot} flex items-center justify-center shrink-0`}>
                    <Bell size={14} className="text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0"><p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{item.text}</p></div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 btn btn-outline text-xs py-2">View all activity</button>
        </div>

        <div className="md:col-span-2 space-y-5">
          {engagementMetrics.map((m, i) => (
            <div key={i} className="card p-4 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${m.gradient} flex items-center justify-center shadow-sm shrink-0`}>
                <m.icon size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-400">{m.label}</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{m.value}</p>
              </div>
              <span className={`text-xs font-bold flex items-center gap-0.5 ${m.change.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                <ArrowUpRight size={12} className={m.change.startsWith('-') ? 'rotate-90' : ''} />
                {m.change}
              </span>
            </div>
          ))}
        </div>

      </div>
    </Section>
  )
}

import { Shield, Zap, Globe, Flame } from 'lucide-react'
import { img } from '../../../utils/imgPath'
import Section from './Section'

const features = [
  { title: 'Security Shield', desc: '99.9% uptime with enterprise-grade encryption', icon: Shield, gradient: 'bg-emerald-500', lightBg: 'bg-emerald-50 dark:bg-emerald-900/10' },
  { title: 'Lightning Fast',  desc: 'Sub-100ms response times worldwide',             icon: Zap,    gradient: 'bg-amber-500',   lightBg: 'bg-amber-50 dark:bg-amber-900/10'   },
  { title: 'Global Scale',    desc: '42 edge locations across 6 continents',          icon: Globe,  gradient: 'bg-sky-500',     lightBg: 'bg-sky-50 dark:bg-sky-900/10'       },
]

const events = [
  { day: 'Mar 5',  label: 'Team Standup',          color: 'bg-cyan-500'   },
  { day: 'Mar 11', label: 'Product Demo (Today)',  color: 'bg-primary-500' },
  { day: 'Mar 22', label: 'Quarterly Review',      color: 'bg-amber-500'  },
]

const leaderboard = [
  { name: 'Alice Johnson', score: 2840, rank: 1, img: img('/images/avatars/avatar-woman-alice.jpg'), badge: '🥇' },
  { name: 'Bob Martinez',  score: 2560, rank: 2, img: img('/images/avatars/avatar-man-bob.jpg'),     badge: '🥈' },
  { name: 'Carol White',   score: 2310, rank: 3, img: img('/images/avatars/avatar-woman-carol.jpg'), badge: '🥉' },
  { name: 'David Lee',     score: 1980, rank: 4, img: img('/images/avatars/avatar-man-john.jpg'),    badge: null },
  { name: 'Eva Brown',     score: 1740, rank: 5, img: img('/images/avatars/avatar-woman-grace.jpg'), badge: null },
]

function buildCalendar() {
  const year  = 2026
  const month = 2  // 0-indexed → March
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)
  return days
}

function CalendarWidget() {
  const days = buildCalendar()
  const today = 11
  const eventDots = new Set([5, 11, 22, 27])

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100">March 2026</h3>
          <p className="text-xs text-slate-400 mt-0.5">3 events this month</p>
        </div>
        <div className="flex gap-1">
          <button className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors text-lg leading-none">‹</button>
          <button className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors text-lg leading-none">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-[11px] font-semibold text-slate-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />
          const isToday = d === today
          const hasEvent = eventDots.has(d)
          return (
            <div key={d} className="flex flex-col items-center">
              <div className={`calendar-day font-medium text-sm ${isToday ? 'today text-white' : 'text-slate-700 dark:text-slate-300'} ${hasEvent && !isToday ? 'has-event' : ''}`}>{d}</div>
              {hasEvent && <div className={`w-1.5 h-1.5 rounded-full -mt-1 mb-0.5 ${isToday ? 'bg-white/60' : 'bg-primary-400'}`} />}
            </div>
          )
        })}
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
        {events.map((ev, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${ev.color} shrink-0`} />
            <span className="text-xs font-semibold text-slate-400 w-12 shrink-0">{ev.day}</span>
            <span className="text-xs text-slate-700 dark:text-slate-300">{ev.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeatureHighlights() {
  return (
    <div className="space-y-4">
      {features.map((f, i) => (
        <div key={i} className={`${f.lightBg} rounded-2xl p-4 border border-slate-100/80 dark:border-slate-700/50`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${f.gradient} flex items-center justify-center shadow-sm shrink-0`}>
              <f.icon size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{f.title}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{f.desc}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function LeaderboardWidget() {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900 dark:text-slate-100">Leaderboard</h3>
        <span className="badge badge-warning"><Flame size={11} /> This Week</span>
      </div>
      <div className="space-y-3">
        {leaderboard.map((u, i) => (
          <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
            <span className="text-sm font-bold text-slate-400 w-5 text-center">{u.badge || u.rank}</span>
            <img src={u.img} alt={u.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{u.name}</p>
            </div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{u.score.toLocaleString()} pts</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CalendarWidgets() {
  return (
    <Section title="Calendar & Feature Widgets" subtitle="Calendar with events and feature highlight cards">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <CalendarWidget />
        <FeatureHighlights />
        <LeaderboardWidget />
      </div>
    </Section>
  )
}

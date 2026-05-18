import { TrendingUp, TrendingDown } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import useChartColors from '../../../hooks/useChartColors'
import Section from './Section'
import { gradientStats, lightStats } from './data'

export function GradientStats() {
  return (
    <Section title="Stat Widgets" subtitle="Gradient cards with live sparklines">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {gradientStats.map((stat, i) => (
          <div key={i} className={`rounded-2xl p-5 text-white ${stat.color} shadow-card-md`}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <stat.icon size={18} />
              </div>
              <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${stat.up ? 'bg-white/25' : 'bg-black/20'}`}>
                {stat.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {stat.change}
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
            <p className="text-xs opacity-80 mt-0.5 mb-3">{stat.label}</p>
            <div className="h-12">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stat.spark} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`gs${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ffffff" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="#ffffff" strokeWidth={2} fill={`url(#gs${i})`} dot={false} strokeLinecap="round" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

export function LightStats() {
  const C = useChartColors()
  return (
    <Section title="Light Stat Cards" subtitle="Soft-tinted cards with icons and sparklines">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {lightStats.map((stat, i) => (
          <div key={i} className={`card p-5 ${stat.bg}`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center shadow-sm`}>
                <stat.icon size={18} className={stat.iconText} />
              </div>
              <span className={`flex items-center gap-1 text-xs font-semibold ${stat.changeColor}`}>
                {stat.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{stat.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">{stat.label}</p>
            <div className="h-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stat.spark} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`ls${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.primary} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={C.primary} stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="rgb(var(--p-500))" strokeWidth={1.5} fill={`url(#ls${i})`} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

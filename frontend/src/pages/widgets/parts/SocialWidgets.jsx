import { BarChart, Bar, Cell, ResponsiveContainer } from 'recharts'
import Section from './Section'
import { socialStats } from './data'

export default function SocialWidgets() {
  return (
    <Section title="Social Stats Widgets" subtitle="Platform follower counts with trend charts">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {socialStats.map((s, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center shadow-sm`}>
                  <s.icon size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{s.platform}</p>
                  <p className="text-[11px] text-slate-400">{s.handle}</p>
                </div>
              </div>
            </div>
            <div className="mb-1">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{s.followers}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">followers</p>
            </div>
            <p className="text-xs text-emerald-500 font-semibold mb-3">{s.today}</p>
            <div className="h-12">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.bars} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barSize={6}>
                  <Bar dataKey="v" radius={[3, 3, 0, 0]}>
                    {s.bars.map((_, bi) => (
                      <Cell key={bi} fill={bi === s.bars.length - 1 ? 'rgb(var(--p-500))' : 'rgb(var(--p-200))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

import clsx from 'clsx'
import { BarChart2, Zap, Globe } from 'lucide-react'
import { endpointStats } from './data'

function MostActiveKey({ keys, mostActive, totalCalls }) {
  const topShare = totalCalls > 0 ? Math.round((mostActive?.calls / totalCalls) * 100) : 0

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={16} className="text-primary-500" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Most Active Key</h3>
      </div>
      <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{mostActive?.name}</p>
          <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
            {mostActive?.calls.toLocaleString()} calls
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-primary-100 dark:bg-primary-900/40 overflow-hidden">
          <div className="h-full rounded-full bg-primary-500" style={{ width: `${topShare}%` }} />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{topShare}% of total traffic</p>
      </div>
      <div className="space-y-3">
        {keys.filter(k => k.status === 'Active').slice(0, 4).map(k => (
          <div key={k.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[160px]">{k.name}</span>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 shrink-0 ml-2">
                {k.calls.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-400 dark:bg-primary-500"
                style={{ width: `${Math.round((k.calls / (mostActive?.calls || 1)) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RateLimitStatus() {
  const items = [
    { label: 'Used',      value: '7,500',       color: 'bg-amber-500' },
    { label: 'Available', value: '2,500',       color: 'bg-slate-200 dark:bg-slate-600' },
    { label: 'Limit',     value: '10,000 / hr', color: 'bg-transparent' },
  ]

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={16} className="text-amber-500" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Rate Limit Status</h3>
      </div>
      <div className="flex items-center justify-center py-3 mb-4">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-700" strokeWidth="10" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke="#f59e0b" strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray="251.3"
              strokeDashoffset="62.8"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-bold text-2xl text-slate-800 dark:text-slate-200">75%</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">used</span>
          </div>
        </div>
      </div>
      <div className="space-y-2.5">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={clsx('w-2.5 h-2.5 rounded-full', item.color)} />
              <span className="text-xs text-slate-600 dark:text-slate-400">{item.label}</span>
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EndpointStats() {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Globe size={16} className="text-cyan-500" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Calls by Endpoint</h3>
      </div>
      <div className="space-y-3.5">
        {endpointStats.map(ep => (
          <div key={ep.endpoint}>
            <div className="flex items-center justify-between mb-1">
              <code className="text-[11px] font-mono text-slate-600 dark:text-slate-400 truncate max-w-[170px]">{ep.endpoint}</code>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-2 shrink-0">
                {ep.calls.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-cyan-500" style={{ width: `${ep.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function UsageStats({ keys, mostActive, totalCalls }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <MostActiveKey keys={keys} mostActive={mostActive} totalCalls={totalCalls} />
      <RateLimitStatus />
      <EndpointStats />
    </div>
  )
}

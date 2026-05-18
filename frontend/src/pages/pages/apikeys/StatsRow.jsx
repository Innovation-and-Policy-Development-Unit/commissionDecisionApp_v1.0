import clsx from 'clsx'
import { Key, CheckCircle, Activity, Zap } from 'lucide-react'

export default function StatsRow({ totalKeys, activeCount, totalCalls }) {
  const cards = [
    { label: 'Total Keys',      value: totalKeys,                 icon: Key,         bg: 'bg-primary-50 dark:bg-primary-900/20', iconColor: 'text-primary-600 dark:text-primary-400', border: 'border-primary-100 dark:border-primary-800' },
    { label: 'Active Keys',     value: activeCount,               icon: CheckCircle, bg: 'bg-emerald-50 dark:bg-emerald-900/20', iconColor: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-800' },
    { label: 'API Calls Today', value: totalCalls.toLocaleString(), icon: Activity,  bg: 'bg-violet-50 dark:bg-violet-900/20',    iconColor: 'text-violet-600 dark:text-violet-400',   border: 'border-violet-100 dark:border-violet-800'   },
    { label: 'Rate Limit',      value: '10k / hr',                icon: Zap,         bg: 'bg-amber-50 dark:bg-amber-900/20',     iconColor: 'text-amber-600 dark:text-amber-400',     border: 'border-amber-100 dark:border-amber-800'     },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon: Icon, bg, iconColor, border }) => (
        <div key={label} className={clsx('card p-5 flex items-center gap-4 border', border)}>
          <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', bg)}>
            <Icon size={22} className={iconColor} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 leading-none">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

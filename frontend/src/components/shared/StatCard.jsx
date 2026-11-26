import React from 'react'
import clsx from 'clsx'
import { TrendingUp, TrendingDown } from 'lucide-react'
import CountUp from './CountUp'

// -700 shades (not -500) so white text clears WCAG AA contrast (4.5:1) at the
// small 12px label size, not just the large headline number.
const solidColors = {
  purple: 'bg-indigo-700',
  cyan: 'bg-cyan-700',
  emerald: 'bg-emerald-700',
  amber: 'bg-amber-700',
  red: 'bg-red-700',
  blue: 'bg-blue-700',
}

// `variant="quiet"`: a normal card with a tinted icon chip, for rows of five or
// more figures where five solid colour blocks shout over the table beneath them.
const quietColors = {
  purple: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

function renderStatIcon(Icon, className = 'text-white') {
  if (!Icon) return null
  if (React.isValidElement(Icon)) return Icon
  const Component = Icon
  return <Component size={20} fontSize={20} className={className} />
}

export default function StatCard({
  title,
  label,
  value,
  icon: Icon,
  change,
  changeLabel,
  color = 'purple',
  suffix = '',
  prefix = '',
  onClick,
  variant = 'solid',
}) {
  const heading = title || label
  const isPositive = change >= 0
  const solidColor = solidColors[color] || solidColors.purple
  const iconNode = renderStatIcon(Icon)

  if (variant === 'quiet') {
    const chip = quietColors[color] || quietColors.slate
    return (
      <div
        className={clsx('card p-4', onClick && 'cursor-pointer hover:border-primary-300 dark:hover:border-primary-700')}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-snug">{heading}</p>
          {Icon && (
            <span className={clsx('shrink-0 w-8 h-8 rounded-lg flex items-center justify-center', chip)}>
              {renderStatIcon(Icon, '')}
            </span>
          )}
        </div>
        <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {prefix}<CountUp value={value} />{suffix}
        </p>
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'relative rounded-2xl p-5 overflow-hidden text-white shadow-card-md hover:shadow-card-lg transition-all duration-200 hover:-translate-y-0.5',
        solidColor,
        onClick && 'cursor-pointer active:scale-[0.98]',
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
        <div className="w-full h-full rounded-full bg-white transform translate-x-8 -translate-y-8" />
      </div>
      <div className="absolute bottom-0 left-0 w-20 h-20 opacity-10">
        <div className="w-full h-full rounded-full bg-white transform -translate-x-6 translate-y-6" />
      </div>

      <div className="relative">
        {/* Icon and title */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white text-xs font-semibold uppercase tracking-wider">{heading}</p>
          </div>
          {iconNode && (
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              {iconNode}
            </div>
          )}
        </div>

        {/* Value */}
        <div className={change != null && !Number.isNaN(change) ? 'mb-3' : ''}>
          <p className="text-3xl font-bold tracking-tight">
            {prefix}<CountUp value={value} />{suffix}
          </p>
        </div>

        {/* Change indicator */}
        {change != null && !Number.isNaN(change) && (
          <div className="flex items-center gap-1.5">
            <div className={clsx(
              'flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full',
              isPositive ? 'bg-white/20 text-white' : 'bg-white/20 text-white'
            )}>
              {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              <span>{isPositive ? '+' : ''}{change}%</span>
            </div>
            <span className="text-white text-xs">{changeLabel || 'vs last month'}</span>
          </div>
        )}
      </div>
    </div>
  )
}

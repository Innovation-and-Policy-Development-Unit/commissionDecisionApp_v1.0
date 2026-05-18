import { useTranslation } from 'react-i18next'
import { phaseForKey, PHASES, needsHrAction, phaseLabel } from '../../constants/stages'

const PHASE_COLORS = {
  blue:    { bar: 'bg-blue-500',       dot: 'bg-blue-600',       pulse: 'bg-blue-400/40' },
  indigo:  { bar: 'bg-indigo-500',     dot: 'bg-indigo-600',     pulse: 'bg-indigo-400/40' },
  violet:  { bar: 'bg-violet-500',     dot: 'bg-violet-600',     pulse: 'bg-violet-400/40' },
  purple:  { bar: 'bg-purple-500',     dot: 'bg-purple-600',     pulse: 'bg-purple-400/40' },
  emerald: { bar: 'bg-emerald-500',    dot: 'bg-emerald-600',    pulse: 'bg-emerald-400/40' },
  green:   { bar: 'bg-green-500',      dot: 'bg-green-600',      pulse: 'bg-green-400/40' },
  orange:  { bar: 'bg-orange-500',     dot: 'bg-orange-600',     pulse: 'bg-orange-400/40' },
  slate:   { bar: 'bg-slate-300',      dot: 'bg-slate-400',      pulse: 'bg-slate-300/40' },
}

function PhaseIcon({ phase, color, isComplete, isActive, isSentBack }) {
  if (isSentBack) {
    return (
      <div className={`relative w-5 h-5 rounded-full flex items-center justify-center ${color.dot} ring-2 ring-white dark:ring-slate-800`}>
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>
    )
  }
  if (isComplete) {
    return (
      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${color.dot} ring-2 ring-white dark:ring-slate-800`}>
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
    )
  }
  if (isActive) {
    return (
      <div className={`relative w-5 h-5 rounded-full flex items-center justify-center ${color.dot} ring-2 ring-white dark:ring-slate-800`}>
        <div className={`w-2 h-2 rounded-full bg-white animate-ping ${color.pulse}`} />
        <div className="absolute w-2 h-2 rounded-full bg-white" />
      </div>
    )
  }
  return (
    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 ring-2 ring-white dark:ring-slate-800" />
  )
}

export default function SubmissionProgressBar({ currentStage, compact }) {
  const { t } = useTranslation()
  const currentPhase = phaseForKey(currentStage)
  const sentBack = needsHrAction(currentStage)

  if (compact) {
    const idx = PHASES.findIndex(p => p.key === currentPhase?.key)
    const pct = idx >= 0 ? ((idx + 1) / PHASES.length) * 100 : 0
    return (
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${sentBack ? 'bg-orange-400' : 'bg-primary-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-1">
        {PHASES.map((phase, i) => {
          const phaseIdx = PHASES.findIndex(p => p.key === currentPhase?.key)
          const isComplete = phaseIdx > i
          const isActive = phase.key === currentPhase?.key

          let colors = PHASE_COLORS[phase.color] || PHASE_COLORS.slate
          if (!isComplete && !isActive) colors = PHASE_COLORS.slate
          if (sentBack && isActive) colors = PHASE_COLORS.orange

          return (
            <div key={phase.key} className="flex-1 flex flex-col items-center">
              <div className="w-full flex items-center">
                <div className="flex-1 h-0.5 bg-slate-200 dark:bg-slate-700 relative">
                  <div
                    className={`absolute inset-0 h-full transition-all duration-700 ease-out ${isComplete ? colors.bar : ''} ${isActive && !sentBack ? 'bg-primary-500' : ''} ${sentBack && isActive ? 'bg-orange-400' : ''}`}
                    style={{ width: isActive && !isComplete ? '50%' : isComplete ? '100%' : '0%' }}
                  />
                  {isActive && (
                    <div className={`absolute inset-0 h-full animate-pulse ${sentBack ? 'bg-orange-400/50' : 'bg-primary-400/50'}`}
                      style={{ width: '50%' }}
                    />
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center mt-1.5">
                <PhaseIcon
                  phase={phase}
                  color={colors}
                  isComplete={isComplete}
                  isActive={isActive}
                  isSentBack={sentBack && isActive}
                />
                <span className={`text-[10px] mt-1 leading-tight text-center transition-colors duration-300
                  ${isComplete ? 'text-slate-700 dark:text-slate-300 font-medium' : ''}
                  ${isActive ? (sentBack ? 'text-orange-600 dark:text-orange-400 font-semibold' : 'text-primary-600 dark:text-primary-400 font-semibold') : ''}
                  ${!isComplete && !isActive ? 'text-slate-400 dark:text-slate-600' : ''}
                `}>
                  {phaseLabel(phase.key, t)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

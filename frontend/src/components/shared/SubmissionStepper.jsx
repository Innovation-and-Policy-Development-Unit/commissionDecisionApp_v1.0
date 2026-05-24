import { useTranslation } from 'react-i18next'
import { Check, AlertTriangle, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { PHASES, phaseForKey, phaseLabel, stageLabel, needsHrAction, isTerminal } from '../../constants/stages'

/**
 * Visual stepper replacing the dot-based SubmissionProgressBar.
 *
 * Shows each of the 6 PHASES as a labelled step with:
 *   - Checkmark for completed phases
 *   - Pulsing ring for the active phase
 *   - Warning icon when the submission has been sent back (needsHrAction)
 *   - Dimmed number for future phases
 *   - Active sub-stage name below the active step
 */

const PHASE_RING = {
  blue:    'ring-blue-500 bg-blue-500 text-white',
  indigo:  'ring-indigo-500 bg-indigo-500 text-white',
  violet:  'ring-violet-500 bg-violet-500 text-white',
  purple:  'ring-purple-500 bg-purple-500 text-white',
  emerald: 'ring-emerald-500 bg-emerald-500 text-white',
  green:   'ring-green-500 bg-green-500 text-white',
}

const PHASE_DONE = {
  blue:    'bg-blue-500',
  indigo:  'bg-indigo-500',
  violet:  'bg-violet-500',
  purple:  'bg-purple-500',
  emerald: 'bg-emerald-500',
  green:   'bg-green-500',
}

const PHASE_TEXT_ACTIVE = {
  blue:    'text-blue-700 dark:text-blue-300',
  indigo:  'text-indigo-700 dark:text-indigo-300',
  violet:  'text-violet-700 dark:text-violet-300',
  purple:  'text-purple-700 dark:text-purple-300',
  emerald: 'text-emerald-700 dark:text-emerald-300',
  green:   'text-green-700 dark:text-green-300',
}

const PHASE_CONNECTOR_DONE = {
  blue:    'bg-blue-400',
  indigo:  'bg-indigo-400',
  violet:  'bg-violet-400',
  purple:  'bg-purple-400',
  emerald: 'bg-emerald-400',
  green:   'bg-green-400',
}

function StepNode({ phase, index, isComplete, isActive, isFuture, isSentBack }) {
  const base = 'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 transition-all duration-300'

  if (isSentBack && isActive) {
    return (
      <div className={clsx(base, 'ring-orange-400 bg-orange-500 text-white')}>
        <AlertTriangle size={13} />
      </div>
    )
  }
  if (isActive) {
    const colors = PHASE_RING[phase.color] || PHASE_RING.blue
    return (
      <div className="relative flex-shrink-0">
        <div className={clsx(base, colors, 'ring-current')}>
          <Loader2 size={13} className="animate-spin" />
        </div>
        <span className="absolute inset-0 rounded-full animate-ping opacity-30 bg-current" aria-hidden="true" />
      </div>
    )
  }
  if (isComplete) {
    const doneBg = PHASE_DONE[phase.color] || 'bg-slate-400'
    return (
      <div className={clsx(base, doneBg, 'text-white ring-transparent')}>
        <Check size={13} strokeWidth={3} />
      </div>
    )
  }
  // future
  return (
    <div className={clsx(base, 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 ring-slate-200 dark:ring-slate-600')}>
      {index + 1}
    </div>
  )
}

export default function SubmissionStepper({ currentStage, className }) {
  const { t } = useTranslation()
  const currentPhase = phaseForKey(currentStage)
  const sentBack = needsHrAction(currentStage)
  const done = isTerminal(currentStage)
  const activeIndex = PHASES.findIndex(p => p.key === currentPhase?.key)

  // Pre-submission stages (draft, received_by_psc, registered_routed, resubmitted)
  // map to the first phase visually — show as "in progress" toward Submitted
  const effectiveActiveIndex = activeIndex >= 0 ? activeIndex : -1

  return (
    <div className={clsx('w-full', className)} aria-label="Submission progress">
      <div className="flex items-start">
        {PHASES.map((phase, i) => {
          const isComplete = done || effectiveActiveIndex > i
          const isActive = effectiveActiveIndex === i
          const isFuture = effectiveActiveIndex < i && !done
          const isSentBack = sentBack && isActive

          const connectorDone = done || effectiveActiveIndex > i
          const connectorActive = effectiveActiveIndex === i

          return (
            <div key={phase.key} className="flex-1 flex flex-col items-center relative">
              {/* Connector line before this node */}
              {i > 0 && (
                <div className="absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 overflow-hidden">
                  <div className="w-full h-full bg-slate-200 dark:bg-slate-700" />
                  <div
                    className={clsx(
                      'absolute inset-0 h-full transition-all duration-500',
                      connectorDone
                        ? (PHASE_CONNECTOR_DONE[PHASES[i - 1].color] || 'bg-slate-400')
                        : connectorActive
                          ? 'bg-gradient-to-r from-slate-400 to-transparent'
                          : 'bg-transparent',
                    )}
                  />
                </div>
              )}

              {/* Node */}
              <StepNode
                phase={phase}
                index={i}
                isComplete={isComplete}
                isActive={isActive}
                isFuture={isFuture}
                isSentBack={isSentBack}
              />

              {/* Phase label */}
              <span
                className={clsx(
                  'mt-1.5 text-[10px] leading-tight text-center font-medium transition-colors duration-200 px-0.5',
                  isComplete && 'text-slate-600 dark:text-slate-300',
                  isActive && !isSentBack && (PHASE_TEXT_ACTIVE[phase.color] || 'text-blue-700 dark:text-blue-300') + ' font-semibold',
                  isActive && isSentBack && 'text-orange-600 dark:text-orange-400 font-semibold',
                  isFuture && 'text-slate-400 dark:text-slate-600',
                )}
              >
                {phaseLabel(phase.key, t)}
              </span>

              {/* Active sub-stage label */}
              {isActive && currentStage && (
                <span className={clsx(
                  'mt-0.5 text-[9px] leading-tight text-center italic truncate max-w-full px-0.5',
                  isSentBack ? 'text-orange-500 dark:text-orange-400' : 'text-slate-400 dark:text-slate-500',
                )}>
                  {stageLabel(currentStage, t)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

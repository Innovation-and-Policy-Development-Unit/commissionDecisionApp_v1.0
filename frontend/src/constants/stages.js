/** Matches backend tracker.models.WorkflowStage — keep in sync */

export const STAGE_LABELS = {
  // Pre-submission
  draft:                      'Draft',
  submitted:                  'Submitted to PSC',
  // PSC intake
  received_by_psc:            'Received by PSC',
  returned_for_clarification: 'Returned for Clarification',
  registered_routed:          'Registered and Routed',
  manager_checklist_review:   'Manager Checklist Review',
  under_assessment:           'Under Assessment',
  // Hold / deferral
  deferred:                   'Deferred',
  tabled:                     'Tabled',
  awaiting_legal_advice:      'Awaiting Legal Advice',
  awaiting_cabinet_decision:  'Awaiting Cabinet Decision',
  // Resubmission
  resubmitted:                'Resubmitted',
  // Commission
  forwarded_to_commission:    'Forwarded to Commission',
  commission_sitting:         'Commission Sitting',
  matters_arising:            'Matters Arising',
  approved:                   'Approved',
  rejected:                   'Rejected',
  returned:                   'Returned',
  deferred_back_to_hr:        'Deferred Back to HR',
  // Post-decision
  minutes_drafted_signed:     'Minutes Drafted and Signed',
  decision_entered_assigned:  'Decision Entered and Assigned',
  under_implementation:       'Under Implementation',
  implementation_report:      'Implementation Report',
}

/**
 * English label lookup. Use `stageLabel(code, t)` to get a translated label;
 * the `t` argument is an optional i18next translator. When omitted, the
 * English fallback in STAGE_LABELS is returned.
 */
export function stageLabel(code, t) {
  if (t) {
    const key = `stage.${code}`
    const translated = t(key)
    if (translated && translated !== key) return translated
  }
  return STAGE_LABELS[code] || code
}

/** Translated stage category label (defaults to the English string in STAGE_META). */
export function stageCategoryLabel(code, t) {
  const meta = STAGE_META[code]
  if (!meta) return t ? t('stage_category.unknown') : 'Unknown'
  if (!t) return meta.category
  // Map English category names → translation keys.
  const map = {
    'Pre-submission': 'stage_category.pre_submission',
    'PSC Intake':     'stage_category.psc_intake',
    'Clarification':  'stage_category.clarification',
    'Assessment':     'stage_category.assessment',
    'On Hold':        'stage_category.on_hold',
    'Resubmission':   'stage_category.resubmission',
    'Commission':     'stage_category.commission',
    'Decision':       'stage_category.decision',
    'Post-decision':  'stage_category.post_decision',
    'Implementation': 'stage_category.implementation',
  }
  const key = map[meta.category]
  if (!key) return meta.category
  const translated = t(key)
  return translated === key ? meta.category : translated
}

/** Translated phase label (used by HR progress bar). */
export function phaseLabel(phaseKey, t) {
  const phase = PHASES.find(p => p.key === phaseKey)
  if (!phase) return phaseKey
  if (!t) return phase.label
  const key = `phase.${phase.key}`
  const translated = t(key)
  return translated === key ? phase.label : translated
}

/**
 * Visual metadata for each stage used in timeline and badge rendering.
 * color   → Tailwind utility suffix (used as bg-{color}-100 text-{color}-700 etc.)
 * category → logical grouping label
 * terminal → true if this is an end-state (no further progress expected)
 */
export const STAGE_META = {
  draft:                      { color: 'slate',  category: 'Pre-submission',  terminal: false },
  submitted:                  { color: 'blue',   category: 'Pre-submission',  terminal: false },
  received_by_psc:            { color: 'blue',   category: 'PSC Intake',      terminal: false },
  returned_for_clarification: { color: 'orange', category: 'Clarification',   terminal: false },
  registered_routed:          { color: 'indigo', category: 'PSC Intake',      terminal: false },
  manager_checklist_review:   { color: 'indigo', category: 'Assessment',      terminal: false },
  under_assessment:           { color: 'violet', category: 'Assessment',      terminal: false },
  deferred:                   { color: 'amber',  category: 'On Hold',         terminal: false },
  tabled:                     { color: 'amber',  category: 'On Hold',         terminal: false },
  awaiting_legal_advice:      { color: 'amber',  category: 'On Hold',         terminal: false },
  awaiting_cabinet_decision:  { color: 'amber',  category: 'On Hold',         terminal: false },
  resubmitted:                { color: 'cyan',   category: 'Resubmission',    terminal: false },
  forwarded_to_commission:    { color: 'purple', category: 'Commission',      terminal: false },
  commission_sitting:         { color: 'purple', category: 'Commission',      terminal: false },
  matters_arising:            { color: 'purple', category: 'Commission',      terminal: false },
  approved:                   { color: 'emerald',category: 'Decision',        terminal: false },
  rejected:                   { color: 'red',    category: 'Decision',        terminal: false },
  returned:                   { color: 'rose',   category: 'Decision',        terminal: false },
  deferred_back_to_hr:        { color: 'orange', category: 'Decision',        terminal: false },
  minutes_drafted_signed:     { color: 'teal',   category: 'Post-decision',   terminal: false },
  decision_entered_assigned:  { color: 'teal',   category: 'Post-decision',   terminal: false },
  under_implementation:       { color: 'green',  category: 'Implementation',  terminal: false },
  implementation_report:      { color: 'green',  category: 'Implementation',  terminal: true  },
}

export function stageMeta(code) {
  return STAGE_META[code] || { color: 'slate', category: 'Unknown', terminal: false }
}

/** Returns Tailwind classes for a stage badge */
export function stageBadgeClass(code) {
  const { color } = stageMeta(code)
  const map = {
    slate:   'bg-slate-100  text-slate-700  dark:bg-slate-700  dark:text-slate-300',
    blue:    'bg-blue-100   text-blue-700   dark:bg-blue-900/40  dark:text-blue-300',
    indigo:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    violet:  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    orange:  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    amber:   'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',
    cyan:    'bg-cyan-100   text-cyan-700   dark:bg-cyan-900/40   dark:text-cyan-300',
    purple:  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    red:     'bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-300',
    rose:    'bg-rose-100   text-rose-700   dark:bg-rose-900/40   dark:text-rose-300',
    teal:    'bg-teal-100   text-teal-700   dark:bg-teal-900/40   dark:text-teal-300',
    green:   'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300',
  }
  return map[color] || map.slate
}

/**
 * Phase-based progress bar definitions for HR manager view.
 * Groups stages into 5 high-level phases.
 */
export const PHASES = [
  { key: 'submitted',   label: 'Submitted',         color: 'blue',     stages: ['submitted', 'returned_for_clarification'] },
  { key: 'review',      label: 'Checklist Review',  color: 'indigo',   stages: ['manager_checklist_review'] },
  { key: 'assessment',  label: 'Under Assessment',  color: 'violet',   stages: ['under_assessment', 'awaiting_legal_advice'] },
  { key: 'commission',  label: 'With Commission',   color: 'purple',   stages: ['forwarded_to_commission', 'commission_sitting', 'tabled', 'matters_arising'] },
  { key: 'decision',    label: 'Decision',          color: 'emerald',  stages: ['approved', 'rejected', 'deferred_back_to_hr', 'minutes_drafted_signed'] },
  { key: 'implement',   label: 'Implementation',    color: 'green',    stages: ['decision_entered_assigned', 'under_implementation', 'implementation_report'] },
]

/** Determine which phase a stage belongs to, or null for pre-submit stages. */
export function phaseForKey(stage) {
  return PHASES.find(p => p.stages.includes(stage)) || null
}

/** Progress fraction (0–1) for the progress bar. */
export function phaseProgress(stage) {
  const idx = PHASES.findIndex(p => p.stages.includes(stage))
  return idx >= 0 ? (idx + 1) / PHASES.length : 0
}

/** Returns true if the stage is a terminal/end state. */
export function isTerminal(code) {
  return STAGE_META[code]?.terminal === true
}

/**
 * Returns true if the submission has been "sent back" and needs HR attention.
 * These are stages where the HR manager needs to take action.
 */
export function needsHrAction(stage) {
  return ['returned_for_clarification', 'deferred_back_to_hr'].includes(stage)
}

/** Dot color class for timeline rendering */
export function stageDotClass(code) {
  const { color } = stageMeta(code)
  const map = {
    slate:   'bg-slate-400',
    blue:    'bg-blue-500',
    indigo:  'bg-indigo-500',
    violet:  'bg-violet-500',
    orange:  'bg-orange-500',
    amber:   'bg-amber-500',
    cyan:    'bg-cyan-500',
    purple:  'bg-purple-500',
    emerald: 'bg-emerald-500',
    red:     'bg-red-500',
    rose:    'bg-rose-500',
    teal:    'bg-teal-500',
    green:   'bg-green-500',
  }
  return map[color] || map.slate
}

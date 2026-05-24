import {
  SUBWAY_STATIONS,
  stationIndexForStage,
  stagesForStation,
} from '../constants/subwayStations'

/** Roles that may trigger workflow transitions (match SubmissionDetail). */
export const KANBAN_TRANSITION_ROLES = [
  'psc_officer',
  'psc_secretary',
  'psc_commissioner',
  'psc_admin',
  'ministry_hr',
  'dept_admin',
  'vipam_manager',
  'hr_unit_manager',
  'odu_manager',
  'compliance_manager',
]

export function stationIdForStage(stage) {
  const idx = stationIndexForStage(stage)
  return SUBWAY_STATIONS[idx]?.id ?? 'intake'
}

export function allowedStagesForStation(allowed, stationId) {
  const columnStages = new Set(stagesForStation(stationId))
  return (allowed || []).filter((s) => columnStages.has(s))
}

/** Pick the most advanced allowed stage within the target column. */
export function pickDefaultTargetStage(allowedInColumn, stationId) {
  if (!allowedInColumn?.length) return null
  if (allowedInColumn.length === 1) return allowedInColumn[0]

  const order = stagesForStation(stationId)
  const ranked = [...allowedInColumn].sort(
    (a, b) => order.indexOf(b) - order.indexOf(a),
  )
  return ranked[0]
}

/**
 * Ministry-facing subway stations — maps granular WorkflowStages to five logical stops.
 * Keep in sync with backend/tracker/subway_map.py SUBWAY_STATION_DEFS.
 */
export const SUBWAY_STATIONS = [
  {
    id: 'intake',
    label: 'Intake',
    labelKey: 'subway.intake',
    stages: [
      'draft',
      'submitted',
      'received_by_psc',
      'resubmitted',
      'returned_for_clarification',
      'secretary_review',
    ],
  },
  {
    id: 'assessment',
    label: 'Assessment',
    labelKey: 'subway.assessment',
    stages: [
      'registered_routed',
      'manager_checklist_review',
      'under_assessment',
      'compliance_under_review',
      'deferred',
      'awaiting_legal_advice',
      'awaiting_cabinet_decision',
    ],
  },
  {
    id: 'commission',
    label: 'Commission',
    labelKey: 'subway.commission',
    stages: [
      'forwarded_to_commission',
      'commission_sitting',
      'matters_arising',
      'tabled',
    ],
  },
  {
    id: 'decision',
    label: 'Decision',
    labelKey: 'subway.decision',
    stages: [
      'approved',
      'rejected',
      'returned',
      'deferred_back_to_hr',
    ],
  },
  {
    id: 'implementation',
    label: 'Execution',
    labelKey: 'subway.implementation',
    stages: [
      'minutes_drafted_signed',
      'decision_entered_assigned',
      'under_implementation',
      'implementation_report',
    ],
  },
]

export const ALERT_STAGES = new Set(['returned_for_clarification', 'rejected'])

export function stationIndexForStage(stage) {
  if (!stage) return 0
  const idx = SUBWAY_STATIONS.findIndex((s) => s.stages.includes(stage))
  return idx >= 0 ? idx : 0
}

export function stationById(id) {
  return SUBWAY_STATIONS.find((s) => s.id === id)
}

export function stagesForStation(stationId) {
  return stationById(stationId)?.stages ?? []
}

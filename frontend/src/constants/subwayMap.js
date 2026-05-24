/**
 * Client-side fallback when `subway_map` is not yet on the API payload.
 * Station ids and stage lists must match backend/tracker/subway_map.py.
 */

export const SUBWAY_STATIONS = [
  {
    id: 'registered',
    workflow_stages: [
      'draft', 'submitted', 'received_by_psc', 'returned_for_clarification',
      'registered_routed', 'manager_checklist_review', 'resubmitted', 'secretary_review',
    ],
  },
  {
    id: 'under_assessment',
    workflow_stages: [
      'under_assessment', 'compliance_under_review', 'deferred', 'tabled',
      'awaiting_legal_advice', 'awaiting_cabinet_decision',
    ],
  },
  {
    id: 'commission_sitting',
    workflow_stages: [
      'forwarded_to_commission', 'commission_sitting', 'matters_arising',
      'approved', 'rejected', 'returned', 'deferred_back_to_hr',
    ],
  },
  {
    id: 'implementation',
    workflow_stages: [
      'minutes_drafted_signed', 'decision_entered_assigned',
      'under_implementation', 'implementation_report',
    ],
  },
]

const SENT_BACK = new Set(['returned_for_clarification', 'deferred_back_to_hr', 'returned'])

const DEFAULT_RETURN_TARGET = {
  returned_for_clarification: 'registered_routed',
  deferred_back_to_hr: 'under_assessment',
  returned: 'registered_routed',
}

function stationIdForStage(stage) {
  const hit = SUBWAY_STATIONS.find(s => s.workflow_stages.includes(stage))
  return hit?.id ?? 'registered'
}

function stationIndex(id) {
  return SUBWAY_STATIONS.findIndex(s => s.id === id)
}

/** Build subway_map shape from current_stage + optional workflow events. */
export function buildSubwayMapFallback(currentStage, events = []) {
  const stage = currentStage || 'draft'
  let sentBack = null

  if (SENT_BACK.has(stage)) {
    let previousStage = null
    for (let i = events.length - 1; i >= 0; i -= 1) {
      if (events[i].new_stage === stage) {
        previousStage = events[i].previous_stage
        break
      }
    }
    if (!previousStage) previousStage = DEFAULT_RETURN_TARGET[stage]

    let targetStationId = stationIdForStage(DEFAULT_RETURN_TARGET[stage] || previousStage)
    if (stage === 'returned_for_clarification' || stage === 'returned') {
      targetStationId = 'registered'
    } else if (stage === 'deferred_back_to_hr') {
      targetStationId = 'under_assessment'
    }

    sentBack = {
      active: true,
      reason_stage: stage,
      from_station_id: stationIdForStage(previousStage),
      target_station_id: targetStationId,
      from_stage: previousStage,
    }
  }

  const currentStationId = sentBack?.active
    ? sentBack.target_station_id
    : stationIdForStage(stage)
  const currentIdx = stationIndex(currentStationId)
  const targetIdx = sentBack?.active ? stationIndex(sentBack.target_station_id) : currentIdx
  const fromIdx = sentBack?.active ? stationIndex(sentBack.from_station_id) : currentIdx

  const stations = SUBWAY_STATIONS.map((st, i) => {
    const inStation = st.workflow_stages.includes(stage)
    let status = 'upcoming'
    if (sentBack?.active) {
      if (st.id === sentBack.target_station_id) status = 'returned'
      else if (st.id === sentBack.from_station_id) status = 'returned_from'
      else if (i < Math.min(targetIdx, fromIdx)) status = 'complete'
      else status = 'upcoming'
    } else if (inStation) status = 'current'
    else if (i < currentIdx) status = 'complete'
    else status = 'upcoming'

    return {
      id: st.id,
      label_key: `subway.${st.id}`,
      status,
      workflow_stages: st.workflow_stages,
      current_substage: inStation ? stage : null,
    }
  })

  let pathVariant = 'normal'
  if (stage === 'implementation_report') pathVariant = 'complete'
  else if (sentBack?.active) pathVariant = 'returned'

  let progressPercent = 0
  if (pathVariant === 'complete') progressPercent = 100
  else if (sentBack?.active) progressPercent = Math.round((targetIdx + 0.35) / SUBWAY_STATIONS.length * 100)
  else progressPercent = Math.round((currentIdx + 0.65) / SUBWAY_STATIONS.length * 100)

  return {
    stations,
    current_stage: stage,
    current_station_id: currentStationId,
    path_variant: pathVariant,
    sent_back: sentBack,
    progress_percent: Math.min(100, Math.max(0, progressPercent)),
    station_order: SUBWAY_STATIONS.map(s => s.id),
  }
}

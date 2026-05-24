/**
 * Client-side fallback when `subway_map` is not yet on the API payload.
 * Must match backend/tracker/subway_map.py and constants/subwayStations.js.
 */

import { ALERT_STAGES, SUBWAY_STATIONS, stationIndexForStage } from './subwayStations'

export { SUBWAY_STATIONS, ALERT_STAGES, stationIndexForStage }

const SENT_BACK = new Set(['returned_for_clarification', 'deferred_back_to_hr', 'returned'])

const DEFAULT_RETURN_TARGET = {
  returned_for_clarification: 'submitted',
  deferred_back_to_hr: 'under_assessment',
  returned: 'registered_routed',
}

function stationIdForStage(stage) {
  const hit = SUBWAY_STATIONS.find((s) => s.stages.includes(stage))
  return hit?.id ?? 'intake'
}

function stationIndex(id) {
  return SUBWAY_STATIONS.findIndex((s) => s.id === id)
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
      targetStationId = 'intake'
    } else if (stage === 'deferred_back_to_hr') {
      targetStationId = 'assessment'
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
  const isAlert = ALERT_STAGES.has(stage)

  const stations = SUBWAY_STATIONS.map((st, i) => {
    const inStation = st.stages.includes(stage)
    let status = 'upcoming'
    if (sentBack?.active) {
      const targetIdx = stationIndex(sentBack.target_station_id)
      const fromIdx = stationIndex(sentBack.from_station_id)
      if (st.id === sentBack.target_station_id) status = 'returned'
      else if (st.id === sentBack.from_station_id) status = 'returned_from'
      else if (i < Math.min(targetIdx, fromIdx)) status = 'complete'
      else status = 'upcoming'
    } else if (inStation) status = 'current'
    else if (i < currentIdx) status = 'complete'
    else status = 'upcoming'

    return {
      id: st.id,
      label: st.label,
      label_key: st.labelKey,
      status,
      workflow_stages: st.stages,
      current_substage: inStation ? stage : null,
    }
  })

  let pathVariant = 'normal'
  if (stage === 'implementation_report') pathVariant = 'complete'
  else if (sentBack?.active) pathVariant = 'returned'
  else if (isAlert) pathVariant = 'alert'

  let progressPercent = 0
  if (pathVariant === 'complete') progressPercent = 100
  else if (sentBack?.active) {
    progressPercent = Math.round((stationIndex(sentBack.target_station_id) + 0.35) / (SUBWAY_STATIONS.length - 1) * 100)
  } else {
    progressPercent = Math.round((currentIdx / (SUBWAY_STATIONS.length - 1)) * 100)
  }

  return {
    stations,
    current_stage: stage,
    current_station_id: currentStationId,
    current_station_index: currentIdx,
    path_variant: pathVariant,
    is_alert_state: isAlert,
    sent_back: sentBack,
    progress_percent: Math.min(100, Math.max(0, progressPercent)),
    station_order: SUBWAY_STATIONS.map((s) => s.id),
  }
}

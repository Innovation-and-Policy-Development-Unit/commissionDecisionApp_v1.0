import { useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Circle, RefreshCw, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import { stageLabel } from '../../constants/stages'
import {
  ALERT_STAGES,
  SUBWAY_STATIONS,
  stationIndexForStage,
  stagesForStation,
} from '../../constants/subwayStations'
import { buildSubwayMapFallback } from '../../constants/subwayMap'

function stationLabel(t, station) {
  const key = station.labelKey || station.label_key || `subway.${station.id}`
  const translated = t(key)
  return translated !== key ? translated : station.label || station.id
}

export default function SubmissionSubwayMap({
  currentStage,
  statusDetail,
  subwayMap: subwayMapProp,
  events = [],
  className,
  selectedStationId,
  onStationSelect,
}) {
  const { t } = useTranslation()

  const subwayMap = useMemo(() => {
    if (subwayMapProp?.stations?.length) return subwayMapProp
    return buildSubwayMapFallback(currentStage, events)
  }, [subwayMapProp, currentStage, events])

  const currentStationIndex = useMemo(() => {
    if (typeof subwayMap.current_station_index === 'number') return subwayMap.current_station_index
    return stationIndexForStage(currentStage)
  }, [subwayMap.current_station_index, currentStage])

  const isAlertState = useMemo(() => {
    if (subwayMap.is_alert_state != null) return subwayMap.is_alert_state
    return ALERT_STAGES.has(currentStage)
  }, [subwayMap.is_alert_state, currentStage])

  const pathVariant = subwayMap.path_variant || 'normal'
  const isReturnedPath = pathVariant === 'returned'
  const detailText = subwayMap.status_detail || statusDetail || (currentStage ? stageLabel(currentStage, t) : t('subway.in_progress'))

  const handleStationClick = useCallback((station) => {
    onStationSelect?.({
      stationId: station.id,
      stages: station.stages || station.workflow_stages || stagesForStation(station.id),
      label: stationLabel(t, station),
    })
    document.getElementById('audit-trail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [onStationSelect, t])

  const stations = useMemo(
    () => SUBWAY_STATIONS.map((def) => {
      const apiStation = subwayMap.stations?.find((s) => s.id === def.id)
      return { ...def, ...apiStation, stages: def.stages }
    }),
    [subwayMap.stations],
  )

  // Active line colour: amber on alert/returned, brand primary otherwise.
  const lineColor = isAlertState || isReturnedPath ? '#f59e0b' : 'rgb(var(--p-500))'
  const progressFraction = stations.length > 1 ? currentStationIndex / (stations.length - 1) : 0

  return (
    <section
      className={clsx(
        'w-full py-8 px-4 rounded-2xl border shadow-sm overflow-x-auto bg-white dark:bg-slate-900',
        isReturnedPath ? 'border-amber-300/80 dark:border-amber-700/50' : 'border-slate-100 dark:border-slate-800',
        className,
      )}
      aria-label={t('subway.aria_label')}
    >
      <div className="flex flex-wrap items-center gap-2 mb-6 px-2">
        <span className="font-semibold text-base text-slate-800 dark:text-slate-100">{t('subway.title')}</span>
        {pathVariant === 'returned' && (
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">{t('subway.returned_badge')}</span>
        )}
        {pathVariant === 'complete' && (
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{t('subway.complete_badge')}</span>
        )}
        {typeof subwayMap.progress_percent === 'number' && (
          <span className="ml-auto text-sm text-slate-400">{t('subway.progress_hint', { percent: Math.round(subwayMap.progress_percent) })}</span>
        )}
      </div>

      <div className="flex items-start justify-between min-w-[640px] relative px-4">
        <div className="absolute top-[18px] left-8 right-8 h-1 z-0 rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
        <div
          className="absolute top-[18px] left-8 h-1 z-0 transition-all duration-700 ease-in-out rounded-full"
          style={{ width: `calc((100% - 4rem) * ${progressFraction})`, backgroundColor: lineColor }}
          aria-hidden="true"
        />

        {stations.map((station, index) => {
          const isCompleted = index < currentStationIndex
          const isCurrent = index === currentStationIndex
          const isSelected = selectedStationId === station.id
          const showAlert = isCurrent && isAlertState
          const substages = station.stages?.map((code) => stageLabel(code, t)).slice(0, 5).join(' · ')
          const tip = [stationLabel(t, station), isCurrent ? detailText : null, substages, t('subway.click_logs')].filter(Boolean).join('\n')

          return (
            <div key={station.id} className="relative z-10 flex flex-col items-center flex-1 min-w-0">
              <button
                type="button"
                onClick={() => handleStationClick(station)}
                title={tip}
                className={clsx(
                  'group flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 rounded-lg',
                  isSelected && 'ring-2 ring-offset-2 ring-primary-500/60 rounded-xl',
                )}
                aria-current={isCurrent ? 'step' : undefined}
                aria-pressed={isSelected}
              >
                <div
                  className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm border-4',
                    isCompleted && 'bg-primary-500 text-white border-white dark:border-slate-900',
                    showAlert && 'bg-amber-500 text-white border-amber-100 dark:border-slate-900 animate-pulse',
                    isCurrent && !showAlert && 'scale-110 border-primary-500 text-primary-600 bg-white dark:bg-slate-900',
                    !isCompleted && !isCurrent && 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-300',
                  )}
                >
                  {isCompleted ? <CheckCircle2 size={22} />
                    : showAlert ? <AlertTriangle size={22} />
                    : isCurrent ? <RefreshCw size={22} className="animate-spin-slow" />
                    : <Circle size={20} />}
                </div>

                <div className="mt-3 text-center px-1">
                  <span className={clsx('uppercase tracking-wider block text-xs', isCurrent ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-400')}>
                    {stationLabel(t, station)}
                  </span>
                  {isCurrent && (
                    <div className="mt-1 w-36 mx-auto">
                      <span className={clsx('text-[10px] font-semibold block leading-tight text-center', showAlert ? 'text-amber-600 dark:text-amber-400' : 'text-primary-600 dark:text-primary-400')}>
                        {detailText}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

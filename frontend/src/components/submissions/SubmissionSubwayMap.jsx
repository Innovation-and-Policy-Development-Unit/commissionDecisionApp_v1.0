import { useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Text,
  Tooltip,
  tokens,
} from '@fluentui/react-components'
import {
  CheckmarkCircleFilled,
  CircleRegular,
  ArrowClockwiseRegular,
  WarningRegular,
} from '@fluentui/react-icons'
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
    if (typeof subwayMap.current_station_index === 'number') {
      return subwayMap.current_station_index
    }
    return stationIndexForStage(currentStage)
  }, [subwayMap.current_station_index, currentStage])

  const isAlertState = useMemo(() => {
    if (subwayMap.is_alert_state != null) return subwayMap.is_alert_state
    return ALERT_STAGES.has(currentStage)
  }, [subwayMap.is_alert_state, currentStage])

  const pathVariant = subwayMap.path_variant || 'normal'
  const isReturnedPath = pathVariant === 'returned'
  const detailText = statusDetail || (currentStage ? stageLabel(currentStage, t) : t('subway.in_progress'))

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

  const lineColor = isAlertState || isReturnedPath
    ? tokens.colorPaletteMarigoldBackground3
    : tokens.colorBrandBackground

  const progressFraction = stations.length > 1
    ? currentStationIndex / (stations.length - 1)
    : 0

  return (
    <section
      className={clsx(
        'w-full py-8 px-4 rounded-2xl border shadow-sm overflow-x-auto',
        'bg-white dark:bg-slate-900',
        isReturnedPath
          ? 'border-amber-300/80 dark:border-amber-700/50'
          : 'border-slate-100 dark:border-slate-800',
        className,
      )}
      aria-label={t('subway.aria_label')}
    >
      <div className="flex flex-wrap items-center gap-2 mb-6 px-2">
        <Text weight="semibold" size={400}>{t('subway.title')}</Text>
        {pathVariant === 'returned' && (
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            {t('subway.returned_badge')}
          </span>
        )}
        {pathVariant === 'complete' && (
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            {t('subway.complete_badge')}
          </span>
        )}
        {typeof subwayMap.progress_percent === 'number' && (
          <Text size={200} className="ml-auto" style={{ color: tokens.colorNeutralForeground3 }}>
            {t('subway.progress_hint', { percent: Math.round(subwayMap.progress_percent) })}
          </Text>
        )}
      </div>

      <div className="flex items-start justify-between min-w-[640px] relative px-4">
        <div
          className="absolute top-[18px] left-8 right-8 h-1 z-0 rounded-full"
          style={{ backgroundColor: tokens.colorNeutralStroke2 }}
          aria-hidden
        />
        <div
          className="absolute top-[18px] left-8 h-1 z-0 transition-all duration-700 ease-in-out rounded-full"
          style={{
            width: `calc((100% - 4rem) * ${progressFraction})`,
            backgroundColor: lineColor,
          }}
          aria-hidden
        />

        {stations.map((station, index) => {
          const isCompleted = index < currentStationIndex
          const isCurrent = index === currentStationIndex
          const isSelected = selectedStationId === station.id
          const showAlert = isCurrent && isAlertState
          const substages = station.stages?.map((code) => stageLabel(code, t)).slice(0, 5).join(' · ')

          return (
            <Tooltip
              key={station.id}
              content={(
                <div className="max-w-xs space-y-1">
                  <Text weight="semibold" size={200}>{stationLabel(t, station)}</Text>
                  {substages && (
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                      {substages}
                    </Text>
                  )}
                  <Text size={100} style={{ color: tokens.colorBrandForeground1 }}>
                    {t('subway.click_logs')}
                  </Text>
                </div>
              )}
              relationship="description"
            >
              <div className="relative z-10 flex flex-col items-center flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => handleStationClick(station)}
                  className={clsx(
                    'group flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-lg',
                    isSelected && 'ring-2 ring-offset-2 ring-primary-500/60 rounded-xl',
                  )}
                  style={{ '--tw-ring-color': tokens.colorBrandStroke1 }}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-pressed={isSelected}
                >
                  <div
                    className={clsx(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm border-4',
                      isCompleted && 'text-white border-white dark:border-slate-900',
                      showAlert && 'text-white border-amber-100 dark:border-slate-900 animate-pulse',
                      isCurrent && !showAlert && 'scale-110 border-primary-500 text-primary-600 bg-white dark:bg-slate-900',
                      !isCompleted && !isCurrent && 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-300',
                    )}
                    style={isCompleted ? { backgroundColor: tokens.colorBrandBackground } : undefined}
                  >
                    {isCompleted ? (
                      <CheckmarkCircleFilled fontSize={22} />
                    ) : showAlert ? (
                      <WarningRegular fontSize={22} />
                    ) : isCurrent ? (
                      <ArrowClockwiseRegular fontSize={22} className="animate-spin-slow" />
                    ) : (
                      <CircleRegular fontSize={20} />
                    )}
                  </div>

                  <div className="mt-3 text-center px-1">
                    <Text
                      weight={isCurrent ? 'bold' : 'medium'}
                      size={200}
                      className={clsx(
                        'uppercase tracking-wider block',
                        isCurrent ? 'text-slate-900 dark:text-white' : 'text-slate-400',
                      )}
                    >
                      {stationLabel(t, station)}
                    </Text>

                    {isCurrent && (
                      <div className="mt-1 w-28 mx-auto">
                        <Text
                          size={100}
                          className="text-primary-600 dark:text-primary-400 font-semibold block leading-tight"
                        >
                          {detailText}
                        </Text>
                      </div>
                    )}
                  </div>
                </button>
              </div>
            </Tooltip>
          )
        })}
      </div>
    </section>
  )
}

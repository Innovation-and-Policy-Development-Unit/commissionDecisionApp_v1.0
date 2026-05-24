import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ProgressBar,
  Tooltip,
  Text,
  Badge,
  tokens,
} from '@fluentui/react-components'
import {
  CheckmarkCircleFilled,
  CircleFilled,
  ArrowCircleDownFilled,
  WarningFilled,
} from '@fluentui/react-icons'
import clsx from 'clsx'
import { stageLabel } from '../../constants/stages'
import { buildSubwayMapFallback } from '../../constants/subwayMap'

function stationLabel(t, station) {
  const key = station.label_key || `subway.${station.id}`
  const translated = t(key)
  return translated !== key ? translated : station.label || station.id
}

function segmentStroke(status, pathVariant) {
  if (pathVariant === 'returned' && status === 'returned_segment') {
    return tokens.colorPaletteMarigoldBorderActive
  }
  if (status === 'complete') return tokens.colorBrandBackground
  if (status === 'partial') return tokens.colorBrandBackground2
  return tokens.colorNeutralStroke2
}

function StationNode({ station, label, selected, onSelect, pathVariant }) {
  const { status } = station
  const isReturned = status === 'returned'
  const isReturnedFrom = status === 'returned_from'
  const isCurrent = status === 'current'
  const isComplete = status === 'complete'

  let ring = tokens.colorNeutralStroke1
  let fill = tokens.colorNeutralBackground1
  let iconColor = tokens.colorNeutralForeground3

  if (isComplete) {
    ring = tokens.colorBrandStroke1
    fill = tokens.colorBrandBackground
    iconColor = tokens.colorNeutralForegroundOnBrand
  } else if (isReturned || (pathVariant === 'returned' && isReturnedFrom)) {
    ring = tokens.colorPaletteMarigoldBorderActive
    fill = tokens.colorPaletteMarigoldBackground2
    iconColor = tokens.colorPaletteMarigoldForeground2
  } else if (isCurrent) {
    ring = tokens.colorBrandStroke1
    fill = tokens.colorBrandBackground2
    iconColor = tokens.colorBrandForeground1
  } else if (isReturnedFrom) {
    ring = tokens.colorPaletteMarigoldBorderActive
    fill = tokens.colorPaletteMarigoldBackground1
    iconColor = tokens.colorPaletteMarigoldForeground1
  }

  const content = (
    <button
      type="button"
      onClick={() => onSelect(station.id)}
      className={clsx(
        'group flex flex-col items-center gap-1.5 rounded-lg px-1 py-2 transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        selected && 'bg-slate-50 dark:bg-slate-800/60',
      )}
      style={{
        // Fluent focus ring color
        '--tw-ring-color': tokens.colorBrandStroke1,
      }}
      aria-pressed={selected}
      aria-current={isCurrent || isReturned ? 'step' : undefined}
    >
      <span
        className={clsx(
          'relative flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-bold shadow-sm transition-transform',
          (isCurrent || isReturned) && 'scale-110',
          'group-hover:scale-105',
        )}
        style={{
          borderColor: ring,
          backgroundColor: fill,
          color: iconColor,
        }}
      >
        {isComplete ? (
          <CheckmarkCircleFilled className="h-6 w-6" style={{ color: iconColor }} />
        ) : isReturned ? (
          <WarningFilled className="h-6 w-6" style={{ color: iconColor }} />
        ) : isReturnedFrom ? (
          <ArrowCircleDownFilled className="h-6 w-6" style={{ color: iconColor }} />
        ) : (
          <CircleFilled className="h-5 w-5 opacity-80" style={{ color: iconColor }} />
        )}
        {(isCurrent || isReturned) && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-25"
            style={{ backgroundColor: isReturned ? tokens.colorPaletteMarigoldBackground3 : tokens.colorBrandBackground }}
            aria-hidden="true"
          />
        )}
      </span>
      <Text
        size={200}
        weight={isCurrent || isReturned ? 'semibold' : 'regular'}
        align="center"
        className="max-w-[5.5rem] leading-tight"
        style={{
          color: isReturned
            ? tokens.colorPaletteMarigoldForeground2
            : isCurrent
              ? tokens.colorBrandForeground1
              : tokens.colorNeutralForeground2,
        }}
      >
        {label}
      </Text>
      {station.current_substage && (
        <Text
          size={100}
          align="center"
          className="max-w-[6.5rem] truncate italic"
          style={{ color: tokens.colorNeutralForeground3 }}
        >
          {stageLabel(station.current_substage)}
        </Text>
      )}
    </button>
  )

  const substages = station.workflow_stages
    ?.map(code => stageLabel(code))
    .slice(0, 6)
    .join(' · ')

  return (
    <Tooltip
      content={(
        <div className="max-w-xs space-y-1 p-0.5">
          <Text weight="semibold" size={200}>{label}</Text>
          {substages && (
            <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
              {substages}
            </Text>
          )}
        </div>
      )}
      relationship="description"
    >
      {content}
    </Tooltip>
  )
}

function SubwaySvgTrack({ stations, pathVariant, sentBack }) {
  const n = stations.length
  if (n < 2) return null

  const segments = []
  for (let i = 0; i < n - 1; i += 1) {
    const left = stations[i]
    const right = stations[i + 1]
    let segStatus = 'upcoming'

    if (pathVariant === 'returned' && sentBack?.active) {
      const fromIdx = stations.findIndex(s => s.id === sentBack.from_station_id)
      const targetIdx = stations.findIndex(s => s.id === sentBack.target_station_id)
      const lo = Math.min(fromIdx, targetIdx)
      const hi = Math.max(fromIdx, targetIdx)
      if (i < lo) segStatus = 'complete'
      else if (i >= lo && i < hi) segStatus = 'returned_segment'
      else if (left.status === 'complete') segStatus = 'complete'
    } else {
      if (left.status === 'complete' && right.status !== 'upcoming') segStatus = 'complete'
      else if (left.status === 'complete') segStatus = 'partial'
      else if (left.status === 'current') segStatus = 'partial'
    }

    const x1 = ((i + 0.5) / n) * 100
    const x2 = ((i + 1.5) / n) * 100
    const y = 28
    const dash = segStatus === 'returned_segment' ? '6 4' : undefined

    segments.push(
      <line
        key={`${left.id}-${right.id}`}
        x1={`${x1}%`}
        y1={y}
        x2={`${x2}%`}
        y2={y}
        stroke={segmentStroke(segStatus, pathVariant)}
        strokeWidth={segStatus === 'returned_segment' ? 3 : 2}
        strokeDasharray={dash}
        strokeLinecap="round"
        className="transition-all duration-500"
      />,
    )
  }

  return (
    <svg
      className="absolute left-0 right-0 top-0 h-14 w-full pointer-events-none"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {segments}
    </svg>
  )
}

export default function SubmissionSubwayMap({
  subwayMap: subwayMapProp,
  currentStage,
  events = [],
  className,
  compact = false,
}) {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState(null)

  const subwayMap = useMemo(() => {
    if (subwayMapProp?.stations?.length) return subwayMapProp
    return buildSubwayMapFallback(currentStage, events)
  }, [subwayMapProp, currentStage, events])

  const stations = subwayMap.stations || []
  const pathVariant = subwayMap.path_variant || 'normal'
  const sentBack = subwayMap.sent_back
  const progress = subwayMap.progress_percent ?? 0
  const activeId = selectedId || subwayMap.current_station_id

  if (currentStage === 'draft') {
    return null
  }

  const selectedStation = stations.find(s => s.id === activeId)

  return (
    <section
      className={clsx(
        'rounded-xl border bg-[var(--colorNeutralBackground1)] dark:bg-slate-900/40',
        pathVariant === 'returned'
          ? 'border-amber-300/80 dark:border-amber-700/50'
          : 'border-slate-200 dark:border-slate-700',
        className,
      )}
      aria-label={t('subway.aria_label')}
    >
      <div className={clsx('px-4 pt-4', compact ? 'pb-3' : 'pb-2')}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Text weight="semibold" size={300}>{t('subway.title')}</Text>
          {pathVariant === 'returned' && sentBack?.active && (
            <Badge appearance="filled" color="warning" size="small">
              {t('subway.returned_badge')}
            </Badge>
          )}
          {pathVariant === 'complete' && (
            <Badge appearance="filled" color="success" size="small">
              {t('subway.complete_badge')}
            </Badge>
          )}
          <Text size={200} className="ml-auto" style={{ color: tokens.colorNeutralForeground3 }}>
            {stageLabel(subwayMap.current_stage, t)}
          </Text>
        </div>

        <ProgressBar
          value={progress}
          max={100}
          thickness="medium"
          color={pathVariant === 'returned' ? 'warning' : pathVariant === 'complete' ? 'success' : 'brand'}
          className="mb-1"
        />
        <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
          {t('subway.progress_hint', { percent: Math.round(progress) })}
        </Text>
      </div>

      <div className={clsx('relative px-2 sm:px-4', compact ? 'pb-3' : 'pb-4')}>
        <SubwaySvgTrack stations={stations} pathVariant={pathVariant} sentBack={sentBack} />
        <div className="relative z-10 grid grid-cols-4 gap-1 sm:gap-2 pt-1">
          {stations.map(station => (
            <StationNode
              key={station.id}
              station={station}
              label={stationLabel(t, station)}
              selected={activeId === station.id}
              onSelect={setSelectedId}
              pathVariant={pathVariant}
            />
          ))}
        </div>
      </div>

      {pathVariant === 'returned' && sentBack?.active && (
        <div
          className="mx-4 mb-4 rounded-lg px-3 py-2.5 text-sm"
          style={{
            backgroundColor: tokens.colorPaletteMarigoldBackground1,
            color: tokens.colorPaletteMarigoldForeground1,
            borderLeft: `4px solid ${tokens.colorPaletteMarigoldBorderActive}`,
          }}
        >
          <Text weight="semibold" size={200}>{t('subway.returned_title')}</Text>
          <Text size={200} className="mt-1 block">
            {t('subway.returned_body', {
              stage: stageLabel(sentBack.reason_stage, t),
              station: stationLabel(t, { id: sentBack.target_station_id, label_key: `subway.${sentBack.target_station_id}` }),
            })}
          </Text>
        </div>
      )}

      {selectedStation && !compact && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3">
          <Text size={200} weight="semibold" className="mb-2 block">
            {t('subway.station_detail', { station: stationLabel(t, selectedStation) })}
          </Text>
          <ul className="flex flex-wrap gap-1.5">
            {selectedStation.workflow_stages?.map(code => {
              const isHere = code === subwayMap.current_stage
              return (
                <li key={code}>
                  <Badge
                    appearance={isHere ? 'filled' : 'outline'}
                    color={isHere ? (pathVariant === 'returned' ? 'warning' : 'brand') : 'informative'}
                    size="small"
                  >
                    {stageLabel(code, t)}
                  </Badge>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import {
  BarChart3, BarChartHorizontal, LineChart, AreaChart, PieChart, Table, Hash, Play, X,
} from 'lucide-react'

const CHART_TYPES = [
  { key: 'column', icon: BarChart3 },
  { key: 'bar', icon: BarChartHorizontal },
  { key: 'line', icon: LineChart },
  { key: 'area', icon: AreaChart },
  { key: 'pie', icon: PieChart },
  { key: 'table', icon: Table },
  { key: 'number', icon: Hash },
]
const TIME_GRAINS = ['day', 'week', 'month', 'quarter', 'year']
const FILTER_OPS = ['=', '!=', 'in', 'contains', 'gte', 'lte']

function readItem(e) {
  try { return JSON.parse(e.dataTransfer.getData('application/json')) } catch { return null }
}

function DropZone({ hint, accept, onDrop, children }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false)
        const it = readItem(e)
        if (it && (!accept || accept.includes(it.role))) onDrop(it)
      }}
      className={clsx(
        'min-h-[42px] rounded-lg border border-dashed p-1.5 space-y-1 transition-colors',
        over ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-900/20' : 'border-slate-300 dark:border-slate-600',
      )}
    >
      {children}
      <div className="text-xs text-slate-400 px-1">{hint}</div>
    </div>
  )
}

function Pill({ label, onRemove, children }) {
  return (
    <div className="flex items-center gap-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 text-sm">
      <button type="button" onClick={onRemove} className="text-slate-400 hover:text-red-500"><X size={13} /></button>
      <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {children}
    </div>
  )
}

export default function QueryBuilder({ datasetDef, spec, onChange, onRun, busy }) {
  const { t } = useTranslation()
  if (!datasetDef) return null

  const dims = datasetDef.dimensions || []
  const tdims = datasetDef.time_dimensions || []
  const metrics = datasetDef.metrics || []
  const dimLabel = Object.fromEntries([...dims, ...tdims].map(d => [d.key, d.label]))
  const metricLabel = Object.fromEntries(metrics.map(m => [m.key, m.label]))
  const timeKeys = new Set(tdims.map(d => d.key))
  const isTimeX = timeKeys.has(spec.x?.dimension)

  const patch = (next) => onChange({ ...spec, ...next })

  // X-axis (single)
  const setX = (item) => patch({ x: { dimension: item.key, time_grain: spec.x?.time_grain || 'month' } })
  const clearX = () => patch({ x: { dimension: '', time_grain: spec.x?.time_grain || 'month' } })

  // Metrics (multiple)
  const addMetric = (item) => {
    if ((spec.metrics || []).some(m => m.key === item.key)) return
    patch({ metrics: [...(spec.metrics || []), { key: item.key }] })
  }
  const removeMetric = (k) => patch({ metrics: (spec.metrics || []).filter(m => m.key !== k) })

  // Dimensions / breakdown (multiple, categories only)
  const addDim = (item) => {
    if (item.role === 'time') return
    if ((spec.dimensions || []).includes(item.key) || item.key === spec.x?.dimension) return
    patch({ dimensions: [...(spec.dimensions || []), item.key] })
  }
  const removeDim = (k) => patch({ dimensions: (spec.dimensions || []).filter(d => d !== k) })

  // Filters (multiple)
  const addFilter = (item) => patch({ filters: [...(spec.filters || []), { col: item.key, op: '=', val: '' }] })
  const updateFilter = (i, key, val) => patch({ filters: (spec.filters || []).map((f, idx) => idx === i ? { ...f, [key]: val } : f) })
  const removeFilter = (i) => patch({ filters: (spec.filters || []).filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-4">
      {/* X-axis */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('intelligence.x_axis')}</label>
        <DropZone hint={t('intelligence.drop_x')} accept={['dimension', 'time']} onDrop={setX}>
          {spec.x?.dimension && <Pill label={dimLabel[spec.x.dimension] || spec.x.dimension} onRemove={clearX} />}
        </DropZone>
      </div>

      {isTimeX && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('intelligence.time_grain')}</label>
          <select className="input w-full" value={spec.x?.time_grain || 'month'}
            onChange={(e) => patch({ x: { ...spec.x, time_grain: e.target.value } })}>
            {TIME_GRAINS.map(g => <option key={g} value={g}>{t(`intelligence.grain_${g}`)}</option>)}
          </select>
        </div>
      )}

      {/* Metrics */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('intelligence.metrics')}</label>
        <DropZone hint={t('intelligence.drop_metrics')} accept={['metric']} onDrop={addMetric}>
          {(spec.metrics || []).map(m => (
            <Pill key={m.key} label={metricLabel[m.key] || m.key} onRemove={() => removeMetric(m.key)} />
          ))}
        </DropZone>
      </div>

      {/* Dimensions */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('intelligence.dimensions')}</label>
        <DropZone hint={t('intelligence.drop_dimensions')} accept={['dimension']} onDrop={addDim}>
          {(spec.dimensions || []).map(d => (
            <Pill key={d} label={dimLabel[d] || d} onRemove={() => removeDim(d)} />
          ))}
        </DropZone>
      </div>

      {/* Filters */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('intelligence.filters')}</label>
        <DropZone hint={t('intelligence.drop_filters')} accept={['dimension', 'time']} onDrop={addFilter}>
          {(spec.filters || []).map((f, i) => (
            <Pill key={i} label={dimLabel[f.col] || f.col} onRemove={() => removeFilter(i)}>
              <select className="input !py-0.5 !px-1 text-xs" value={f.op} onChange={(e) => updateFilter(i, 'op', e.target.value)}>
                {FILTER_OPS.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
              <input className="input !py-0.5 !px-1 text-xs w-24" placeholder={t('intelligence.value')}
                value={f.val} onChange={(e) => updateFilter(i, 'val', e.target.value)} />
            </Pill>
          ))}
        </DropZone>
      </div>

      {/* Chart type */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('intelligence.chart_type')}</label>
        <div className="flex flex-wrap gap-1">
          {CHART_TYPES.map(({ key, icon: Icon }) => (
            <button key={key} type="button" title={t(`intelligence.chart_${key}`)} onClick={() => patch({ chart_type: key })}
              className={clsx('p-2 rounded-lg border transition-colors',
                spec.chart_type === key
                  ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50')}>
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="btn-primary w-full flex items-center justify-center gap-2" onClick={onRun} disabled={busy}>
        <Play size={15} /> {t('intelligence.update_chart')}
      </button>
    </div>
  )
}

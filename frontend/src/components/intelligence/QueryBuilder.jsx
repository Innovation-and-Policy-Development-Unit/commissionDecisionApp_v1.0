import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { BarChart3, BarChartHorizontal, LineChart, AreaChart, PieChart, Table, Hash, Play } from 'lucide-react'

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

export default function QueryBuilder({ datasetDef, spec, onChange, onRun, busy }) {
  const { t } = useTranslation()
  if (!datasetDef) return null

  const dims = datasetDef.dimensions || []
  const tdims = datasetDef.time_dimensions || []
  const metrics = datasetDef.metrics || []
  const isTimeX = tdims.some(d => d.key === spec.x?.dimension)

  const patch = (next) => onChange({ ...spec, ...next })

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">{t('intelligence.x_axis')}</label>
        <select
          className="input w-full"
          value={spec.x?.dimension || ''}
          onChange={(e) => patch({ x: { ...spec.x, dimension: e.target.value } })}
        >
          <option value="">{t('intelligence.none')}</option>
          <optgroup label={t('intelligence.time')}>
            {tdims.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </optgroup>
          <optgroup label={t('intelligence.categories')}>
            {dims.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </optgroup>
        </select>
      </div>

      {isTimeX && (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">{t('intelligence.time_grain')}</label>
          <select
            className="input w-full"
            value={spec.x?.time_grain || 'month'}
            onChange={(e) => patch({ x: { ...spec.x, time_grain: e.target.value } })}
          >
            {TIME_GRAINS.map(g => <option key={g} value={g}>{t(`intelligence.grain_${g}`)}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">{t('intelligence.breakdown')}</label>
        <select
          className="input w-full"
          value={spec.dimensions?.[0] || ''}
          onChange={(e) => patch({ dimensions: e.target.value ? [e.target.value] : [] })}
        >
          <option value="">{t('intelligence.none')}</option>
          {dims.filter(d => d.key !== spec.x?.dimension).map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">{t('intelligence.metric')}</label>
        <select
          className="input w-full"
          value={spec.metrics?.[0]?.key || 'count'}
          onChange={(e) => patch({ metrics: [{ key: e.target.value }] })}
        >
          {metrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">{t('intelligence.chart_type')}</label>
        <div className="flex flex-wrap gap-1">
          {CHART_TYPES.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              title={t(`intelligence.chart_${key}`)}
              onClick={() => patch({ chart_type: key })}
              className={clsx(
                'p-2 rounded-lg border transition-colors',
                spec.chart_type === key
                  ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50',
              )}
            >
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

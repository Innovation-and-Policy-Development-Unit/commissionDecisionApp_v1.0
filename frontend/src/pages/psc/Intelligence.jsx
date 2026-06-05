import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Clock, Rows3, Hash, Tag, CalendarClock } from 'lucide-react'
import clsx from 'clsx'
import { intelligenceApi } from '../../api/intelligence'
import { useToast } from '../../context/ToastContext'
import PageHeader from '../../components/shared/PageHeader'
import QueryBuilder from '../../components/intelligence/QueryBuilder'
import ExplorerChart from '../../components/intelligence/ExplorerChart'
import ResultsGrid from '../../components/intelligence/ResultsGrid'

const DEFAULT_SPEC = {
  x: { dimension: '', time_grain: 'month' },
  dimensions: [],
  metrics: [{ key: 'count' }],
  filters: [],
  chart_type: 'column',
  sort: { by: 'count', dir: 'desc' },
  row_limit: 1000,
}

// Normalise UI spec → API spec (split "in" values, drop empty filters).
function normalize(spec) {
  return {
    ...spec,
    filters: (spec.filters || [])
      .filter(f => f.val !== '' && f.val != null)
      .map(f => f.op === 'in'
        ? { ...f, val: String(f.val).split(',').map(s => s.trim()).filter(Boolean) }
        : f),
  }
}

function FieldChip({ item, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/json', JSON.stringify(item))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={onClick}
      className="w-full flex items-center gap-2 text-left text-sm px-2 py-1.5 rounded-md cursor-grab border border-transparent hover:border-slate-200 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300"
      title={item.label}
    >
      <Icon size={14} className="text-slate-400 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  )
}

export default function Intelligence() {
  const { t } = useTranslation()
  const toast = useToast()

  const [datasets, setDatasets] = useState([])
  const [datasetKey, setDatasetKey] = useState('')
  const [spec, setSpec] = useState(DEFAULT_SPEC)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('chart')

  const datasetDef = datasets.find(d => d.key === datasetKey)

  const runQuery = useCallback(async (key, useSpec) => {
    if (!key || !useSpec?.x?.dimension) return
    setLoading(true)
    try {
      setResult(await intelligenceApi.query(key, normalize(useSpec)))
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('intelligence.query_failed'))
    } finally {
      setLoading(false)
    }
  }, [t, toast])

  useEffect(() => {
    intelligenceApi.datasets().then(d => {
      const ds = d.datasets || []
      setDatasets(ds)
      if (ds[0]) {
        const first = ds[0]
        const x = first.time_dimensions?.[0]?.key || first.dimensions?.[0]?.key || ''
        const initial = { ...DEFAULT_SPEC, x: { dimension: x, time_grain: 'month' } }
        setDatasetKey(first.key)
        setSpec(initial)
        runQuery(first.key, initial)
      }
    }).catch(() => {})
  }, [runQuery])

  const changeDataset = (key) => {
    const def = datasets.find(d => d.key === key)
    const x = def?.time_dimensions?.[0]?.key || def?.dimensions?.[0]?.key || ''
    const initial = { ...DEFAULT_SPEC, x: { dimension: x, time_grain: 'month' } }
    setDatasetKey(key)
    setSpec(initial)
    runQuery(key, initial)
  }

  const addMetric = (item) => setSpec(s =>
    (s.metrics || []).some(m => m.key === item.key) ? s : { ...s, metrics: [...(s.metrics || []), { key: item.key }] })
  const setX = (item) => setSpec(s => ({ ...s, x: { ...s.x, dimension: item.key } }))

  return (
    <div className="max-w-screen-2xl mx-auto space-y-4 pb-10">
      <PageHeader title={t('intelligence.title')} subtitle={t('intelligence.subtitle')} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: dataset + draggable fields */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card p-3">
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t('intelligence.dataset')}</label>
            <select className="input w-full" value={datasetKey} onChange={(e) => changeDataset(e.target.value)}>
              {datasets.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>

          <div className="card p-3">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">{t('intelligence.metrics')}</div>
            <div className="space-y-1 mb-3">
              {(datasetDef?.metrics || []).map(m => (
                <FieldChip key={m.key} item={{ role: 'metric', key: m.key, label: m.label }} icon={Hash}
                  onClick={() => addMetric({ key: m.key })} />
              ))}
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">{t('intelligence.columns')}</div>
            <div className="space-y-1 max-h-[360px] overflow-auto">
              {(datasetDef?.time_dimensions || []).map(d => (
                <FieldChip key={d.key} item={{ role: 'time', key: d.key, label: d.label }} icon={CalendarClock}
                  onClick={() => setX({ key: d.key })} />
              ))}
              {(datasetDef?.dimensions || []).map(d => (
                <FieldChip key={d.key} item={{ role: 'dimension', key: d.key, label: d.label }} icon={Tag}
                  onClick={() => setX({ key: d.key })} />
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">{t('intelligence.drag_hint')}</p>
          </div>
        </div>

        {/* Middle: query builder */}
        <div className="lg:col-span-3">
          <div className="card p-4">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">{t('intelligence.query')}</div>
            <QueryBuilder
              datasetDef={datasetDef}
              spec={spec}
              onChange={setSpec}
              onRun={() => runQuery(datasetKey, spec)}
              busy={loading}
            />
          </div>
        </div>

        {/* Right: chart + results */}
        <div className="lg:col-span-6">
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
              <div className="flex gap-1">
                <button onClick={() => setTab('chart')} className={clsx('px-3 py-1.5 text-sm rounded-lg', tab === 'chart' ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200' : 'text-slate-500')}>{t('intelligence.tab_chart')}</button>
                <button onClick={() => setTab('results')} className={clsx('px-3 py-1.5 text-sm rounded-lg', tab === 'results' ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200' : 'text-slate-500')}>{t('intelligence.tab_results')}</button>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                {result?.meta && (
                  <>
                    <span className="flex items-center gap-1"><Rows3 size={13} /> {result.meta.row_count}</span>
                    {result.meta.ms != null && <span className="flex items-center gap-1"><Clock size={13} /> {result.meta.ms} ms</span>}
                  </>
                )}
                {loading && <Loader2 size={15} className="animate-spin text-primary-500" />}
              </div>
            </div>
            <div className="p-4" style={{ height: '60vh' }}>
              {tab === 'chart'
                ? <ExplorerChart result={result} chartType={spec.chart_type} />
                : <ResultsGrid result={result} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

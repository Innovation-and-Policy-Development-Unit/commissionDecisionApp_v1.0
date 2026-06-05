import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Send, Database, Loader2, Clock, Rows3 } from 'lucide-react'
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

export default function Intelligence() {
  const { t } = useTranslation()
  const toast = useToast()

  const [datasets, setDatasets] = useState([])
  const [datasetKey, setDatasetKey] = useState('')
  const [spec, setSpec] = useState(DEFAULT_SPEC)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [tab, setTab] = useState('chart')

  const datasetDef = datasets.find(d => d.key === datasetKey)

  const runQuery = useCallback(async (key, useSpec) => {
    if (!key || !useSpec?.x?.dimension) return
    setLoading(true)
    try {
      setResult(await intelligenceApi.query(key, useSpec))
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

  const handleAsk = async () => {
    if (!prompt.trim() || !datasetKey) return
    setLoading(true)
    try {
      const { query_spec } = await intelligenceApi.interpret(datasetKey, prompt.trim())
      const merged = { ...DEFAULT_SPEC, ...query_spec }
      setSpec(merged)
      await runQuery(datasetKey, merged)
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('intelligence.ask_failed'))
    } finally {
      setLoading(false)
    }
  }

  const setX = (key) => {
    const next = { ...spec, x: { ...spec.x, dimension: key } }
    setSpec(next)
    runQuery(datasetKey, next)
  }

  const columns = [...(datasetDef?.time_dimensions || []), ...(datasetDef?.dimensions || [])]

  return (
    <div className="max-w-screen-2xl mx-auto space-y-4 pb-10">
      <PageHeader title={t('intelligence.title')} subtitle={t('intelligence.subtitle')} />

      {/* Ask box */}
      <div className="card p-4 flex items-center gap-3">
        <Sparkles size={18} className="text-primary-500 shrink-0" />
        <input
          className="input flex-1"
          placeholder={t('intelligence.ask_placeholder')}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
        />
        <button className="btn-primary flex items-center gap-2" onClick={handleAsk} disabled={loading}>
          <Send size={16} /> {t('intelligence.ask')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: dataset + fields */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card p-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('intelligence.dataset')}</label>
            <select className="input w-full" value={datasetKey} onChange={(e) => changeDataset(e.target.value)}>
              {datasets.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
          <div className="card p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase mb-2">
              <Database size={14} /> {t('intelligence.columns')}
            </div>
            <div className="space-y-1 max-h-[420px] overflow-auto">
              {columns.map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setX(c.key)}
                  className={clsx(
                    'w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors',
                    spec.x?.dimension === c.key
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300',
                  )}
                >
                  {c.label}
                  {c.kind === 'time' && <span className="text-[10px] text-slate-400 ml-1">({t('intelligence.time')})</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Middle: query builder */}
        <div className="lg:col-span-3">
          <div className="card p-4">
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

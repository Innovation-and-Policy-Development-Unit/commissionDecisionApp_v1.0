import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Clock, Rows3, Hash, Tag, CalendarClock, Download, ImageDown, Link2, Bookmark, Trash2, Share2 } from 'lucide-react'
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

// Build a CSV string from a query result ({columns, rows}) and trigger a download.
function exportResultCsv(result, datasetKey) {
  const cols = result?.columns || []
  const rows = result?.rows || []
  if (!cols.length || !rows.length) return
  const esc = (v) => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = cols.map(c => esc(c.label)).join(',')
  const lines = rows.map(r => cols.map(c => esc(r[c.key])).join(','))
  const csv = [header, ...lines].join('\r\n')

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `scdms-intelligence-${datasetKey || 'export'}-${stamp}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Rasterise the Recharts SVG to a PNG and trigger a download.
function exportChartPng(containerEl, datasetKey) {
  const svg = containerEl?.querySelector('svg')
  if (!svg) return
  const rect = svg.getBoundingClientRect()
  const w = Math.max(1, Math.round(rect.width))
  const h = Math.max(1, Math.round(rect.height))
  const clone = svg.cloneNode(true)
  clone.setAttribute('width', w)
  clone.setAttribute('height', h)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.style.fontFamily = getComputedStyle(svg).fontFamily || 'sans-serif'
  const xml = new XMLSerializer().serializeToString(clone)
  // data: URI — allowed by img-src in the app CSP.
  const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
  const img = new Image()
  img.onload = () => {
    const scale = 2 // crisp on retina / for slide decks
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `scdms-intelligence-${datasetKey || 'chart'}-${stamp}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }
  img.src = svgUrl
}

// Encode/decode the explorer state for shareable links (unicode-safe base64).
function encodeSpec(spec) {
  try { return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(spec))))) }
  catch { return '' }
}
function decodeSpec(raw) {
  try { return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(raw))))) }
  catch { return null }
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
  const [explorations, setExplorations] = useState([])
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const chartRef = useRef(null)

  const datasetDef = datasets.find(d => d.key === datasetKey)

  const runQuery = useCallback(async (key, useSpec) => {
    if (!key || !useSpec?.x?.dimension) return
    setLoading(true)
    try {
      setResult(await intelligenceApi.query(key, normalize(useSpec)))
      // Reflect the run state in the URL so a refresh — or a copied link — restores it.
      const p = new URLSearchParams({ ds: key, q: encodeSpec(useSpec) })
      window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`)
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
      if (!ds.length) return
      // Restore a shared exploration from the URL when present and valid.
      const params = new URLSearchParams(window.location.search)
      const urlDs = params.get('ds')
      const urlSpec = decodeSpec(params.get('q'))
      if (urlDs && urlSpec?.x?.dimension && ds.some(x => x.key === urlDs)) {
        setDatasetKey(urlDs)
        setSpec(urlSpec)
        runQuery(urlDs, urlSpec)
        return
      }
      const first = ds[0]
      const x = first.time_dimensions?.[0]?.key || first.dimensions?.[0]?.key || ''
      const initial = { ...DEFAULT_SPEC, x: { dimension: x, time_grain: 'month' } }
      setDatasetKey(first.key)
      setSpec(initial)
      runQuery(first.key, initial)
    }).catch(() => {})
  }, [runQuery])

  // ── Saved explorations ────────────────────────────────────────────────────
  const loadExplorations = useCallback(async () => {
    try {
      const d = await intelligenceApi.explorations()
      setExplorations(d.explorations || [])
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => { loadExplorations() }, [loadExplorations])

  const saveCurrent = async () => {
    const name = saveName.trim()
    if (!name || !datasetKey) return
    setSaving(true)
    try {
      await intelligenceApi.saveExploration({ name, dataset: datasetKey, spec, is_shared: false })
      setSaveName('')
      toast.success(t('intelligence.saved', { defaultValue: 'Exploration saved' }))
      loadExplorations()
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('intelligence.save_failed', { defaultValue: 'Could not save the exploration' }))
    } finally {
      setSaving(false)
    }
  }

  const openExploration = (e) => {
    if (!e?.spec?.x?.dimension || !datasets.some(d => d.key === e.dataset)) return
    setDatasetKey(e.dataset)
    setSpec(e.spec)
    runQuery(e.dataset, e.spec)
  }

  const removeExploration = async (id, ev) => {
    ev.stopPropagation()
    try {
      await intelligenceApi.deleteExploration(id)
      loadExplorations()
    } catch {
      toast.error(t('intelligence.delete_failed', { defaultValue: 'Could not delete the exploration' }))
    }
  }

  const copyShareLink = useCallback(async () => {
    const p = new URLSearchParams({ ds: datasetKey, q: encodeSpec(spec) })
    const url = `${window.location.origin}${window.location.pathname}?${p.toString()}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('intelligence.link_copied', { defaultValue: 'Link copied to clipboard' }))
    } catch {
      toast.error(t('intelligence.link_copy_failed', { defaultValue: 'Could not copy the link' }))
    }
  }, [datasetKey, spec, toast, t])

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

          {/* Saved explorations */}
          <div className="card p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase mb-2">
              <Bookmark size={13} /> {t('intelligence.saved_title', { defaultValue: 'Saved explorations' })}
            </div>
            <div className="space-y-0.5 max-h-44 overflow-auto mb-2">
              {explorations.length === 0 && (
                <p className="text-[11px] text-slate-400 italic px-1 py-2">
                  {t('intelligence.no_saved', { defaultValue: 'None saved yet — save the current view below.' })}
                </p>
              )}
              {explorations.map(e => (
                <div
                  key={e.id}
                  onClick={() => openExploration(e)}
                  title={e.is_owner ? e.name : `${e.name} · ${e.owner_name}`}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <span className="truncate flex-1">{e.name}</span>
                  {e.is_shared && <Share2 size={11} className="text-primary-500 shrink-0" title="Shared" />}
                  {e.is_owner && (
                    <button
                      type="button"
                      onClick={(ev) => removeExploration(e.id, ev)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveCurrent() }}
                placeholder={t('intelligence.save_placeholder', { defaultValue: 'Name this view' })}
                className="input flex-1 text-xs py-1.5"
              />
              <button
                type="button"
                onClick={saveCurrent}
                disabled={!saveName.trim() || !datasetKey || saving}
                className="btn-primary px-2.5 py-1.5 text-xs disabled:opacity-40 shrink-0"
              >
                {t('intelligence.save', { defaultValue: 'Save' })}
              </button>
            </div>
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
                <button
                  type="button"
                  onClick={copyShareLink}
                  disabled={!datasetKey}
                  title={t('intelligence.copy_link', { defaultValue: 'Copy shareable link' })}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Link2 size={13} />
                  <span className="hidden md:inline">{t('intelligence.copy_link', { defaultValue: 'Copy link' })}</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportChartPng(chartRef.current, datasetKey)}
                  disabled={tab !== 'chart' || !result?.rows?.length}
                  title={t('intelligence.export_png', { defaultValue: 'Export chart as PNG' })}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ImageDown size={13} />
                  <span className="hidden md:inline">PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportResultCsv(result, datasetKey)}
                  disabled={!result?.rows?.length}
                  title={t('intelligence.export_csv', { defaultValue: 'Export CSV' })}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Download size={13} />
                  <span className="hidden md:inline">CSV</span>
                </button>
              </div>
            </div>
            <div ref={chartRef} className="p-4" style={{ height: '60vh' }}>
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

/**
 * Dashboards — composed boards of SCDMS Intelligence chart tiles.
 *
 *   /intelligence/dashboards        → list (own + shared), create, delete
 *   /intelligence/dashboards/:id    → live board
 *
 * Phase-A interactivity:
 *   • Native filters — a filter bar (category dims + relative time range) that
 *     scopes every tile whose dataset has the column.
 *   • Cross-filtering — click a chart element to filter the whole board.
 *   • Drill — per-tile "break down by" re-pivots a tile's X dimension live.
 *   • Auto-refresh — periodic re-query of all tiles.
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Plus, Trash2, Share2, RefreshCw, ArrowLeft, Compass,
  ChevronLeft, ChevronRight, Maximize2, Minimize2, Pencil, Check, Loader2, Lock,
  Filter, X, Layers, CalendarClock,
} from 'lucide-react'
import { intelligenceApi } from '../../api/intelligence'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import PageHeader from '../../components/shared/PageHeader'
import DashboardTile from '../../components/intelligence/DashboardTile'

// ── Relative time ranges ──────────────────────────────────────────────────────
const TIME_RANGES = [
  { value: '', label: 'All time' },
  { value: 'last_7', label: 'Last 7 days' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'last_90', label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'this_year', label: 'This year' },
  { value: 'last_year', label: 'Last year' },
]
const REFRESH_OPTS = [
  { value: 0, label: 'Off' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '1m' },
  { value: 300000, label: '5m' },
]

function computeRange(value) {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  // Date-only bounds — accepted by both Django DateField and DateTimeField filters.
  const day = (x) => x.toISOString().slice(0, 10)
  const from = day
  const to = day
  const start = new Date(d)
  if (value === 'last_7') { start.setDate(start.getDate() - 6); return { from: from(start), to: to(d) } }
  if (value === 'last_30') { start.setDate(start.getDate() - 29); return { from: from(start), to: to(d) } }
  if (value === 'last_90') { start.setDate(start.getDate() - 89); return { from: from(start), to: to(d) } }
  if (value === 'this_month') return { from: from(new Date(d.getFullYear(), d.getMonth(), 1)), to: to(d) }
  if (value === 'this_year') return { from: from(new Date(d.getFullYear(), 0, 1)), to: to(d) }
  if (value === 'last_year') return { from: from(new Date(d.getFullYear() - 1, 0, 1)), to: to(new Date(d.getFullYear() - 1, 11, 31)) }
  return null
}

// Reverse-map a humanised label back to its stored code when the dim has choices.
function toCode(meta, col, label) {
  const ch = meta?.choices?.[col]
  if (ch) {
    const code = Object.keys(ch).find(k => ch[k] === label)
    return code ?? label
  }
  return label
}

// ── List mode ────────────────────────────────────────────────────────────────
function DashboardList() {
  const { t } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setBoards((await intelligenceApi.dashboards()).dashboards || []) }
    catch { toast.error(t('intelligence.dash_load_failed', { defaultValue: 'Could not load dashboards' })) }
    finally { setLoading(false) }
  }, [t, toast])

  useEffect(() => { load() }, [load])

  const create = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try { navigate(`/intelligence/dashboards/${(await intelligenceApi.createDashboard({ name, tiles: [] })).id}`) }
    catch (e) { toast.error(e?.response?.data?.detail || t('intelligence.dash_create_failed', { defaultValue: 'Could not create dashboard' })) }
    finally { setCreating(false) }
  }

  const remove = async (board, ev) => {
    ev.preventDefault(); ev.stopPropagation()
    const ok = await confirm({ title: t('intelligence.delete_dashboard', { defaultValue: 'Delete dashboard?' }), message: board.name, confirmLabel: t('common.delete', { defaultValue: 'Delete' }) })
    if (!ok) return
    try { await intelligenceApi.deleteDashboard(board.id); load() }
    catch { toast.error(t('intelligence.dash_delete_failed', { defaultValue: 'Could not delete dashboard' })) }
  }

  return (
    <div className="max-w-screen-xl mx-auto space-y-4 pb-10">
      <PageHeader
        title={t('intelligence.dashboards', { defaultValue: 'Dashboards' })}
        subtitle={t('intelligence.dashboards_subtitle', { defaultValue: 'Composed boards of live Intelligence charts.' })}
        action={<Link to="/intelligence" className="btn-outline flex items-center gap-2 px-3 py-2 text-sm"><Compass size={15} /> {t('intelligence.open_explorer', { defaultValue: 'Explorer' })}</Link>}
      />
      <div className="card p-3 flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create() }}
          placeholder={t('intelligence.dashboard_name_ph', { defaultValue: 'e.g. Operations overview' })} className="input flex-1" />
        <button onClick={create} disabled={!newName.trim() || creating} className="btn-primary flex items-center gap-2 px-4 disabled:opacity-40">
          <Plus size={16} /> {t('intelligence.new_dashboard_btn', { defaultValue: 'New dashboard' })}
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 className="animate-spin" /></div>
      ) : boards.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-slate-400">
          <LayoutDashboard size={32} className="mb-3 opacity-40" />
          <p className="text-sm">{t('intelligence.no_dashboards', { defaultValue: 'No dashboards yet. Create one above, then pin charts from the Explorer.' })}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map(b => (
            <Link key={b.id} to={`/intelligence/dashboards/${b.id}`} className="card p-4 hover:border-primary-300 transition-colors group">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">{b.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {b.tiles.length} {b.tiles.length === 1 ? t('intelligence.tile', { defaultValue: 'tile' }) : t('intelligence.tiles', { defaultValue: 'tiles' })}
                    {!b.is_owner && ` · ${b.owner_name}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {b.is_shared && <Share2 size={13} className="text-primary-500" title="Shared" />}
                  {b.is_owner && <button onClick={(e) => remove(b, e)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Detail mode ──────────────────────────────────────────────────────────────
function DashboardDetail({ id }) {
  const { t } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [board, setBoard] = useState(null)
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  // Interactivity state
  const [filterValues, setFilterValues] = useState({})   // filterId → label
  const [options, setOptions] = useState({})             // filterId → [labels]
  const [crossFilters, setCrossFilters] = useState([])   // [{col, val, label, dataset}]
  const [timeRange, setTimeRange] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(0)
  const [tileX, setTileX] = useState({})                 // tileId → drill X dimension
  const [addingFilter, setAddingFilter] = useState(false)
  const timerRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [b, ds] = await Promise.all([intelligenceApi.dashboard(id), intelligenceApi.datasets()])
      setBoard(b)
      setDatasets(ds.datasets || [])
    } catch { toast.error(t('intelligence.dash_load_failed', { defaultValue: 'Could not load dashboard' })) }
    finally { setLoading(false) }
  }, [id, t, toast])

  useEffect(() => { load() }, [load])

  const datasetMeta = useMemo(() => {
    const map = {}
    for (const d of datasets) {
      map[d.key] = {
        dims: new Set((d.dimensions || []).map(x => x.key)),
        tdims: (d.time_dimensions || []).map(x => x.key),
        dimList: d.dimensions || [],
        choices: Object.fromEntries((d.dimensions || []).filter(x => x.choices).map(x => [x.key, x.choices])),
      }
    }
    return map
  }, [datasets])

  // Dataset that backs a given column (first tile that has it).
  const datasetForCol = useCallback((col) => {
    for (const tile of board?.tiles || []) {
      if (datasetMeta[tile.dataset]?.dims.has(col)) return tile.dataset
    }
    return null
  }, [board, datasetMeta])

  // Initialise filter values + load category option lists once data is ready.
  useEffect(() => {
    if (!board || !datasets.length) return
    const initial = {}
    for (const f of board.filters || []) {
      if (f.type === 'time') { if (f.default) setTimeRange(f.default); continue }
      initial[f.id] = typeof f.default === 'string' ? f.default : ''
    }
    setFilterValues(v => ({ ...initial, ...v }))
    ;(async () => {
      const next = {}
      for (const f of (board.filters || []).filter(x => x.type === 'category')) {
        const dataset = datasetForCol(f.col)
        if (!dataset) continue
        try {
          const r = await intelligenceApi.query(dataset, { x: { dimension: f.col }, metrics: [{ key: 'count' }], row_limit: 200 })
          next[f.id] = (r.rows || []).map(row => row[f.col]).filter(v => v != null && v !== '')
        } catch { next[f.id] = [] }
      }
      setOptions(next)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.id, datasets.length])

  // Auto-refresh
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoRefresh > 0) timerRef.current = setInterval(() => setRefreshKey(k => k + 1), autoRefresh)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [autoRefresh])

  // ── Effective per-tile spec: merge filters valid for the tile's dataset ──────
  const effectiveSpec = useCallback((tile) => {
    const meta = datasetMeta[tile.dataset]
    const base = tileX[tile.id]
      ? { ...tile.spec, x: { ...(tile.spec.x || {}), dimension: tileX[tile.id] } }
      : tile.spec
    const filters = [...(base.filters || [])]
    if (meta) {
      for (const f of board?.filters || []) {
        if (f.type !== 'category') continue
        const label = filterValues[f.id]
        if (!label || !meta.dims.has(f.col)) continue
        filters.push({ col: f.col, op: '=', val: toCode(meta, f.col, label) })
      }
      for (const cf of crossFilters) {
        if (!meta.dims.has(cf.col)) continue
        filters.push({ col: cf.col, op: '=', val: cf.val })
      }
      if (timeRange) {
        const range = computeRange(timeRange)
        const tdim = meta.tdims[0]
        if (range && tdim) {
          filters.push({ col: tdim, op: 'gte', val: range.from })
          filters.push({ col: tdim, op: 'lte', val: range.to })
        }
      }
    }
    return { ...base, filters }
  }, [board, datasetMeta, filterValues, crossFilters, timeRange, tileX])

  const onTileSelect = (tile, clickedLabel) => {
    const xdim = tileX[tile.id] || tile.spec?.x?.dimension
    if (!xdim || clickedLabel == null) return
    const meta = datasetMeta[tile.dataset]
    const val = toCode(meta, xdim, clickedLabel)
    setCrossFilters(prev => {
      const without = prev.filter(c => c.col !== xdim)
      const same = prev.find(c => c.col === xdim && c.val === val)
      return same ? without : [...without, { col: xdim, val, label: String(clickedLabel) }]
    })
  }

  // ── Owner mutations ─────────────────────────────────────────────────────────
  const patch = async (fields, optimistic) => {
    if (optimistic) setBoard(b => ({ ...b, ...optimistic }))
    try { await intelligenceApi.updateDashboard(id, fields) }
    catch { toast.error(t('intelligence.dash_save_failed', { defaultValue: 'Could not save changes' })); load() }
  }
  const patchTiles = (tiles) => patch({ tiles }, { tiles })
  const moveTile = (idx, dir) => {
    const tiles = [...board.tiles]; const j = dir === 'left' ? idx - 1 : idx + 1
    if (j < 0 || j >= tiles.length) return
    ;[tiles[idx], tiles[j]] = [tiles[j], tiles[idx]]; patchTiles(tiles)
  }
  const toggleWidth = (idx) => patchTiles(board.tiles.map((tile, i) => i === idx ? { ...tile, width: tile.width === 'full' ? 'half' : 'full' } : tile))
  const removeTile = async (idx) => {
    const ok = await confirm({ title: t('intelligence.remove_tile', { defaultValue: 'Remove tile?' }), message: board.tiles[idx]?.title || '', confirmLabel: t('common.remove', { defaultValue: 'Remove' }) })
    if (ok) patchTiles(board.tiles.filter((_, i) => i !== idx))
  }
  const addFilter = (dim) => {
    setAddingFilter(false)
    const filters = [...(board.filters || []), { id: `f${Date.now()}`, type: 'category', col: dim.key, label: dim.label }]
    patch({ filters }, { filters })
  }
  const removeFilter = (fid) => {
    setFilterValues(v => { const n = { ...v }; delete n[fid]; return n })
    const filters = (board.filters || []).filter(f => f.id !== fid)
    patch({ filters }, { filters })
  }
  const saveName = () => { const name = nameDraft.trim(); if (name) { setEditingName(false); patch({ name }, { name }) } }
  const toggleShared = () => patch({ is_shared: !board.is_shared }, { is_shared: !board.is_shared })
  const deleteBoard = async () => {
    const ok = await confirm({ title: t('intelligence.delete_dashboard', { defaultValue: 'Delete dashboard?' }), message: board.name, confirmLabel: t('common.delete', { defaultValue: 'Delete' }) })
    if (!ok) return
    try { await intelligenceApi.deleteDashboard(id); navigate('/intelligence/dashboards') }
    catch { toast.error(t('intelligence.dash_delete_failed', { defaultValue: 'Could not delete dashboard' })) }
  }

  const availableDims = useMemo(() => {
    const used = new Set((board?.filters || []).map(f => f.col))
    const seen = new Map()
    for (const tile of board?.tiles || []) {
      for (const d of datasetMeta[tile.dataset]?.dimList || []) {
        if (!seen.has(d.key) && !used.has(d.key)) seen.set(d.key, d.label)
      }
    }
    return [...seen.entries()].map(([key, label]) => ({ key, label }))
  }, [board, datasetMeta])

  if (loading) return <div className="flex justify-center py-24 text-slate-400"><Loader2 className="animate-spin" /></div>
  if (!board) return (
    <div className="card flex flex-col items-center justify-center py-16 text-slate-400">
      <p className="text-sm">{t('intelligence.dashboard_not_found', { defaultValue: 'Dashboard not found.' })}</p>
      <Link to="/intelligence/dashboards" className="btn-outline mt-4 px-4 py-2 text-sm">{t('common.back', { defaultValue: 'Back' })}</Link>
    </div>
  )

  const canEdit = board.is_owner
  const categoryFilters = (board.filters || []).filter(f => f.type === 'category')

  return (
    <div className="max-w-screen-2xl mx-auto space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/intelligence/dashboards" className="p-2 rounded-lg text-slate-400 hover:text-primary-500"><ArrowLeft size={18} /></Link>
          {editingName ? (
            <span className="flex items-center gap-1">
              <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveName() }} className="input py-1" autoFocus />
              <button onClick={saveName} className="p-1.5 rounded-md bg-primary-600 text-white"><Check size={14} /></button>
            </span>
          ) : (
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-2">
              {board.name}
              {canEdit && <button onClick={() => { setNameDraft(board.name); setEditingName(true) }} className="text-slate-300 hover:text-primary-500"><Pencil size={14} /></button>}
              {!board.is_owner && <span className="text-xs font-normal text-slate-400 flex items-center gap-1"><Lock size={11} /> {board.owner_name}</span>}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select value={autoRefresh} onChange={(e) => setAutoRefresh(Number(e.target.value))} className="input py-1.5 text-sm" title={t('intelligence.auto_refresh', { defaultValue: 'Auto-refresh' })}>
            {REFRESH_OPTS.map(o => <option key={o.value} value={o.value}>⟳ {o.label}</option>)}
          </select>
          <button onClick={() => setRefreshKey(k => k + 1)} className="btn-outline flex items-center gap-2 px-3 py-2 text-sm"><RefreshCw size={14} /> {t('intelligence.refresh', { defaultValue: 'Refresh' })}</button>
          {canEdit && (
            <>
              <button onClick={toggleShared} className={`btn-outline flex items-center gap-2 px-3 py-2 text-sm ${board.is_shared ? 'text-primary-700 border-primary-300 dark:text-primary-200' : ''}`}><Share2 size={14} /> {board.is_shared ? t('intelligence.shared', { defaultValue: 'Shared' }) : t('intelligence.share', { defaultValue: 'Share' })}</button>
              <button onClick={deleteBoard} className="btn-outline flex items-center gap-2 px-3 py-2 text-sm text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={14} /></button>
            </>
          )}
        </div>
      </div>

      {/* Filter bar */}
      {board.tiles.length > 0 && (
        <div className="card p-3 flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-slate-400 shrink-0" />
          <span className="inline-flex items-center gap-1 text-xs text-slate-500"><CalendarClock size={13} /></span>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="input py-1.5 text-sm">
            {TIME_RANGES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {categoryFilters.map(f => (
            <span key={f.id} className="inline-flex items-center gap-1">
              <select
                value={filterValues[f.id] || ''}
                onChange={(e) => setFilterValues(v => ({ ...v, [f.id]: e.target.value }))}
                className="input py-1.5 text-sm"
                title={f.label}
              >
                <option value="">{f.label}: {t('intelligence.all', { defaultValue: 'All' })}</option>
                {(options[f.id] || []).map(v => <option key={String(v)} value={String(v)}>{String(v)}</option>)}
              </select>
              {canEdit && <button onClick={() => removeFilter(f.id)} className="text-slate-300 hover:text-red-500" title={t('common.remove', { defaultValue: 'Remove' })}><X size={13} /></button>}
            </span>
          ))}

          {canEdit && availableDims.length > 0 && (
            <span className="relative">
              <button onClick={() => setAddingFilter(a => !a)} className="btn-outline flex items-center gap-1 px-2.5 py-1.5 text-sm"><Plus size={13} /> {t('intelligence.add_filter', { defaultValue: 'Filter' })}</button>
              {addingFilter && (
                <div className="absolute z-20 mt-1 w-48 max-h-60 overflow-auto card p-1 shadow-lg">
                  {availableDims.map(d => (
                    <button key={d.key} onClick={() => addFilter(d)} className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-50 dark:hover:bg-slate-700/50">{d.label}</button>
                  ))}
                </div>
              )}
            </span>
          )}

          {/* Cross-filter chips */}
          {crossFilters.map((cf, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 text-xs">
              {cf.label}
              <button onClick={() => setCrossFilters(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-500"><X size={12} /></button>
            </span>
          ))}
          {crossFilters.length > 0 && (
            <button onClick={() => setCrossFilters([])} className="text-xs text-slate-400 hover:text-slate-600 underline">{t('intelligence.clear', { defaultValue: 'Clear' })}</button>
          )}
        </div>
      )}

      {/* Tiles */}
      {board.tiles.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-slate-400">
          <LayoutDashboard size={32} className="mb-3 opacity-40" />
          <p className="text-sm">{t('intelligence.dashboard_empty', { defaultValue: 'No tiles yet. Open the Explorer, build a chart, and use “Pin” to add it here.' })}</p>
          <Link to="/intelligence" className="btn-primary mt-4 px-4 py-2 text-sm flex items-center gap-2"><Compass size={15} /> {t('intelligence.open_explorer', { defaultValue: 'Open Explorer' })}</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {board.tiles.map((tile, idx) => {
            const meta = datasetMeta[tile.dataset]
            const effTile = { ...tile, spec: effectiveSpec(tile) }
            return (
              <div key={tile.id || idx} className={`card p-0 overflow-hidden flex flex-col ${tile.width === 'full' ? 'lg:col-span-2' : ''}`}>
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{tile.title || t('intelligence.untitled', { defaultValue: 'Untitled' })}</h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Drill: break down by */}
                    {meta?.dimList?.length > 0 && tile.chart_type !== 'number' && (
                      <span className="inline-flex items-center gap-1 text-slate-400" title={t('intelligence.break_down_by', { defaultValue: 'Break down by' })}>
                        <Layers size={13} />
                        <select
                          value={tileX[tile.id] || tile.spec?.x?.dimension || ''}
                          onChange={(e) => setTileX(s => ({ ...s, [tile.id]: e.target.value }))}
                          className="bg-transparent text-xs text-slate-500 dark:text-slate-400 focus:outline-none cursor-pointer max-w-[110px]"
                        >
                          {meta.dimList.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                        </select>
                      </span>
                    )}
                    {canEdit && (
                      <div className="flex items-center gap-0.5 text-slate-400">
                        <button onClick={() => moveTile(idx, 'left')} disabled={idx === 0} className="p-1 rounded hover:text-slate-600 disabled:opacity-20"><ChevronLeft size={15} /></button>
                        <button onClick={() => moveTile(idx, 'right')} disabled={idx === board.tiles.length - 1} className="p-1 rounded hover:text-slate-600 disabled:opacity-20"><ChevronRight size={15} /></button>
                        <button onClick={() => toggleWidth(idx)} className="p-1 rounded hover:text-primary-500">{tile.width === 'full' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
                        <button onClick={() => removeTile(idx)} className="p-1 rounded hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-3 flex-1" style={{ height: '320px' }}>
                  <DashboardTile tile={effTile} refreshKey={refreshKey} onSelect={(label) => onTileSelect(tile, label)} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Dashboards() {
  const { id } = useParams()
  return id ? <DashboardDetail id={id} /> : <DashboardList />
}

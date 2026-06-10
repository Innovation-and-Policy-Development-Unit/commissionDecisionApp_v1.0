import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ZAxis, Treemap, FunnelChart, Funnel, LabelList,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts'

const COLORS = ['#003876', '#0078d4', '#107c10', '#f59e0b', '#d13438', '#5c2d91', '#06b6d4', '#9333ea']
const fmt = (v) => (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v ?? ''))
const niceMax = (v) => {
  if (!v || v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  return Math.ceil((v * 1.1) / p) * p
}

function pivot(rows, xKey, seriesKey, metricKey) {
  const xs = []; const seen = new Set()
  rows.forEach(r => { const x = r[xKey]; if (!seen.has(x)) { seen.add(x); xs.push(x) } })
  const series = [...new Set(rows.map(r => r[seriesKey]))]
  const data = xs.map(x => {
    const o = { name: x }
    series.forEach(s => { const row = rows.find(r => r[xKey] === x && r[seriesKey] === s); o[s] = row ? row[metricKey] : 0 })
    return o
  })
  return { data, series }
}

function Empty({ msg }) {
  return <div className="flex items-center justify-center h-full text-slate-400 text-sm px-4 text-center">{msg}</div>
}

export default function ExplorerChart({ result, chartType = 'bar', onSelect }) {
  if (!result || !result.rows?.length) return <Empty msg="No data for this query." />
  const { rows, meta, columns } = result
  const xKey = meta.x
  const metricKey = meta.metric
  const breakdownKey = meta.breakdown
  const metricLabel = columns.find(c => c.key === metricKey)?.label || metricKey
  const interactive = typeof onSelect === 'function'
  const handleChartClick = interactive ? (s) => { if (s && s.activeLabel != null) onSelect(s.activeLabel) } : undefined
  const cursor = interactive ? { cursor: 'pointer' } : undefined

  // ── Big number ──────────────────────────────────────────────────────────────
  if (chartType === 'number') {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-6xl font-bold text-primary-700 dark:text-primary-300">{fmt(rows[0]?.[metricKey] ?? 0)}</div>
        <div className="text-sm uppercase tracking-wide text-slate-500 mt-2">{metricLabel}</div>
      </div>
    )
  }

  // ── Gauge (single value vs a nice max) ──────────────────────────────────────
  if (chartType === 'gauge') {
    const value = Number(rows[0]?.[metricKey]) || 0
    const max = niceMax(rows.length > 1 ? Math.max(...rows.map(r => Number(r[metricKey]) || 0)) : value)
    return (
      <div className="relative h-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="68%" outerRadius="100%" startAngle={180} endAngle={0} data={[{ value, fill: COLORS[0] }]}>
            <PolarAngleAxis type="number" domain={[0, max]} angleAxisId={0} tick={false} />
            <RadialBar dataKey="value" cornerRadius={10} background angleAxisId={0} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-4xl font-bold text-primary-700 dark:text-primary-300">{fmt(value)}</div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{metricLabel} / {fmt(max)}</div>
        </div>
      </div>
    )
  }

  // ── Rich table (totals, formatted, right-aligned metrics) ───────────────────
  if (chartType === 'table') {
    const totals = {}
    columns.filter(c => c.role === 'metric').forEach(c => { totals[c.key] = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0) })
    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 border-b border-slate-200 dark:border-slate-700">
              {columns.map(c => <th key={c.key} className={`px-3 py-2 ${c.role === 'metric' ? 'text-right' : 'text-left'}`}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-b border-slate-100 dark:border-slate-800 ${i % 2 ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}`}>
                {columns.map(c => <td key={c.key} className={`px-3 py-1.5 ${c.role === 'metric' ? 'text-right tabular-nums' : 'text-left'}`}>{c.role === 'metric' ? fmt(Number(r[c.key])) : String(r[c.key] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
          {Object.keys(totals).length > 0 && (
            <tfoot>
              <tr className="font-semibold border-t-2 border-slate-300 dark:border-slate-600">
                {columns.map((c, i) => <td key={c.key} className={`px-3 py-2 ${c.role === 'metric' ? 'text-right tabular-nums' : 'text-left'}`}>{c.role === 'metric' ? fmt(totals[c.key]) : (i === 0 ? 'Total' : '')}</td>)}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    )
  }

  // ── Pivot table (rows = X, columns = breakdown, cells = metric) ──────────────
  if (chartType === 'pivot') {
    if (!xKey || !breakdownKey) return <Empty msg="Pivot needs an X dimension and a breakdown (series) dimension." />
    const rowKeys = [...new Set(rows.map(r => r[xKey]))]
    const colKeys = [...new Set(rows.map(r => r[breakdownKey]))]
    const at = (rk, ck) => { const m = rows.find(r => r[xKey] === rk && r[breakdownKey] === ck); return m ? Number(m[metricKey]) || 0 : 0 }
    const colTotal = (ck) => rowKeys.reduce((s, rk) => s + at(rk, ck), 0)
    const grand = colKeys.reduce((s, ck) => s + colTotal(ck), 0)
    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <th className="px-3 py-2 text-left sticky left-0 bg-white dark:bg-slate-900">{columns.find(c => c.key === xKey)?.label}</th>
              {colKeys.map(ck => <th key={String(ck)} className="px-3 py-2 text-right">{String(ck)}</th>)}
              <th className="px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((rk, i) => (
              <tr key={String(rk)} className={`border-b border-slate-100 dark:border-slate-800 ${i % 2 ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}`}>
                <td className="px-3 py-1.5 text-left font-medium sticky left-0 bg-inherit">{String(rk)}</td>
                {colKeys.map(ck => <td key={String(ck)} className="px-3 py-1.5 text-right tabular-nums">{fmt(at(rk, ck))}</td>)}
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{fmt(colKeys.reduce((s, ck) => s + at(rk, ck), 0))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold border-t-2 border-slate-300 dark:border-slate-600">
              <td className="px-3 py-2 text-left sticky left-0 bg-white dark:bg-slate-900">Total</td>
              {colKeys.map(ck => <td key={String(ck)} className="px-3 py-2 text-right tabular-nums">{fmt(colTotal(ck))}</td>)}
              <td className="px-3 py-2 text-right tabular-nums">{fmt(grand)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    )
  }

  // ── Scatter ─────────────────────────────────────────────────────────────────
  if (chartType === 'scatter') {
    const metricCols = columns.filter(c => c.role === 'metric')
    const mX = metricCols[0]?.key
    const mY = metricCols[1]?.key
    const data = rows.map((r, i) => ({
      x: mY ? (Number(r[mX]) || 0) : i,
      y: Number(r[mY || mX]) || 0,
      name: String(r[xKey] ?? i),
    }))
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name={mY ? (metricCols[0]?.label) : 'index'} tick={{ fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name={metricCols[mY ? 1 : 0]?.label} tick={{ fontSize: 11 }} />
          <ZAxis range={[60, 60]} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={data} fill={COLORS[0]} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  // ── Treemap ─────────────────────────────────────────────────────────────────
  if (chartType === 'treemap') {
    const data = rows.map((r, i) => ({ name: String(r[xKey] ?? '—'), size: Number(r[metricKey]) || 0, fill: COLORS[i % COLORS.length] }))
    return (
      <ResponsiveContainer width="100%" height="100%">
        <Treemap data={data} dataKey="size" nameKey="name" stroke="#fff" isAnimationActive={false}>
          <Tooltip formatter={(v) => fmt(v)} />
        </Treemap>
      </ResponsiveContainer>
    )
  }

  // ── Funnel ──────────────────────────────────────────────────────────────────
  if (chartType === 'funnel') {
    const data = [...rows].sort((a, b) => (Number(b[metricKey]) || 0) - (Number(a[metricKey]) || 0))
      .map((r, i) => ({ name: String(r[xKey] ?? '—'), value: Number(r[metricKey]) || 0, fill: COLORS[i % COLORS.length] }))
    return (
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
          <Tooltip formatter={(v) => fmt(v)} />
          <Funnel data={data} dataKey="value" isAnimationActive={false}>
            <LabelList position="right" fill="#475569" stroke="none" dataKey="name" />
            <LabelList position="center" fill="#fff" stroke="none" dataKey="value" formatter={(v) => fmt(v)} />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    )
  }

  // ── Pie ─────────────────────────────────────────────────────────────────────
  if (chartType === 'pie') {
    const data = rows.map(r => ({ name: String(r[xKey] ?? '—'), value: r[metricKey] }))
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius="80%" label
            onClick={interactive ? (d) => d?.name != null && onSelect(d.name) : undefined} style={cursor}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} style={cursor} />)}
          </Pie>
          <Tooltip /><Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  // ── bar / column / line / area ──────────────────────────────────────────────
  let data, series
  if (breakdownKey) ({ data, series } = pivot(rows, xKey, breakdownKey, metricKey))
  else { data = rows.map(r => ({ name: String(r[xKey] ?? '—'), value: r[metricKey] })); series = ['value'] }
  const seriesLabel = (s) => (s === 'value' ? metricLabel : String(s))

  if (chartType === 'line' || chartType === 'area') {
    const Chart = chartType === 'area' ? AreaChart : LineChart
    const Series = chartType === 'area' ? Area : Line
    return (
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} onClick={handleChartClick} style={cursor}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          {series.length > 1 && <Legend />}
          {series.map((s, i) => (
            <Series key={s} type="monotone" dataKey={s} name={seriesLabel(s)}
              stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]}
              fillOpacity={chartType === 'area' ? 0.25 : 1} strokeWidth={2} />
          ))}
        </Chart>
      </ResponsiveContainer>
    )
  }

  const horizontal = chartType === 'bar'
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} onClick={handleChartClick} style={cursor}>
        <CartesianGrid strokeDasharray="3 3" />
        {horizontal
          ? (<><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} /></>)
          : (<><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /></>)}
        <Tooltip />
        {series.length > 1 && <Legend />}
        {series.map((s, i) => <Bar key={s} dataKey={s} name={seriesLabel(s)} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}

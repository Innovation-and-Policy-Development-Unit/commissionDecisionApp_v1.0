import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

const COLORS = ['#003876', '#0078d4', '#107c10', '#f59e0b', '#d13438', '#5c2d91', '#06b6d4', '#9333ea']

function pivot(rows, xKey, seriesKey, metricKey) {
  const xs = []
  const seen = new Set()
  rows.forEach(r => { const x = r[xKey]; if (!seen.has(x)) { seen.add(x); xs.push(x) } })
  const series = [...new Set(rows.map(r => r[seriesKey]))]
  const data = xs.map(x => {
    const o = { name: x }
    series.forEach(s => {
      const row = rows.find(r => r[xKey] === x && r[seriesKey] === s)
      o[s] = row ? row[metricKey] : 0
    })
    return o
  })
  return { data, series }
}

export default function ExplorerChart({ result, chartType = 'bar' }) {
  if (!result || !result.rows?.length) {
    return <div className="flex items-center justify-center h-full text-slate-400 text-sm">No data for this query.</div>
  }
  const { rows, meta } = result
  const xKey = meta.x
  const metricKey = meta.metric
  const breakdownKey = meta.breakdown

  if (chartType === 'number') {
    const v = rows[0]?.[metricKey] ?? 0
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-6xl font-bold text-primary-700 dark:text-primary-300">{v}</div>
        <div className="text-sm uppercase tracking-wide text-slate-500 mt-2">
          {result.columns.find(c => c.key === metricKey)?.label || metricKey}
        </div>
      </div>
    )
  }

  if (chartType === 'table') {
    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
              {result.columns.map(c => <th key={c.key} className="px-3 py-2">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                {result.columns.map(c => <td key={c.key} className="px-3 py-1.5">{String(r[c.key] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (chartType === 'pie') {
    const data = rows.map(r => ({ name: String(r[xKey] ?? '—'), value: r[metricKey] }))
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius="80%" label>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  // bar / column / line / area
  let data, series
  if (breakdownKey) {
    ({ data, series } = pivot(rows, xKey, breakdownKey, metricKey))
  } else {
    data = rows.map(r => ({ name: String(r[xKey] ?? '—'), value: r[metricKey] }))
    series = ['value']
  }
  const seriesLabel = (s) => (s === 'value'
    ? (result.columns.find(c => c.key === metricKey)?.label || 'Value')
    : String(s))

  if (chartType === 'line' || chartType === 'area') {
    const Chart = chartType === 'area' ? AreaChart : LineChart
    const Series = chartType === 'area' ? Area : Line
    return (
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data}>
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

  // bar (horizontal) / column (vertical)
  const horizontal = chartType === 'bar'
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'}>
        <CartesianGrid strokeDasharray="3 3" />
        {horizontal
          ? (<><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} /></>)
          : (<><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /></>)}
        <Tooltip />
        {series.length > 1 && <Legend />}
        {series.map((s, i) => (
          <Bar key={s} dataKey={s} name={seriesLabel(s)} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

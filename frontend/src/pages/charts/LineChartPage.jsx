import PageHeader from '../../components/shared/PageHeader'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'
import { TrendingUp, TrendingDown, Eye, MousePointerClick, Zap } from 'lucide-react'
import useChartColors from '../../hooks/useChartColors'

// ─── Data ────────────────────────────────────────────────────────────────────
const monthlyData = [
  { month: 'Jan', sales: 4000, revenue: 5800, profit: 2200 },
  { month: 'Feb', sales: 3400, revenue: 5200, profit: 1900 },
  { month: 'Mar', sales: 5100, revenue: 7100, profit: 2800 },
  { month: 'Apr', sales: 4700, revenue: 6600, profit: 2500 },
  { month: 'May', sales: 6200, revenue: 8400, profit: 3300 },
  { month: 'Jun', sales: 5800, revenue: 7900, profit: 3000 },
  { month: 'Jul', sales: 7100, revenue: 9200, profit: 3700 },
  { month: 'Aug', sales: 6600, revenue: 8800, profit: 3400 },
  { month: 'Sep', sales: 7800, revenue: 10100, profit: 4100 },
  { month: 'Oct', sales: 8200, revenue: 10600, profit: 4400 },
  { month: 'Nov', sales: 9100, revenue: 11800, profit: 4900 },
  { month: 'Dec', sales: 9800, revenue: 12400, profit: 5200 },
]

const productData = [
  { month: 'Jan', productA: 2800, productB: 1900, productC: 3200 },
  { month: 'Feb', productA: 3100, productB: 2200, productC: 2800 },
  { month: 'Mar', productA: 2600, productB: 2800, productC: 3500 },
  { month: 'Apr', productA: 3400, productB: 2500, productC: 3100 },
  { month: 'May', productA: 3900, productB: 3100, productC: 2900 },
  { month: 'Jun', productA: 3600, productB: 3400, productC: 3700 },
  { month: 'Jul', productA: 4200, productB: 2900, productC: 4100 },
  { month: 'Aug', productA: 4800, productB: 3500, productC: 3800 },
]

const smoothData = [
  { week: 'W1', actual: 3200, forecast: 3000 },
  { week: 'W2', actual: 2900, forecast: 3200 },
  { week: 'W3', actual: 4100, forecast: 3500 },
  { week: 'W4', actual: 3800, forecast: 3800 },
  { week: 'W5', actual: 5200, forecast: 4200 },
  { week: 'W6', actual: 4600, forecast: 4600 },
  { week: 'W7', actual: 5800, forecast: 5100 },
  { week: 'W8', actual: 6200, forecast: 5600 },
]

const stepData = [
  { stage: 'Lead',       thisYear: 8400, lastYear: 7200 },
  { stage: 'Qualified',  thisYear: 6200, lastYear: 5800 },
  { stage: 'Proposal',   thisYear: 4800, lastYear: 4100 },
  { stage: 'Negotiation',thisYear: 3200, lastYear: 3500 },
  { stage: 'Closed Won', thisYear: 2400, lastYear: 1900 },
  { stage: 'Renewal',    thisYear: 1800, lastYear: 1200 },
]

const sparkLine = {
  views:       [{ v: 42 }, { v: 58 }, { v: 51 }, { v: 67 }, { v: 62 }, { v: 74 }, { v: 71 }],
  clicks:      [{ v: 18 }, { v: 24 }, { v: 21 }, { v: 29 }, { v: 26 }, { v: 34 }, { v: 31 }],
  conversions: [{ v: 6  }, { v: 9  }, { v: 7  }, { v: 12 }, { v: 10 }, { v: 14 }, { v: 13 }],
  speed:       [{ v: 88 }, { v: 82 }, { v: 90 }, { v: 86 }, { v: 93 }, { v: 89 }, { v: 95 }],
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-lg min-w-[140px]">
      <p className="font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-slate-600 dark:text-slate-400">{p.name}:</span>
          <span className="font-semibold" style={{ color: p.color }}>
            {p.value > 999 ? `${(p.value / 1000).toFixed(1)}k` : p.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, change, up, iconBg }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">{value}</p>
      </div>
      <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${up ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'text-rose-500 bg-rose-50 dark:bg-rose-900/20'}`}>
        {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {change}
      </div>
    </div>
  )
}

// ─── Chart Card ──────────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children }) {
  return (
    <div className="card">
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700/60">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

// ─── Tiny Line Spark Card ─────────────────────────────────────────────────────
function SparkCard({ icon: Icon, label, value, change, up, color, data }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon size={13} style={{ color }} />
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        </div>
        <span className={`flex items-center gap-0.5 text-[10px] font-bold ${up ? 'text-emerald-500' : 'text-rose-500'}`}>
          {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {change}
        </span>
      </div>
      <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">{value}</p>
      <ResponsiveContainer width="100%" height={60}>
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function LineChartPage() {
  const C = useChartColors()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Line Charts"
        subtitle="Visualise trends and changes over time with clean, precise line charts"
      />

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Eye}
          label="Total Page Views"
          value="8.94M"
          change="+21.3%"
          up
          iconBg="bg-indigo-500"
        />
        <StatCard
          icon={MousePointerClick}
          label="Click-Through Rate"
          value="3.84%"
          change="+1.2%"
          up
          iconBg="bg-cyan-500"
        />
        <StatCard
          icon={Zap}
          label="Avg Load Speed"
          value="1.24s"
          change="-0.18s"
          up={false}
          iconBg="bg-amber-400"
        />
      </div>

      {/* ── Full Charts: 2-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Section: Basic Line Chart ── */}
        <ChartCard
          title="Monthly Sales"
          subtitle="Single-series line chart with dot markers · Jan – Dec"
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: C.axis }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: C.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v / 1000}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke={C.primary}
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 0, fill: C.primary }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Section: Multi-line Chart (3 products) ── */}
        <ChartCard
          title="Product Performance"
          subtitle="Three product lines tracked over 8 months"
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={productData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: C.axis }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: C.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v / 1000}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconSize={8}
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
              />
              <Line type="monotone" dataKey="productA" name="Product A" stroke={C.primary}  strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="productB" name="Product B" stroke={C.cyan}     strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="productC" name="Product C" stroke={C.emerald}  strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Section: Smooth Curve ── */}
        <ChartCard
          title="Actual vs Forecast"
          subtitle="Smooth monotone curves — solid line for actuals, dashed for forecast"
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={smoothData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: C.axis }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: C.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v / 1000}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconSize={8}
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke={C.primary}
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 2, stroke: C.primary, fill: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                name="Forecast"
                stroke={C.violet}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Section: Step Line Chart ── */}
        <ChartCard
          title="Sales Funnel — Step Line"
          subtitle="Year-over-year pipeline stages with step interpolation"
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={stepData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis
                dataKey="stage"
                tick={{ fontSize: 10, fill: C.axis }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: C.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v / 1000}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconSize={8}
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
              />
              <Line
                type="stepAfter"
                dataKey="thisYear"
                name="This Year"
                stroke={C.emerald}
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 0, fill: C.emerald }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              <Line
                type="stepAfter"
                dataKey="lastYear"
                name="Last Year"
                stroke={C.rose}
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 3, strokeWidth: 0, fill: C.rose }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Section: Mini Line Sparklines ── */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">KPI Sparklines</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SparkCard icon={Eye}              label="Page Views"   value="74,280"  change="+18.4%" up    color={C.primary} data={sparkLine.views}       />
          <SparkCard icon={MousePointerClick} label="Clicks"       value="34,142"  change="+11.2%" up    color={C.cyan}    data={sparkLine.clicks}      />
          <SparkCard icon={TrendingUp}       label="Conversions"  value="1,320"   change="+24.8%" up    color={C.emerald} data={sparkLine.conversions} />
          <SparkCard icon={Zap}              label="Perf Score"   value="95 / 100" change="+2pts"  up    color={C.amber}   data={sparkLine.speed}       />
        </div>
      </div>
    </div>
  )
}

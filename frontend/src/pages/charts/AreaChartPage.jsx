import PageHeader from '../../components/shared/PageHeader'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'
import { TrendingUp, TrendingDown, Users, Activity, BarChart2 } from 'lucide-react'
import useChartColors from '../../hooks/useChartColors'

// ─── Data ────────────────────────────────────────────────────────────────────
const monthlyRevenue = [
  { month: 'Jan', revenue: 38000, target: 35000 },
  { month: 'Feb', revenue: 42000, target: 38000 },
  { month: 'Mar', revenue: 39000, target: 40000 },
  { month: 'Apr', revenue: 51000, target: 44000 },
  { month: 'May', revenue: 47000, target: 46000 },
  { month: 'Jun', revenue: 58000, target: 50000 },
  { month: 'Jul', revenue: 62000, target: 54000 },
  { month: 'Aug', revenue: 55000, target: 58000 },
  { month: 'Sep', revenue: 67000, target: 60000 },
  { month: 'Oct', revenue: 71000, target: 64000 },
  { month: 'Nov', revenue: 78000, target: 68000 },
  { month: 'Dec', revenue: 84000, target: 72000 },
]

const stackedData = [
  { month: 'Jan', online: 4200, offline: 2800, mobile: 1600 },
  { month: 'Feb', online: 3800, offline: 3100, mobile: 1900 },
  { month: 'Mar', online: 5100, offline: 2600, mobile: 2200 },
  { month: 'Apr', online: 4700, offline: 3400, mobile: 2500 },
  { month: 'May', online: 6200, offline: 2900, mobile: 2800 },
  { month: 'Jun', online: 7100, offline: 3200, mobile: 3100 },
]

const negativeData = [
  { month: 'Jan', profit: 2400,  growth: 1.8 },
  { month: 'Feb', profit: -800,  growth: -0.6 },
  { month: 'Mar', profit: 3200,  growth: 2.4 },
  { month: 'Apr', profit: 1600,  growth: 1.2 },
  { month: 'May', profit: -1200, growth: -0.9 },
  { month: 'Jun', profit: 4100,  growth: 3.1 },
  { month: 'Jul', profit: 2800,  growth: 2.1 },
  { month: 'Aug', profit: -400,  growth: -0.3 },
  { month: 'Sep', profit: 5200,  growth: 3.9 },
  { month: 'Oct', profit: 3600,  growth: 2.7 },
  { month: 'Nov', profit: -600,  growth: -0.5 },
  { month: 'Dec', profit: 6400,  growth: 4.8 },
]

const sparkData = {
  visitors:  [{ v: 28 }, { v: 35 }, { v: 30 }, { v: 42 }, { v: 38 }, { v: 50 }, { v: 46 }],
  sessions:  [{ v: 18 }, { v: 22 }, { v: 19 }, { v: 28 }, { v: 24 }, { v: 32 }, { v: 29 }],
  pageviews: [{ v: 55 }, { v: 62 }, { v: 58 }, { v: 71 }, { v: 66 }, { v: 78 }, { v: 74 }],
  bounce:    [{ v: 62 }, { v: 58 }, { v: 60 }, { v: 54 }, { v: 56 }, { v: 51 }, { v: 49 }],
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-lg min-w-[130px]">
      <p className="font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-slate-600 dark:text-slate-400">{p.name}:</span>
          <span className="font-semibold" style={{ color: p.color }}>
            {typeof p.value === 'number' && p.value > 999
              ? `$${(p.value / 1000).toFixed(0)}k`
              : p.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, change, changeLabel, up, iconBg }) {
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

// ─── Card wrapper ────────────────────────────────────────────────────────────
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

// ─── Tiny Sparkline ──────────────────────────────────────────────────────────
function SparkCard({ label, value, change, up, color, data }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`flex items-center gap-0.5 text-[10px] font-bold ${up ? 'text-emerald-500' : 'text-rose-500'}`}>
          {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {change}
        </span>
      </div>
      <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">{value}</p>
      <ResponsiveContainer width="100%" height={60}>
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            fill={`url(#spark-${label})`}
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function AreaChartPage() {
  const C = useChartColors()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Area Charts"
        subtitle="Visualise volume and cumulative trends with gradient-filled area charts"
      />

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          label="Total Visitors"
          value="1,284,320"
          change="+12.4%"
          changeLabel="vs last month"
          up
          iconBg="bg-indigo-500"
        />
        <StatCard
          icon={Activity}
          label="Avg Sessions"
          value="4.2 min"
          change="+8.1%"
          changeLabel="vs last month"
          up
          iconBg="bg-cyan-500"
        />
        <StatCard
          icon={BarChart2}
          label="Bounce Rate"
          value="49.3%"
          change="-3.6%"
          changeLabel="vs last month"
          up={false}
          iconBg="bg-rose-400"
        />
      </div>

      {/* ── Full Charts: 2-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Section: Basic Area Chart ── */}
        <ChartCard
          title="Monthly Revenue"
          subtitle="Jan – Dec · Gradient-filled area with smooth monotone curve"
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.primary} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
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
                tickFormatter={v => `$${v / 1000}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke={C.primary}
                fill="url(#gradRevenue)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Section: Stacked Area Chart ── */}
        <ChartCard
          title="Stacked Area Chart"
          subtitle="Online, Offline & Mobile channel distribution over 6 months"
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={stackedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gOnline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.primary} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={C.primary} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="gOffline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.cyan} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={C.cyan} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="gMobile" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.emerald} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={C.emerald} stopOpacity={0.1} />
                </linearGradient>
              </defs>
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
              <Area type="monotone" dataKey="online"  name="Online"  stackId="1" stroke={C.primary}  fill="url(#gOnline)"  strokeWidth={2} />
              <Area type="monotone" dataKey="offline" name="Offline" stackId="1" stroke={C.cyan}    fill="url(#gOffline)" strokeWidth={2} />
              <Area type="monotone" dataKey="mobile"  name="Mobile"  stackId="1" stroke={C.emerald} fill="url(#gMobile)"  strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Section: Multi-line Area Chart ── */}
        <ChartCard
          title="Revenue vs Target"
          subtitle="Year-over-year comparison of actual revenue against monthly targets"
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gRevML" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.primary} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gTargetML" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.amber} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C.amber} stopOpacity={0} />
                </linearGradient>
              </defs>
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
                tickFormatter={v => `$${v / 1000}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconSize={8}
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke={C.primary}
                fill="url(#gRevML)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="target"
                name="Target"
                stroke={C.amber}
                fill="url(#gTargetML)"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Section: Negative Values Area Chart ── */}
        <ChartCard
          title="Profit & Loss"
          subtitle="Monthly profit with positive/negative areas highlighted"
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={negativeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gProfitPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.emerald} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={C.emerald} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gProfitNeg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.rose} stopOpacity={0.05} />
                  <stop offset="95%" stopColor={C.rose} stopOpacity={0.4} />
                </linearGradient>
              </defs>
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
                tickFormatter={v => `$${v / 1000}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconSize={8}
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
              />
              <Area
                type="monotone"
                dataKey="profit"
                name="Profit"
                stroke={C.emerald}
                fill="url(#gProfitPos)"
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 0, fill: C.emerald }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Section: Tiny Sparkline KPI Cards ── */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">KPI Sparklines</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SparkCard
            label="Total Visitors"
            value="1.28M"
            change="+12.4%"
            up
            color={C.primary}
            data={sparkData.visitors}
          />
          <SparkCard
            label="Avg Sessions"
            value="4.2 min"
            change="+8.1%"
            up
            color={C.cyan}
            data={sparkData.sessions}
          />
          <SparkCard
            label="Page Views"
            value="8.94M"
            change="+21.3%"
            up
            color={C.emerald}
            data={sparkData.pageviews}
          />
          <SparkCard
            label="Bounce Rate"
            value="49.3%"
            change="-3.6%"
            up={false}
            color={C.rose}
            data={sparkData.bounce}
          />
        </div>
      </div>
    </div>
  )
}

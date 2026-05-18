import PageHeader from '../../components/shared/PageHeader'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package } from 'lucide-react'
import useChartColors from '../../hooks/useChartColors'

// ─── Data ────────────────────────────────────────────────────────────────────
const monthlySales = [
  { month: 'Jan', online: 4200, offline: 2800 },
  { month: 'Feb', online: 3800, offline: 3100 },
  { month: 'Mar', online: 5100, offline: 2600 },
  { month: 'Apr', online: 4700, offline: 3400 },
  { month: 'May', online: 6200, offline: 2900 },
  { month: 'Jun', online: 7100, offline: 3200 },
  { month: 'Jul', online: 6800, offline: 3500 },
  { month: 'Aug', online: 7400, offline: 3800 },
]

const departmentRevenue = [
  { name: 'Engineering', revenue: 128000 },
  { name: 'Sales',       revenue: 96000  },
  { name: 'Marketing',   revenue: 74000  },
  { name: 'Design',      revenue: 62000  },
  { name: 'Support',     revenue: 48000  },
  { name: 'HR',          revenue: 36000  },
]

const stackedMonthly = [
  { month: 'Jan', electronics: 3200, clothing: 2100, furniture: 1400 },
  { month: 'Feb', electronics: 2800, clothing: 2500, furniture: 1200 },
  { month: 'Mar', electronics: 4100, clothing: 2900, furniture: 1800 },
  { month: 'Apr', electronics: 3700, clothing: 2300, furniture: 2100 },
  { month: 'May', electronics: 5200, clothing: 3100, furniture: 1600 },
  { month: 'Jun', electronics: 4800, clothing: 3400, furniture: 2200 },
]

const divergingData = [
  { metric: 'Q1 Revenue',  value:  32 },
  { metric: 'Q2 Revenue',  value:  18 },
  { metric: 'Q3 Revenue',  value: -12 },
  { metric: 'Q4 Revenue',  value:  45 },
  { metric: 'Marketing',   value: -28 },
  { metric: 'Operations',  value: -15 },
  { metric: 'R&D',         value: -22 },
  { metric: 'Net Profit',  value:  18 },
]

const miniSales = [
  { d: 'M', v: 42 }, { d: 'T', v: 38 }, { d: 'W', v: 55 },
  { d: 'T', v: 47 }, { d: 'F', v: 62 }, { d: 'S', v: 58 }, { d: 'S', v: 71 },
]
const miniOrders = [
  { d: 'M', v: 18 }, { d: 'T', v: 22 }, { d: 'W', v: 19 },
  { d: 'T', v: 28 }, { d: 'F', v: 24 }, { d: 'S', v: 32 }, { d: 'S', v: 29 },
]
const miniRevenue = [
  { d: 'M', v: 8 }, { d: 'T', v: 12 }, { d: 'W', v: 9 },
  { d: 'T', v: 15 }, { d: 'F', v: 11 }, { d: 'S', v: 18 }, { d: 'S', v: 14 },
]
const miniUsers = [
  { d: 'M', v: 32 }, { d: 'T', v: 28 }, { d: 'W', v: 41 },
  { d: 'T', v: 36 }, { d: 'F', v: 48 }, { d: 'S', v: 44 }, { d: 'S', v: 52 },
]

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-lg min-w-[130px]">
      <p className="font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.fill || p.color }} />
          <span className="text-slate-600 dark:text-slate-400">{p.name}:</span>
          <span className="font-semibold" style={{ color: p.fill || p.color }}>
            {p.value > 999 ? `$${(p.value / 1000).toFixed(0)}k` : p.value.toLocaleString()}
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

// ─── Mini Bar KPI Card ────────────────────────────────────────────────────────
function MiniBarCard({ label, value, change, up, color, data }) {
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
        <BarChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }} barSize={8}>
          <Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function BarChartPage() {
  const C = useChartColors()
  const deptColors = [C.primary, C.cyan, C.emerald, C.amber, C.violet, C.rose]
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bar Charts"
        subtitle="Compare values across categories with vertical, horizontal, and stacked bar charts"
      />

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value="$2.48M"
          change="+18.2%"
          up
          iconBg="bg-indigo-500"
        />
        <StatCard
          icon={ShoppingCart}
          label="Total Orders"
          value="38,492"
          change="+9.6%"
          up
          iconBg="bg-cyan-500"
        />
        <StatCard
          icon={Package}
          label="Avg Order Value"
          value="$64.40"
          change="-2.1%"
          up={false}
          iconBg="bg-amber-400"
        />
      </div>

      {/* ── Full Charts: 2-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Section: Vertical Bar Chart (Grouped) ── */}
        <ChartCard
          title="Monthly Sales — Online vs Offline"
          subtitle="Grouped vertical bar chart · Jan – Aug"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlySales} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barGap={4}>
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
              <Bar dataKey="online"  name="Online"  fill={C.primary} radius={[4, 4, 0, 0]} barSize={18} />
              <Bar dataKey="offline" name="Offline" fill={C.cyan}    radius={[4, 4, 0, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Section: Horizontal Bar Chart (Department Revenue) ── */}
        <ChartCard
          title="Department Revenue"
          subtitle="Horizontal bar chart · revenue contribution by department"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              layout="vertical"
              data={departmentRevenue}
              margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: C.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${v / 1000}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: C.axis }}
                axisLine={false}
                tickLine={false}
                width={88}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Revenue" radius={[0, 6, 6, 0]} barSize={20}>
                {departmentRevenue.map((_, i) => (
                  <Cell key={i} fill={deptColors[i % deptColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Section: Stacked Bar Chart ── */}
        <ChartCard
          title="Stacked Product Categories"
          subtitle="Electronics, Clothing & Furniture stacked · Jan – Jun"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stackedMonthly} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
              <Bar dataKey="electronics" name="Electronics" stackId="a" fill={C.primary}  />
              <Bar dataKey="clothing"    name="Clothing"    stackId="a" fill={C.cyan}     />
              <Bar dataKey="furniture"   name="Furniture"   stackId="a" fill={C.emerald}  radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* ── Section: Diverging Bar Chart ── */}
        <ChartCard
          title="Diverging Bar — P&L Breakdown"
          subtitle="Positive gains vs negative costs across business segments"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              layout="vertical"
              data={divergingData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: C.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="metric"
                tick={{ fontSize: 10, fill: C.axis }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine x={0} stroke={C.axis} strokeWidth={1} />
              <Bar dataKey="value" name="Change %" radius={[0, 4, 4, 0]} barSize={16}>
                {divergingData.map((entry, i) => (
                  <Cell key={i} fill={entry.value >= 0 ? C.emerald : C.rose} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Section: Mini Bar KPI Cards ── */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Weekly KPI Bars</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniBarCard label="Daily Sales"   value="$6,240"  change="+14.2%" up    color={C.primary} data={miniSales}   />
          <MiniBarCard label="Daily Orders"  value="284"     change="+7.9%"  up    color={C.cyan}    data={miniOrders}  />
          <MiniBarCard label="Revenue / Day" value="$18.4k"  change="+22.1%" up    color={C.emerald} data={miniRevenue} />
          <MiniBarCard label="New Users"     value="1,042"   change="-4.3%"  up={false} color={C.violet} data={miniUsers} />
        </div>
      </div>
    </div>
  )
}

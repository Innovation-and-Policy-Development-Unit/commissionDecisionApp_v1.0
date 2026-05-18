import PageHeader from '../../components/shared/PageHeader'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import useChartColors from '../../hooks/useChartColors'

const monthlyData = [
  { month: 'Jan', revenue: 4200, expenses: 2800, profit: 1400 },
  { month: 'Feb', revenue: 3800, expenses: 2400, profit: 1400 },
  { month: 'Mar', revenue: 5200, expenses: 3100, profit: 2100 },
  { month: 'Apr', revenue: 4700, expenses: 2900, profit: 1800 },
  { month: 'May', revenue: 6100, expenses: 3500, profit: 2600 },
  { month: 'Jun', revenue: 5800, expenses: 3200, profit: 2600 },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-card-md">
      <p className="font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="text-xs" style={{ color: p.fill }}>{p.name}: ${p.value.toLocaleString()}</p>
      ))}
    </div>
  )
}

export default function ColumnChartPage() {
  const C = useChartColors()
  return (
    <div className="space-y-6">
      <PageHeader title="Column Charts" subtitle="Vertical bar charts for comparing values across categories" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Column */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Basic Column Chart</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.axis }} axisLine={{ stroke: C.grid }} tickLine={{ stroke: C.grid }} />
              <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={{ stroke: C.grid }} tickLine={{ stroke: C.grid }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" fill={C.primary} radius={[6, 6, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Grouped Column */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Grouped Column Chart</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.axis }} axisLine={{ stroke: C.grid }} tickLine={{ stroke: C.grid }} />
              <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={{ stroke: C.grid }} tickLine={{ stroke: C.grid }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={10} iconType="circle" />
              <Bar dataKey="revenue" fill={C.primary} radius={[4, 4, 0, 0]} name="Revenue" barSize={16} />
              <Bar dataKey="expenses" fill={C.cyan} radius={[4, 4, 0, 0]} name="Expenses" barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stacked Column */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Stacked Column Chart</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.axis }} axisLine={{ stroke: C.grid }} tickLine={{ stroke: C.grid }} />
              <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={{ stroke: C.grid }} tickLine={{ stroke: C.grid }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={10} iconType="circle" />
              <Bar dataKey="profit" stackId="a" fill={C.emerald} name="Profit" />
              <Bar dataKey="expenses" stackId="a" fill={C.primary} radius={[6, 6, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Color-coded */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Color-Coded Columns</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.axis }} axisLine={{ stroke: C.grid }} tickLine={{ stroke: C.grid }} />
              <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={{ stroke: C.grid }} tickLine={{ stroke: C.grid }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]} name="Revenue">
                {monthlyData.map((entry, i) => (
                  <Cell key={i} fill={[C.primary, C.cyan, C.emerald, C.amber, C.violet, C.rose][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Rounded Column */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Rounded Column Chart</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.axis }} axisLine={{ stroke: C.grid }} tickLine={{ stroke: C.grid }} />
              <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={{ stroke: C.grid }} tickLine={{ stroke: C.grid }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={10} iconType="circle" />
              <Bar dataKey="revenue" fill={C.violet} radius={[8, 8, 0, 0]} name="Revenue" barSize={18} />
              <Bar dataKey="profit" fill={C.rose} radius={[8, 8, 0, 0]} name="Profit" barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gradient Column */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Gradient Column Chart</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.primary} stopOpacity={1} />
                  <stop offset="100%" stopColor={C.cyan} stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.amber} stopOpacity={1} />
                  <stop offset="100%" stopColor={C.rose} stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.axis }} axisLine={{ stroke: C.grid }} tickLine={{ stroke: C.grid }} />
              <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={{ stroke: C.grid }} tickLine={{ stroke: C.grid }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconSize={10} iconType="circle" />
              <Bar dataKey="revenue" fill="url(#gradRevenue)" radius={[6, 6, 0, 0]} name="Revenue" barSize={20} />
              <Bar dataKey="expenses" fill="url(#gradExpenses)" radius={[6, 6, 0, 0]} name="Expenses" barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

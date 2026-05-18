import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar
} from 'recharts'
import ChartCard from '../../components/shared/ChartCard'
import PageHeader from '../../components/shared/PageHeader'

const monthData = [
  { month: 'Jan', A: 4200, B: 2800, C: 3100 },
  { month: 'Feb', A: 3800, B: 3200, C: 2900 },
  { month: 'Mar', A: 5100, B: 2600, C: 4200 },
  { month: 'Apr', A: 4700, B: 3800, C: 3800 },
  { month: 'May', A: 6200, B: 4200, C: 5100 },
  { month: 'Jun', A: 5800, B: 3900, C: 4700 },
  { month: 'Jul', A: 7100, B: 4800, C: 6200 },
  { month: 'Aug', A: 6800, B: 5100, C: 5800 },
]

const pieData = [
  { name: 'Electronics', value: 4300, color: '#6366f1' },
  { name: 'Clothing', value: 2800, color: '#8b5cf6' },
  { name: 'Books', value: 1900, color: '#06b6d4' },
  { name: 'Food', value: 1200, color: '#10b981' },
  { name: 'Sports', value: 800, color: '#f59e0b' },
]

const radarData = [
  { subject: 'Sales', A: 120, B: 110, fullMark: 150 },
  { subject: 'Marketing', A: 98, B: 130, fullMark: 150 },
  { subject: 'Development', A: 86, B: 130, fullMark: 150 },
  { subject: 'Customer Service', A: 99, B: 100, fullMark: 150 },
  { subject: 'Analytics', A: 85, B: 90, fullMark: 150 },
  { subject: 'Operations', A: 65, B: 85, fullMark: 150 },
]

const scatterData = [
  { x: 100, y: 200, z: 200 }, { x: 120, y: 100, z: 260 }, { x: 170, y: 300, z: 400 },
  { x: 140, y: 250, z: 280 }, { x: 150, y: 400, z: 500 }, { x: 110, y: 280, z: 200 },
  { x: 130, y: 150, z: 150 }, { x: 160, y: 350, z: 420 }, { x: 90, y: 190, z: 170 },
  { x: 200, y: 450, z: 600 }, { x: 180, y: 320, z: 380 }, { x: 210, y: 500, z: 700 },
]

const radialData = [
  { name: 'Development', value: 85, fill: '#6366f1' },
  { name: 'Marketing', value: 72, fill: '#8b5cf6' },
  { name: 'Sales', value: 91, fill: '#06b6d4' },
  { name: 'Support', value: 68, fill: '#10b981' },
]

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b']

export default function Charts() {
  return (
    <div>
      <PageHeader title="Charts" subtitle="Data visualization using Recharts — line, area, bar, pie, radar, and more" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Line Chart */}
        <ChartCard title="Line Chart" subtitle="Multi-series line chart with custom styling">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="A" name="Product A" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="B" name="Product B" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill: '#06b6d4', r: 4 }} />
              <Line type="monotone" dataKey="C" name="Product C" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Area Chart */}
        <ChartCard title="Area Chart" subtitle="Stacked area chart showing trends">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={monthData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="A" name="Series A" stroke="#6366f1" fill="url(#cA)" strokeWidth={2} />
              <Area type="monotone" dataKey="B" name="Series B" stroke="#06b6d4" fill="url(#cB)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Bar Chart */}
        <ChartCard title="Bar Chart" subtitle="Grouped bar chart with multiple series">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="A" name="Q1" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="B" name="Q2" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="C" name="Q3" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Pie Chart */}
        <ChartCard title="Pie Chart" subtitle="Category distribution with custom labels">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={true}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v.toLocaleString(), 'Sales']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>

        {/* Donut Chart */}
        <ChartCard title="Donut Chart" subtitle="Donut variant with legend">
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="60%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [v.toLocaleString(), 'Sales']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="text-slate-600 dark:text-slate-400 text-xs">{item.name}</span>
                  </div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* Radar Chart */}
        <ChartCard title="Radar Chart" subtitle="Performance comparison between two teams">
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <PolarRadiusAxis angle={30} domain={[0, 150]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
              <Radar name="Team Alpha" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} strokeWidth={2} />
              <Radar name="Team Beta" dataKey="B" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} strokeWidth={2} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Scatter Chart */}
        <ChartCard title="Scatter Chart" subtitle="Correlation between variables">
          <ResponsiveContainer width="100%" height={250}>
            <ScatterChart margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
              <XAxis type="number" dataKey="x" name="X Value" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="number" dataKey="y" name="Y Value" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Data Points" data={scatterData} fill="#6366f1" opacity={0.8} />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Radial Bar Chart */}
        <ChartCard title="Radial Bar Chart" subtitle="Department performance scores">
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="60%" height={220}>
              <RadialBarChart innerRadius={30} outerRadius={100} data={radialData} startAngle={180} endAngle={0}>
                <RadialBar background dataKey="value" />
                <Tooltip formatter={(v) => [`${v}%`, 'Score']} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {radialData.map((item) => (
                <div key={item.name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                    <span className="text-xs font-semibold" style={{ color: item.fill }}>{item.value}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${item.value}%`, background: item.fill }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts'
import useChartColors from '../../hooks/useChartColors'
import ChartCard from '../../components/shared/ChartCard'
import StatCard from '../../components/shared/StatCard'
import PageHeader from '../../components/shared/PageHeader'
import { BarChart3, Users, Globe, TrendingUp } from 'lucide-react'

const pageViewsData = [
  { date: 'Mar 1', views: 12400, unique: 8200, bounces: 3100 },
  { date: 'Mar 2', views: 14200, unique: 9400, bounces: 2900 },
  { date: 'Mar 3', views: 11800, unique: 7800, bounces: 3400 },
  { date: 'Mar 4', views: 13600, unique: 9100, bounces: 3000 },
  { date: 'Mar 5', views: 15900, unique: 10500, bounces: 2700 },
  { date: 'Mar 6', views: 18200, unique: 12100, bounces: 2500 },
  { date: 'Mar 7', views: 16400, unique: 10900, bounces: 2800 },
  { date: 'Mar 8', views: 19800, unique: 13200, bounces: 2300 },
  { date: 'Mar 9', views: 21200, unique: 14100, bounces: 2100 },
  { date: 'Mar 10', views: 23400, unique: 15600, bounces: 1900 },
  { date: 'Mar 11', views: 22100, unique: 14700, bounces: 2000 },
]

const countryData = [
  { country: 'United States', sessions: 45231, percent: 38 },
  { country: 'United Kingdom', sessions: 21432, percent: 18 },
  { country: 'Germany', sessions: 15678, percent: 13 },
  { country: 'France', sessions: 12340, percent: 10 },
  { country: 'Canada', sessions: 9876, percent: 8 },
  { country: 'Australia', sessions: 8765, percent: 7 },
  { country: 'Japan', sessions: 6543, percent: 5 },
  { country: 'Other', sessions: 5432, percent: 1 },
]

const radarData = [
  { subject: 'Engagement', A: 82, fullMark: 100 },
  { subject: 'Retention', A: 68, fullMark: 100 },
  { subject: 'Acquisition', A: 75, fullMark: 100 },
  { subject: 'Conversion', A: 59, fullMark: 100 },
  { subject: 'Satisfaction', A: 88, fullMark: 100 },
  { subject: 'Revenue', A: 71, fullMark: 100 },
]

const channelData = [
  { channel: 'Organic', Jan: 4200, Feb: 3800, Mar: 5100 },
  { channel: 'Paid', Jan: 2800, Feb: 3200, Mar: 2900 },
  { channel: 'Social', Jan: 1900, Feb: 2100, Mar: 2400 },
  { channel: 'Email', Jan: 1200, Feb: 1400, Mar: 1600 },
  { channel: 'Direct', Jan: 3400, Feb: 3600, Mar: 3900 },
]

const topPages = [
  { page: '/dashboard', views: 45231, avgTime: '4m 23s', bounce: '24%' },
  { page: '/products', views: 32145, avgTime: '3m 12s', bounce: '31%' },
  { page: '/pricing', views: 28901, avgTime: '2m 45s', bounce: '38%' },
  { page: '/blog', views: 21432, avgTime: '5m 17s', bounce: '22%' },
  { page: '/checkout', views: 18765, avgTime: '2m 03s', bounce: '19%' },
  { page: '/contact', views: 12340, avgTime: '1m 58s', bounce: '52%' },
]

export default function Analytics() {
  const C = useChartColors()

  const deviceData = [
    { name: 'Desktop', value: 54, color: C.primary },
    { name: 'Mobile', value: 36, color: C.cyan },
    { name: 'Tablet', value: 10, color: C.emerald },
  ]

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="In-depth analysis of your website traffic and user behavior."
        action={
          <div className="flex gap-2">
            <select className="input text-sm w-auto">
              <option>Last 30 days</option>
              <option>Last 7 days</option>
              <option>Last 90 days</option>
            </select>
            <button className="btn-primary btn-sm">Export</button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard title="Page Views" value="223,400" icon={BarChart3} change={16.8} color="purple" />
        <StatCard title="Unique Visitors" value="148,700" icon={Users} change={12.3} color="cyan" />
        <StatCard title="Sessions" value="197,200" icon={Globe} change={14.1} color="emerald" />
        <StatCard title="Avg. Session" value="3m 42s" icon={TrendingUp} change={8.2} color="amber" />
      </div>

      {/* Page Views Chart */}
      <div className="mb-6">
        <ChartCard title="Page Views & Unique Visitors" subtitle="Daily traffic over the last 11 days">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={pageViewsData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="views" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.primary} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="unique" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.cyan} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={C.cyan} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} strokeOpacity={0.5} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} tickFormatter={v => `${v/1000}k`} />
              <Tooltip formatter={v => v.toLocaleString()} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
              <Area type="monotone" dataKey="views" name="Page Views" stroke={C.primary} strokeWidth={2} fill="url(#views)" />
              <Area type="monotone" dataKey="unique" name="Unique Visitors" stroke={C.cyan} strokeWidth={2} fill="url(#unique)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        {/* Performance Radar */}
        <ChartCard title="Performance Metrics" subtitle="Key performance indicators">
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={C.grid} />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: C.axis }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: C.axis }} />
              <Radar name="Score" dataKey="A" stroke={C.primary} fill={C.primary} fillOpacity={0.3} strokeWidth={2} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Device Breakdown */}
        <ChartCard title="Device Breakdown" subtitle="Visitors by device type">
          <div className="space-y-4 mt-2">
            {deviceData.map((d) => (
              <div key={d.name}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{d.name}</span>
                  <span className="text-sm font-semibold" style={{ color: d.color }}>{d.value}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${d.value}%`, background: d.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {deviceData.map(d => (
              <div key={d.name} className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                <div className="text-xl font-bold" style={{ color: d.color }}>{d.value}%</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{d.name}</div>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Top Countries */}
        <ChartCard title="Top Countries" subtitle="Sessions by geography">
          <div className="space-y-2 mt-1">
            {countryData.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{c.country}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 ml-2">{c.sessions.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full"
                      style={{ width: `${c.percent}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Top Pages Table */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Top Pages</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Most visited pages this period</p>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Page Views</th>
                <th>Avg. Time on Page</th>
                <th>Bounce Rate</th>
                <th>Traffic</th>
              </tr>
            </thead>
            <tbody>
              {topPages.map((page, i) => (
                <tr key={i}>
                  <td className="font-mono text-sm text-primary-600 dark:text-primary-400">{page.page}</td>
                  <td className="font-semibold text-slate-800 dark:text-slate-200">{page.views.toLocaleString()}</td>
                  <td className="text-slate-600 dark:text-slate-400">{page.avgTime}</td>
                  <td className="text-slate-600 dark:text-slate-400">{page.bounce}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden max-w-24">
                        <div
                          className="h-full bg-primary-500 rounded-full"
                          style={{ width: `${(page.views / 45231) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{Math.round((page.views / 45231) * 100)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

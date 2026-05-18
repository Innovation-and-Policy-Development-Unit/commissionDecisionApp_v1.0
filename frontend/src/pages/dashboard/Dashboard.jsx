import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import useChartColors from '../../hooks/useChartColors'
import Badge from '../../components/shared/Badge'
import Avatar from '../../components/shared/Avatar'
import PageHeader from '../../components/shared/PageHeader'
import {
  Users, DollarSign, ShoppingCart, ArrowUpRight, ArrowDownRight,
  Clock, Activity, Eye, Globe, Zap, MousePointer,
  RefreshCw, MoreHorizontal, ChevronRight, Filter, Download,
  TrendingUp
} from 'lucide-react'

const revenueData = [
  { month: 'Jan', revenue: 32000, target: 30000, profit: 12800, expenses: 19200 },
  { month: 'Feb', revenue: 38000, target: 35000, profit: 16340, expenses: 21660 },
  { month: 'Mar', revenue: 35000, target: 38000, profit: 13650, expenses: 21350 },
  { month: 'Apr', revenue: 45000, target: 42000, profit: 19800, expenses: 25200 },
  { month: 'May', revenue: 42000, target: 44000, profit: 17640, expenses: 24360 },
  { month: 'Jun', revenue: 53000, target: 48000, profit: 24380, expenses: 28620 },
  { month: 'Jul', revenue: 48000, target: 50000, profit: 20160, expenses: 27840 },
  { month: 'Aug', revenue: 61000, target: 55000, profit: 28060, expenses: 32940 },
  { month: 'Sep', revenue: 58000, target: 58000, profit: 25520, expenses: 32480 },
  { month: 'Oct', revenue: 67000, target: 62000, profit: 31490, expenses: 35510 },
  { month: 'Nov', revenue: 72000, target: 68000, profit: 34560, expenses: 37440 },
  { month: 'Dec', revenue: 85000, target: 75000, profit: 42500, expenses: 42500 },
]

const weeklyVisitors = [
  { day: 'Mon', newV: 420, returning: 780 },
  { day: 'Tue', newV: 380, returning: 690 },
  { day: 'Wed', newV: 510, returning: 820 },
  { day: 'Thu', newV: 470, returning: 760 },
  { day: 'Fri', newV: 620, returning: 910 },
  { day: 'Sat', newV: 390, returning: 580 },
  { day: 'Sun', newV: 280, returning: 450 },
]

const performanceData = [
  { metric: 'Conversion', value: 85 },
  { metric: 'Retention', value: 72 },
  { metric: 'Satisfaction', value: 91 },
  { metric: 'Engagement', value: 78 },
  { metric: 'Speed', value: 88 },
  { metric: 'Quality', value: 94 },
]

const topCountries = [
  { country: 'United States', users: 8420, pct: 34, flag: 'US', color: 'bg-primary-500' },
  { country: 'United Kingdom', users: 4210, pct: 17, flag: 'UK', color: 'bg-cyan-500' },
  { country: 'Germany', users: 3180, pct: 13, flag: 'DE', color: 'bg-emerald-500' },
  { country: 'France', users: 2640, pct: 11, flag: 'FR', color: 'bg-violet-500' },
]

const recentOrders = [
  { id: '#ORD-7823', customer: 'Alice Johnson', product: 'MacBook Pro 14"', amount: '$2,499', status: 'completed', date: 'Mar 11' },
  { id: '#ORD-7822', customer: 'Bob Smith', product: 'iPhone 16 Pro', amount: '$1,199', status: 'processing', date: 'Mar 11' },
  { id: '#ORD-7821', customer: 'Carol Williams', product: 'iPad Air', amount: '$749', status: 'completed', date: 'Mar 10' },
  { id: '#ORD-7820', customer: 'David Brown', product: 'AirPods Pro', amount: '$249', status: 'pending', date: 'Mar 10' },
  { id: '#ORD-7819', customer: 'Emma Davis', product: 'Apple Watch Ultra', amount: '$799', status: 'completed', date: 'Mar 09' },
  { id: '#ORD-7818', customer: 'Frank Wilson', product: 'Magic Keyboard', amount: '$129', status: 'cancelled', date: 'Mar 09' },
]

const statusConfig = {
  completed: { label: 'Completed', variant: 'success' },
  processing: { label: 'Processing', variant: 'info' },
  pending: { label: 'Pending', variant: 'warning' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
}

const activities = [
  { color: 'bg-primary-500', text: 'New order #7823 placed by Alice Johnson', time: '2m ago', type: 'Order' },
  { color: 'bg-cyan-500', text: 'Sarah Connor registered as new user', time: '15m ago', type: 'User' },
  { color: 'bg-emerald-500', text: 'Order #7819 delivered successfully', time: '1h ago', type: 'Delivery' },
  { color: 'bg-amber-500', text: 'Server response time alert triggered', time: '2h ago', type: 'Alert' },
  { color: 'bg-violet-500', text: '5-star review from Mike Davis on MacBook', time: '4h ago', type: 'Review' },
  { color: 'bg-rose-500', text: 'New partnership request from TechCorp', time: '5h ago', type: 'Partner' },
]

// Audience metrics data
const audienceData = [
  { day: '1', current: 680, previous: 520 }, { day: '3', current: 720, previous: 580 },
  { day: '5', current: 650, previous: 610 }, { day: '7', current: 810, previous: 550 },
  { day: '9', current: 760, previous: 620 }, { day: '11', current: 830, previous: 590 },
  { day: '13', current: 780, previous: 640 }, { day: '15', current: 850, previous: 560 },
  { day: '17', current: 720, previous: 600 }, { day: '19', current: 790, previous: 630 },
  { day: '21', current: 860, previous: 570 }, { day: '23', current: 810, previous: 610 },
  { day: '25', current: 740, previous: 650 }, { day: '27', current: 880, previous: 580 },
  { day: '29', current: 830, previous: 620 }, { day: '31', current: 900, previous: 590 },
]
const bounceData = [
  { v: 38 }, { v: 35 }, { v: 40 }, { v: 36 }, { v: 34 }, { v: 32 }, { v: 35 },
  { v: 30 }, { v: 28 }, { v: 33 }, { v: 31 }, { v: 29 }, { v: 26 }, { v: 24 },
]
const userBars = [
  { v: 60 }, { v: 75 }, { v: 50 }, { v: 85 }, { v: 70 }, { v: 90 }, { v: 65 },
  { v: 80 }, { v: 55 }, { v: 95 }, { v: 70 }, { v: 45 },
]
const sessionBars = [
  { a: 40, b: 30 }, { a: 55, b: 25 }, { a: 35, b: 40 }, { a: 60, b: 35 },
  { a: 50, b: 30 }, { a: 70, b: 20 }, { a: 45, b: 35 }, { a: 65, b: 25 },
  { a: 55, b: 30 }, { a: 75, b: 20 },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card p-3 shadow-card-lg text-xs min-w-32">
      <p className="font-bold text-slate-700 dark:text-slate-200 mb-2 border-b border-slate-100 dark:border-slate-700 pb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey || p.name} className="flex items-center justify-between gap-4 mt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-500">{p.name}</span>
          </div>
          <span className="font-bold text-slate-800 dark:text-slate-100">${(p.value || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

const sparkVals = [3, 7, 5, 9, 6, 12, 8, 14, 11, 16]
function MiniSparkline({ color }) {
  const max = Math.max(...sparkVals)
  const pts = sparkVals.map((v, i) => `${(i / (sparkVals.length - 1)) * 100},${100 - (v / max) * 80}`).join(' ')
  return (
    <svg viewBox="0 0 100 100" className="w-16 h-8 overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Dashboard() {
  const [period, setPeriod] = useState('Day')
  const C = useChartColors()

  const stats = [
    { title: 'Total Revenue', value: '$85,294', change: 18.2, sub: '$12,426 today', icon: DollarSign, cardBg: 'bg-primary-50 dark:bg-primary-900/20', iconBg: 'bg-primary-100 dark:bg-primary-800/40', iconColor: 'text-primary-600 dark:text-primary-400', sparkColor: C.primary, accent: 'border-primary-100 dark:border-primary-800/30', valueColor: 'text-primary-700 dark:text-primary-200' },
    { title: 'Active Users', value: '24,521', change: 12.5, sub: '138 joined today', icon: Users, cardBg: 'bg-cyan-50 dark:bg-cyan-900/20', iconBg: 'bg-cyan-100 dark:bg-cyan-800/40', iconColor: 'text-cyan-600 dark:text-cyan-400', sparkColor: C.cyan, accent: 'border-cyan-100 dark:border-cyan-800/30', valueColor: 'text-cyan-700 dark:text-cyan-200' },
    { title: 'Total Orders', value: '1,429', change: 8.7, sub: '24 orders today', icon: ShoppingCart, cardBg: 'bg-emerald-50 dark:bg-emerald-900/20', iconBg: 'bg-emerald-100 dark:bg-emerald-800/40', iconColor: 'text-emerald-600 dark:text-emerald-400', sparkColor: C.emerald, accent: 'border-emerald-100 dark:border-emerald-800/30', valueColor: 'text-emerald-700 dark:text-emerald-200' },
    { title: 'Conversion', value: '3.24%', change: -0.5, sub: 'Avg session 4m 32s', icon: MousePointer, cardBg: 'bg-amber-50 dark:bg-amber-900/20', iconBg: 'bg-amber-100 dark:bg-amber-800/40', iconColor: 'text-amber-600 dark:text-amber-400', sparkColor: C.amber, accent: 'border-amber-100 dark:border-amber-800/30', valueColor: 'text-amber-700 dark:text-amber-200' },
  ]

  return (
    <div className="space-y-6 bg-white dark:bg-slate-900 -m-4 sm:-m-6 p-4 sm:p-6 min-h-screen">

      {/* ── Website Audience Metrics Banner ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Left — Audience Chart Card */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between px-5 pt-5 pb-3 gap-3">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Website Audience Metrics</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Audience to which the users belonged while on the current date range.</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
              {['Day', 'Week', 'Month'].map(tab => (
                <button key={tab} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${period === tab ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`} onClick={() => setPeriod(tab)}>
                  {tab}
                </button>
              ))}
            </div>
          </div>
          {/* Metric strip */}
          <div className="flex flex-wrap gap-6 px-5 pb-4">
            {[
              { label: 'Users', value: '13,956' },
              { label: 'Bounce Rate', value: '33.50%' },
              { label: 'Page Views', value: '83,123' },
              { label: 'Sessions', value: '16,869' },
            ].map(m => (
              <div key={m.label}>
                <p className="text-xs text-slate-500 dark:text-slate-400">{m.label}</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{m.value}</p>
              </div>
            ))}
          </div>
          {/* Dual line chart */}
          <div className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={audienceData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gAudBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gAudPurple" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.violet} stopOpacity={0.1} />
                    <stop offset="100%" stopColor={C.violet} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.axis }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '12px' }} />
                <Area type="monotone" dataKey="current" name="Current" stroke={C.primary} strokeWidth={2} fill="url(#gAudBlue)" dot={false} />
                <Area type="monotone" dataKey="previous" name="Previous" stroke={C.violet} strokeWidth={2} fill="url(#gAudPurple)" dot={false} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right — 2x2 Stat Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {/* Bounce Rate */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">33.50%</p>
              <span className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-500"><ArrowUpRight size={11} />18.02%</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Bounce Rate</p>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={60}>
                <AreaChart data={bounceData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gBounce" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.cyan} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={C.cyan} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke={C.cyan} strokeWidth={1.5} fill="url(#gBounce)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Total Users */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">86k</p>
              <span className="flex items-center gap-0.5 text-[11px] font-semibold text-red-400"><ArrowDownRight size={11} />0.86%</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Total Users</p>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={60}>
                <BarChart data={userBars} barSize={6} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Bar dataKey="v" radius={[3, 3, 0, 0]} fill={C.primary} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* All Sessions */}
          <div className="col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">ALL SESSIONS</p>
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">16,869</p>
                  <span className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-500"><ArrowUpRight size={11} />2.87%</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">The total number of sessions within the date range. It is the period time a user is actively engaged with your website.</p>
              </div>
              <div className="w-32 shrink-0">
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={sessionBars} barSize={8} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Bar dataKey="a" stackId="s" radius={[0, 0, 0, 0]} fill={C.primary} />
                    <Bar dataKey="b" stackId="s" radius={[3, 3, 0, 0]} fill={C.violet} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards — light style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.title} className={`rounded-xl border ${s.cardBg} ${s.accent} p-5`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`w-11 h-11 rounded-xl ${s.iconBg} flex items-center justify-center`}>
                <s.icon size={20} className={s.iconColor} />
              </div>
              <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${s.change >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-500'}`}>
                {s.change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(s.change)}%
              </div>
            </div>
            <p className={`text-2xl font-bold ${s.valueColor}`}>{s.value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{s.title}</p>
            <div className={`flex items-center justify-between mt-4 pt-3 border-t ${s.accent}`}>
              <span className="text-xs text-slate-400">{s.sub}</span>
              <MiniSparkline color={s.sparkColor} />
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Chart + Metrics */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Revenue Overview</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Profit, expenses & target tracking</p>
            </div>
            <div className="flex gap-1">
              {['3M', '6M', '1Y'].map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${period === p ? 'bg-primary-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400" /><span className="text-xs text-slate-500">Profit</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary-400" /><span className="text-xs text-slate-500">Expenses</span></div>
              <div className="flex items-center gap-1.5"><span className="w-5 h-0.5 bg-amber-500 rounded-full" /><span className="text-xs text-slate-500">Target</span></div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={revenueData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barGap={0} barCategoryGap="20%">
                <defs>
                  <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.emerald} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={C.emerald} stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="gExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} tickFormatter={v => `$${v / 1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="profit" name="Profit" fill="url(#gProfit)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="expenses" name="Expenses" fill="url(#gExpenses)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Line type="monotone" dataKey="target" name="Target" stroke={C.amber} strokeWidth={2.5} strokeDasharray="6 3" dot={false} activeDot={{ r: 5, fill: C.amber, stroke: '#fff', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Key Metrics</h3>
              <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><RefreshCw size={14} /></button>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Page Views', value: '284,521', change: '+8.2%', icon: Eye },
                { label: 'Bounce Rate', value: '24.8%', change: '-2.1%', icon: Activity },
              ].map(m => (
                <div key={m.label} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center shrink-0">
                    <m.icon size={14} className="text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-400">{m.label}</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{m.value}</p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{m.change}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2">Performance Radar</h3>
            <ResponsiveContainer width="100%" height={160}>
              <RadarChart data={performanceData}>
                <PolarGrid stroke={C.grid} />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: C.axis }} />
                <Radar dataKey="value" stroke={C.primary} fill={C.primary} fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Weekly Visitors + Countries */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Weekly Visitors</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">New vs returning this week</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary-500 block" /><span className="text-xs text-slate-500">New</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-cyan-400 block" /><span className="text-xs text-slate-500">Returning</span></div>
            </div>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyVisitors} barCategoryGap="35%" margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.bg} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                <Bar dataKey="newV" name="New" fill={C.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="returning" name="Returning" fill={C.cyan} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-800 dark:text-slate-200">Top Countries</h3>
            <button className="text-xs text-primary-600 dark:text-primary-400 font-medium flex items-center gap-0.5">All <ChevronRight size={12} /></button>
          </div>
          <div className="space-y-4">
            {topCountries.map(c => (
              <div key={c.country}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-5 bg-slate-200 dark:bg-slate-600 rounded text-[9px] flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">{c.flag}</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{c.country}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{c.pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full ${c.color} rounded-full`} style={{ width: `${c.pct}%` }} />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{c.users.toLocaleString()} users</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Orders + Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Recent Orders</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Latest 6 transactions</p>
            </div>
            <button className="btn-outline btn-sm">View All</button>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Order ID</th><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {recentOrders.map(order => {
                  const s = statusConfig[order.status]
                  return (
                    <tr key={order.id}>
                      <td className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400">{order.id}</td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={order.customer} size="sm" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{order.customer}</span>
                        </div>
                      </td>
                      <td className="text-slate-500 dark:text-slate-400 text-sm">{order.product}</td>
                      <td className="font-bold text-slate-800 dark:text-slate-200">{order.amount}</td>
                      <td><Badge variant={s.variant} dot>{s.label}</Badge></td>
                      <td className="text-slate-400 text-xs">{order.date}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-800 dark:text-slate-200">Live Activity</h3>
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />Live
            </span>
          </div>
          <div className="relative">
            <div className="absolute start-3.5 top-3 bottom-3 w-px bg-slate-100 dark:bg-slate-700" />
            <div className="space-y-1">
              {activities.map(item => (
                <div key={item.text} className="flex gap-4 relative group">
                  <div className={`w-7 h-7 rounded-full ${item.color} flex items-center justify-center shrink-0 z-10 shadow-sm mt-0.5`}>
                    <Zap size={11} className="text-white" />
                  </div>
                  <div className="flex-1 pb-4 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{item.text}</p>
                      <button className="opacity-0 group-hover:opacity-100 text-slate-400 transition-all shrink-0"><MoreHorizontal size={12} /></button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-medium">{item.type}</span>
                      <span className="text-[10px] text-slate-400">{item.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

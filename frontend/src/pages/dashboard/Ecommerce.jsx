import { useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts'
import useChartColors from '../../hooks/useChartColors'
import Badge from '../../components/shared/Badge'
import PageHeader from '../../components/shared/PageHeader'
import {
  ShoppingBag, DollarSign, Package, Users, Star,
  ArrowUpRight, ArrowDownRight, ShoppingCart, CreditCard, Truck,
  RefreshCw, Eye, Heart, Plus, MoreVertical, ChevronRight,
  TrendingUp, Zap, Globe, AlertTriangle, CheckCircle, Clock,
  MapPin, Tag, BarChart2, Activity, Layers
} from 'lucide-react'

const monthlySales = [
  { month: 'Jan', online: 32000, offline: 18000, refunds: 2400 },
  { month: 'Feb', online: 41000, offline: 22000, refunds: 1800 },
  { month: 'Mar', online: 38000, offline: 20000, refunds: 2100 },
  { month: 'Apr', online: 52000, offline: 26000, refunds: 3200 },
  { month: 'May', online: 47000, offline: 24000, refunds: 2700 },
  { month: 'Jun', online: 61000, offline: 29000, refunds: 3800 },
  { month: 'Jul', online: 55000, offline: 27000, refunds: 2900 },
  { month: 'Aug', online: 72000, offline: 33000, refunds: 4200 },
]

const revenueArea = [
  { day: 'Mon', revenue: 8200, orders: 64 },
  { day: 'Tue', revenue: 11400, orders: 89 },
  { day: 'Wed', revenue: 9800, orders: 76 },
  { day: 'Thu', revenue: 14200, orders: 112 },
  { day: 'Fri', revenue: 16800, orders: 131 },
  { day: 'Sat', revenue: 13200, orders: 104 },
  { day: 'Sun', revenue: 10600, orders: 83 },
]

// categoryData moved inside component for dynamic chart colors

const orderPipeline = [
  { label: 'Pending', count: 48, pct: 12, color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800/30', icon: ShoppingCart },
  { label: 'Processing', count: 124, pct: 31, color: 'bg-cyan-500', textColor: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-100 dark:border-cyan-800/30', icon: RefreshCw },
  { label: 'Shipped', count: 186, pct: 46, color: 'bg-primary-500', textColor: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20', border: 'border-primary-100 dark:border-primary-800/30', icon: Truck },
  { label: 'Delivered', count: 44, pct: 11, color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-800/30', icon: Package },
]

const topProducts = [
  { name: 'MacBook Pro 14"', img: 'MB', category: 'Electronics', sold: 234, revenue: '$584,766', rating: 4.9, growth: 12.5, stock: 42, trend: [40, 55, 48, 62, 58, 71, 65] },
  { name: 'iPhone 16 Pro', img: 'IP', category: 'Electronics', sold: 891, revenue: '$1,067,709', rating: 4.8, growth: 8.3, stock: 118, trend: [70, 82, 75, 91, 88, 95, 90] },
  { name: 'iPad Air 6', img: 'PA', category: 'Electronics', sold: 456, revenue: '$341,544', rating: 4.7, growth: -2.1, stock: 7, trend: [60, 55, 52, 58, 54, 49, 51] },
  { name: 'AirPods Pro 3', img: 'AP', category: 'Audio', sold: 1203, revenue: '$299,547', rating: 4.8, growth: 24.7, stock: 234, trend: [30, 40, 52, 61, 70, 85, 92] },
  { name: 'Apple Watch Ultra 2', img: 'AW', category: 'Wearables', sold: 318, revenue: '$254,082', rating: 4.9, growth: 15.9, stock: 55, trend: [45, 52, 48, 58, 62, 69, 74] },
]

const recentReviews = [
  { customer: 'Sarah M.', product: 'MacBook Pro 14"', rating: 5, comment: 'Absolutely love this machine! Performance is incredible for my design work.', time: '2h ago', verified: true },
  { customer: 'James K.', product: 'iPhone 16 Pro', rating: 5, comment: 'Camera system is unbelievable. Best smartphone I have ever owned by far.', time: '4h ago', verified: true },
  { customer: 'Emily R.', product: 'AirPods Pro 3', rating: 4, comment: 'Great noise cancellation but case feels a bit slippery to hold.', time: '6h ago', verified: false },
]

const inventoryAlerts = [
  { name: 'iPad Air 6', stock: 7, threshold: 10, status: 'critical', sku: 'SKU-1002' },
  { name: 'Magic Mouse', stock: 14, threshold: 20, status: 'low', sku: 'SKU-1087' },
  { name: 'USB-C Hub', stock: 18, threshold: 25, status: 'low', sku: 'SKU-1134' },
]

// trafficSources moved inside component for dynamic chart colors

const recentOrders = [
  { id: '#EC-9241', customer: 'Alice Johnson', item: 'MacBook Pro 14"', amount: '$2,499', status: 'completed', date: 'Mar 11, 09:14' },
  { id: '#EC-9240', customer: 'Bob Martinez', item: 'iPhone 16 Pro × 2', amount: '$2,398', status: 'processing', date: 'Mar 11, 08:52' },
  { id: '#EC-9239', customer: 'Carol White', item: 'AirPods Pro 3', amount: '$249', status: 'shipped', date: 'Mar 11, 07:30' },
]

const statusConfig = {
  completed: { label: 'Completed', variant: 'success' },
  processing: { label: 'Processing', variant: 'info' },
  shipped: { label: 'Shipped', variant: 'primary' },
  pending: { label: 'Pending', variant: 'warning' },
}

const MiniTrend = ({ data, up }) => {
  const max = Math.max(...data), min = Math.min(...data)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 60},${30 - ((v - min) / (max - min || 1)) * 25}`).join(' ')
  return (
    <svg viewBox="0 0 60 30" className="w-12 h-6">
      <polyline points={pts} fill="none" stroke={up ? '#10b981' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card p-3 shadow-card-lg text-xs min-w-32">
      <p className="font-bold text-slate-700 dark:text-slate-200 mb-1.5 pb-1 border-b border-slate-100 dark:border-slate-700">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey || p.name} className="flex items-center justify-between gap-4 mt-1">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />{p.name}
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-100">${(p.value || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export default function Ecommerce() {
  const [tab, setTab] = useState('all')
  const C = useChartColors()

  const categoryData = [
    { name: 'Electronics', value: 38, color: C.primary, amount: '$34,218', growth: 12.4 },
    { name: 'Clothing', value: 24, color: C.cyan, amount: '$21,600', growth: 8.1 },
    { name: 'Home & Garden', value: 18, color: C.emerald, amount: '$16,200', growth: 5.3 },
    { name: 'Sports', value: 12, color: C.amber, amount: '$10,800', growth: -2.1 },
    { name: 'Books', value: 8, color: C.rose, amount: '$7,200', growth: 3.8 },
  ]

  const trafficSources = [
    { source: 'Organic Search', visits: 42840, conv: 3.8, color: C.primary, pct: 42 },
    { source: 'Direct', visits: 21420, conv: 5.2, color: C.cyan, pct: 21 },
    { source: 'Social Media', visits: 18360, conv: 2.4, color: C.emerald, pct: 18 },
    { source: 'Email Campaign', visits: 12240, conv: 6.7, color: C.amber, pct: 12 },
  ]

  const monthlyGoal = 100000
  const currentRevenue = 84200
  const goalPct = Math.round((currentRevenue / monthlyGoal) * 100)

  const kpis = [
    { label: 'Gross Revenue', value: '$89,423', change: 14.3, icon: DollarSign, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20', border: 'border-primary-100 dark:border-primary-800/30' },
    { label: 'Total Orders', value: '3,842', change: 9.1, icon: ShoppingBag, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-100 dark:border-cyan-800/30' },
    { label: 'Avg Order Value', value: '$127', change: 5.4, icon: CreditCard, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-800/30' },
    { label: 'Return Rate', value: '2.8%', change: -0.4, icon: RefreshCw, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800/30' },
    { label: 'Total Customers', value: '12,491', change: 22.8, icon: Users, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-100 dark:border-violet-800/30' },
    { label: 'Wishlist Items', value: '8,204', change: 11.2, icon: Heart, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-100 dark:border-rose-800/30' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="eCommerce Dashboard"
        subtitle="Track store performance, inventory, and sales metrics in real-time."
        action={
          <div className="flex gap-2">
            <button className="btn-outline btn-sm"><Eye size={14} className="me-1.5 inline" />View Store</button>
            <button className="btn-primary btn-sm"><Plus size={14} className="me-1.5 inline" />Add Product</button>
          </div>
        }
      />

      {/* ── Quick Stat Icons ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Products', value: '$96k', icon: ShoppingBag, bg: 'bg-amber-50 dark:bg-amber-900/15', iconBg: 'bg-amber-100 dark:bg-amber-800/40', iconColor: 'text-amber-600', labelColor: 'text-amber-600 dark:text-amber-400' },
          { label: 'Customers', value: '12,491', icon: Users, bg: 'bg-violet-50 dark:bg-violet-900/15', iconBg: 'bg-violet-100 dark:bg-violet-800/40', iconColor: 'text-violet-600', labelColor: 'text-violet-600 dark:text-violet-400' },
          { label: 'Orders', value: '3,842', icon: ShoppingCart, bg: 'bg-rose-50 dark:bg-rose-900/15', iconBg: 'bg-rose-100 dark:bg-rose-800/40', iconColor: 'text-rose-600', labelColor: 'text-rose-600 dark:text-rose-400' },
          { label: 'Invoices', value: '1,259', icon: CreditCard, bg: 'bg-sky-50 dark:bg-sky-900/15', iconBg: 'bg-sky-100 dark:bg-sky-800/40', iconColor: 'text-sky-600', labelColor: 'text-sky-600 dark:text-sky-400' },
          { label: 'Reviews', value: '8,204', icon: Star, bg: 'bg-emerald-50 dark:bg-emerald-900/15', iconBg: 'bg-emerald-100 dark:bg-emerald-800/40', iconColor: 'text-emerald-600', labelColor: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Refunds', value: '284', icon: RefreshCw, bg: 'bg-pink-50 dark:bg-pink-900/15', iconBg: 'bg-pink-100 dark:bg-pink-800/40', iconColor: 'text-pink-600', labelColor: 'text-pink-600 dark:text-pink-400' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
            <div className={`w-12 h-12 rounded-2xl ${s.iconBg} flex items-center justify-center mx-auto mb-2.5`}>
              <s.icon size={22} className={s.iconColor} />
            </div>
            <p className={`text-xs font-semibold ${s.labelColor}`}>{s.label}</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Revenue Updates + Yearly/Monthly Breakup ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Updates Chart */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 gap-3">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Revenue Updates</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Overview of profit</p>
            </div>
            <select className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20">
              <option>Year 2026</option>
              <option>Year 2025</option>
            </select>
          </div>
          <div className="flex flex-col lg:flex-row">
            <div className="flex-1 p-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlySales} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: C.axis }} axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="online" name="Online" fill={C.primary} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="offline" name="Offline" fill={C.cyan} radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="lg:w-56 p-5 lg:border-s border-t lg:border-t-0 border-slate-100 dark:border-slate-700 flex flex-col justify-center gap-4">
              <div className="text-center lg:text-start">
                <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">$63,489</p>
                <p className="text-xs text-slate-400 mt-1">Total Earnings</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Earnings this month</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">$48,820</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-300 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Expense this month</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">$26,498</p>
                  </div>
                </div>
              </div>
              <button className="btn-primary btn-sm w-full mt-1">View Full Report</button>
            </div>
          </div>
        </div>

        {/* Right — Yearly Breakup + Monthly Earnings */}
        <div className="flex flex-col gap-4">
          {/* Yearly Breakup */}
          <div className="card p-5 flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Yearly Breakup</h4>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-2">$36,358</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-500"><ArrowUpRight size={12} />+9%</span>
                  <span className="text-xs text-slate-400">last year</span>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  {[
                    { year: '2024', color: 'bg-primary-500' },
                    { year: '2025', color: 'bg-primary-300' },
                    { year: '2026', color: 'bg-primary-600' },
                  ].map(y => (
                    <div key={y.year} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${y.color}`} />
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">{y.year}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-24 h-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ v: 38 }, { v: 32 }, { v: 30 }]} dataKey="v" innerRadius={28} outerRadius={42} startAngle={90} endAngle={-270} strokeWidth={0} paddingAngle={2}>
                      <Cell fill={C.primary} />
                      <Cell fill={C.violet} />
                      <Cell fill={C.primary} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Monthly Earnings */}
          <div className="card p-5 flex-1">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Monthly Earnings</h4>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-2">$6,820</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-red-400"><ArrowDownRight size={12} />-9%</span>
                  <span className="text-xs text-slate-400">last year</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                <DollarSign size={18} className="text-primary-600 dark:text-primary-400" />
              </div>
            </div>
            <div className="h-14">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ v: 25 }, { v: 40 }, { v: 30 }, { v: 55 }, { v: 45 }, { v: 35 }, { v: 50 }]} barSize={8} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Bar dataKey="v" radius={[4, 4, 4, 4]} fill={C.primary} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ── Store Overview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Main banner */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
          <div className="relative p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
                  <ShoppingBag size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Store Overview</h3>
                  <p className="text-xs text-slate-400">March 2026 · Live</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" /></span>
              </div>
            </div>

            {/* Stats grid — glassmorphism style */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Today's Sales", value: '$4,820', change: '+8.2%', up: true, icon: DollarSign, gradient: 'bg-emerald-500', lightBg: 'bg-emerald-50 dark:bg-emerald-900/10' },
                { label: 'Pending Orders', value: '48', change: '+3 new', up: false, icon: ShoppingCart, gradient: 'bg-amber-500', lightBg: 'bg-amber-50 dark:bg-amber-900/10' },
                { label: 'Low Stock', value: '12', change: '2 fixed', up: true, icon: Package, gradient: 'bg-sky-500', lightBg: 'bg-sky-50 dark:bg-sky-900/10' },
                { label: 'Refunds', value: '3', change: '−1 today', up: true, icon: RefreshCw, gradient: 'bg-rose-500', lightBg: 'bg-rose-50 dark:bg-rose-900/10' },
              ].map(item => (
                <div key={item.label} className={`${item.lightBg} rounded-2xl p-3.5 border border-slate-100/80 dark:border-slate-700/50 hover:shadow-md transition-shadow`}>
                  <div className={`w-8 h-8 rounded-xl ${item.gradient} flex items-center justify-center mb-2.5 shadow-sm`}>
                    <item.icon size={14} className="text-white" />
                  </div>
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{item.value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.label}</p>
                  <span className={`inline-block mt-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${item.up ? 'text-emerald-600 bg-emerald-100/80 dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-amber-600 bg-amber-100/80 dark:bg-amber-900/30 dark:text-amber-400'}`}>{item.change}</span>
                </div>
              ))}
            </div>

            {/* Insights — minimal pill row */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {[
                { text: '3 orders need attention', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
                { text: 'Flash sale — 6h left', icon: Zap, color: 'text-violet-600 dark:text-violet-400' },
                { text: '24 new reviews', icon: Star, color: 'text-emerald-600 dark:text-emerald-400' },
              ].map(ins => (
                <div key={ins.text} className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/40 px-3 py-1.5 rounded-full">
                  <ins.icon size={11} className={ins.color} />
                  {ins.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category Share card */}
        <div className="card p-0 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Category Share</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Revenue by category</p>
            </div>
            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><MoreVertical size={14} /></button>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" outerRadius={44} innerRadius={26} paddingAngle={2} dataKey="value">
                {categoryData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v}%`, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="px-4 pb-4 space-y-1.5 flex-1">
            {categoryData.map(c => (
              <div key={c.name} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="text-xs text-slate-600 dark:text-slate-400 flex-1">{c.name}</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{c.amount}</span>
                <span className={`text-[10px] font-semibold ${c.growth >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                  {c.growth >= 0 ? '+' : ''}{c.growth}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl ${k.bg} border ${k.border} p-4`}>
            <div className={`w-8 h-8 rounded-lg bg-white/60 dark:bg-slate-800/60 flex items-center justify-center mb-2.5`}>
              <k.icon size={15} className={k.color} />
            </div>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-tight">{k.value}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{k.label}</p>
            <div className={`flex items-center gap-0.5 mt-2 text-[10px] font-semibold ${k.change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {k.change >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {Math.abs(k.change)}% vs last month
            </div>
          </div>
        ))}
      </div>

      {/* Weekly Revenue + Order Pipeline */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Weekly Revenue & Orders</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">This week's daily breakdown</p>
            </div>
            <div className="flex items-center gap-3">
              {[{ c: 'bg-primary-500', n: 'Revenue' }, { c: 'bg-cyan-400', n: 'Orders' }].map(item => (
                <div key={item.n} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-sm ${item.c} block`} />
                  <span className="text-xs text-slate-500">{item.n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueArea} barCategoryGap="30%" margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.bg} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} tickFormatter={v => `$${v / 1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" name="Revenue" fill={C.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="orders" name="Orders" fill={C.cyan} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Summary row */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700 border-t border-slate-100 dark:border-slate-700">
            {[
              { label: 'Total This Week', value: '$84,200', icon: DollarSign, color: 'text-primary-500' },
              { label: 'Total Orders', value: '659', icon: ShoppingCart, color: 'text-cyan-500' },
              { label: 'Avg Daily Revenue', value: '$12,029', icon: TrendingUp, color: 'text-emerald-500' },
            ].map(s => (
              <div key={s.label} className="p-4 text-center">
                <s.icon size={14} className={`${s.color} mx-auto mb-1`} />
                <p className="text-base font-bold text-slate-800 dark:text-slate-200">{s.value}</p>
                <p className="text-[10px] text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Order Pipeline</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">402 orders this week</p>
            </div>
            <Badge variant="secondary">Live</Badge>
          </div>
          <div className="space-y-2.5 flex-1">
            {orderPipeline.map(stage => (
              <div key={stage.label} className={`${stage.bg} border ${stage.border} rounded-xl p-3.5`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <stage.icon size={13} className={stage.textColor} />
                    <span className={`text-xs font-semibold ${stage.textColor}`}>{stage.label}</span>
                  </div>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">{stage.count}</span>
                </div>
                <div className="h-1.5 bg-white/60 dark:bg-slate-700/50 rounded-full overflow-hidden">
                  <div className={`h-full ${stage.color} rounded-full`} style={{ width: `${stage.pct}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{stage.pct}% · est. {Math.round(stage.count * 0.8)} on-time</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sales Channels + Traffic Sources */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Sales Channels monthly */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Sales Channels</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Online vs offline revenue</p>
            </div>
            <div className="flex items-center gap-3">
              {[{ c: 'bg-primary-500', n: 'Online' }, { c: 'bg-cyan-400', n: 'Offline' }, { c: 'bg-rose-400', n: 'Refunds' }].map(item => (
                <div key={item.n} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm ${item.c} block`} />
                  <span className="text-[10px] text-slate-500">{item.n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlySales} barCategoryGap="30%" margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.bg} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} tickFormatter={v => `$${v / 1000}k`} />
                <Tooltip formatter={v => `$${v.toLocaleString()}`} />
                <Bar dataKey="online" name="Online" fill={C.primary} radius={[3, 3, 0, 0]} />
                <Bar dataKey="offline" name="Offline" fill={C.cyan} radius={[3, 3, 0, 0]} />
                <Bar dataKey="refunds" name="Refunds" fill={C.rose} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Traffic Sources */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Traffic Sources</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">102,000 visits this month</p>
            </div>
            <Globe size={16} className="text-slate-400" />
          </div>
          <div className="p-5 space-y-3">
            {trafficSources.map(src => (
              <div key={src.source}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: src.color }} />
                    <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{src.source}</span>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-xs text-slate-400">{src.visits.toLocaleString()} visits</span>
                    <span className="text-xs font-bold w-16 text-slate-700 dark:text-slate-300">{src.conv}% conv.</span>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${src.pct}%`, backgroundColor: src.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Products + Inventory Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Top Products Table */}
        <div className="xl:col-span-2 card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 gap-3">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Top Performing Products</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Best sellers this month</p>
            </div>
            <div className="flex gap-1">
              {['all', 'electronics', 'audio', 'wearables'].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-medium capitalize transition-all ${tab === t ? 'bg-primary-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-400'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Product</th><th>Category</th><th>Units Sold</th><th>Revenue</th><th>Stock</th><th>Trend</th><th>Growth</th></tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.name}>
                    <td className="text-slate-400 font-bold text-xs w-10">0{i + 1}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary-600 dark:text-primary-400">{p.img}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{p.name}</p>
                          <p className="text-[10px] text-slate-400">SKU-{1000 + i}</p>
                        </div>
                      </div>
                    </td>
                    <td><Badge variant="primary">{p.category}</Badge></td>
                    <td className="font-semibold text-slate-700 dark:text-slate-300">{p.sold.toLocaleString()}</td>
                    <td className="font-bold text-slate-800 dark:text-slate-200">{p.revenue}</td>
                    <td>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.stock <= 10 ? 'bg-red-50 text-red-500 dark:bg-red-900/20' : p.stock <= 30 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td><MiniTrend data={p.trend} up={p.growth >= 0} /></td>
                    <td>
                      <span className={`flex items-center gap-0.5 text-xs font-bold ${p.growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {p.growth >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        {Math.abs(p.growth)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Alerts + Recent Orders */}
        <div className="flex flex-col gap-4">

          {/* Inventory Alerts */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                  <AlertTriangle size={13} className="text-red-500" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Inventory Alerts</h3>
              </div>
              <Badge variant="danger">{inventoryAlerts.length} items</Badge>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {inventoryAlerts.map(item => (
                <div key={item.sku || item.name} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${item.status === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400">{item.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-bold ${item.status === 'critical' ? 'text-red-500' : 'text-amber-500'}`}>{item.stock} left</p>
                    <p className="text-[10px] text-slate-400">min {item.threshold}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-slate-100 dark:border-slate-700">
              <button className="w-full text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline flex items-center justify-center gap-1">
                Manage Inventory <ChevronRight size={11} />
              </button>
            </div>
          </div>

          {/* Quick Recent Orders */}
          <div className="card overflow-hidden flex-1">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                  <Clock size={13} className="text-primary-500" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Recent Orders</h3>
              </div>
              <button className="text-[10px] text-primary-600 dark:text-primary-400 font-medium flex items-center gap-0.5">
                All <ChevronRight size={10} />
              </button>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {recentOrders.map(order => (
                <div key={order.customer + order.item} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-primary-600 dark:text-primary-400">{order.customer.split(' ').map(n => n[0]).join('')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">{order.customer}</p>
                    <p className="text-[10px] text-slate-400 truncate">{order.item}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{order.amount}</p>
                    <Badge variant={statusConfig[order.status].variant} className="text-[9px] px-1.5 py-0">{statusConfig[order.status].label}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Reviews */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200">Recent Customer Reviews</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Latest feedback · 4.8 avg rating this month</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, j) => (
                <Star key={j} size={12} className={j < 5 ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
              ))}
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ms-1">4.8</span>
            </div>
            <button className="text-xs text-primary-600 dark:text-primary-400 font-medium flex items-center gap-0.5">All Reviews <ChevronRight size={12} /></button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-700">
          {recentReviews.map(review => (
            <div key={review.customer + review.product} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-primary-400 flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">{review.customer.split(' ').map(n => n[0]).join('')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{review.customer}</p>
                    {review.verified && (
                      <span className="flex items-center gap-0.5 text-[9px] text-emerald-500 font-semibold">
                        <CheckCircle size={9} />Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{review.product}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{review.time}</span>
              </div>
              <div className="flex items-center gap-0.5 mb-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} size={12} className={j < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'} />
                ))}
                <span className="text-xs text-slate-400 ms-1">{review.rating}.0</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{review.comment}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

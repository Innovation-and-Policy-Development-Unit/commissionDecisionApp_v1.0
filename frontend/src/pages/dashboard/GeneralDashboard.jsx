import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import useChartColors from '../../hooks/useChartColors'
import PageHeader from '../../components/shared/PageHeader'
import {
  Users, CheckSquare, FolderOpen, DollarSign, TrendingUp, Clock,
  ArrowUpRight, ArrowDownRight, Plus, Target, Flame, MessageCircle,
  ChevronRight, MoreHorizontal, CheckCircle2, Circle,
  AlertCircle, Calendar, Paperclip, Flag, Activity,
  Zap, Award, BarChart3, Globe, ShieldCheck, Star,
  Briefcase, FileText, ArrowRight, Eye, ThumbsUp,
  GitBranch, GitCommit, GitPullRequest, Timer,
  Sun, CloudSun, MapPin
} from 'lucide-react'

// --- Data ---
const weeklyData = [
  { name: 'Mon', tasks: 18, bugs: 4, reviews: 6 },
  { name: 'Tue', tasks: 24, bugs: 6, reviews: 8 },
  { name: 'Wed', tasks: 20, bugs: 3, reviews: 12 },
  { name: 'Thu', tasks: 32, bugs: 5, reviews: 9 },
  { name: 'Fri', tasks: 28, bugs: 2, reviews: 14 },
  { name: 'Sat', tasks: 14, bugs: 1, reviews: 5 },
  { name: 'Sun', tasks: 8, bugs: 0, reviews: 2 },
]

const monthlyRevenue = [
  { month: 'Jul', revenue: 32000, expenses: 22000 },
  { month: 'Aug', revenue: 38000, expenses: 24000 },
  { month: 'Sep', revenue: 35000, expenses: 21000 },
  { month: 'Oct', revenue: 42000, expenses: 26000 },
  { month: 'Nov', revenue: 48000, expenses: 28000 },
  { month: 'Dec', revenue: 52000, expenses: 30000 },
  { month: 'Jan', revenue: 46000, expenses: 27000 },
  { month: 'Feb', revenue: 55000, expenses: 29000 },
  { month: 'Mar', revenue: 61000, expenses: 31000 },
]

// projectDistribution moved inside component for dynamic chart colors

const projects = [
  { name: 'Website Redesign', progress: 75, color: 'bg-primary-500', hex: '#6366f1', team: ['AJ', 'BS', 'CW', 'DL'], due: 'Mar 15', status: 'On Track', statusColor: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20', budget: 24500, spent: 18375, tasks: { total: 48, done: 36 }, icon: Globe },
  { name: 'Mobile App v2.0', progress: 50, color: 'bg-cyan-500', hex: '#06b6d4', team: ['EW', 'FG', 'AJ'], due: 'Apr 01', status: 'At Risk', statusColor: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20', budget: 38000, spent: 19000, tasks: { total: 64, done: 32 }, icon: Briefcase },
  { name: 'API Integration', progress: 90, color: 'bg-emerald-500', hex: '#10b981', team: ['BS', 'DL'], due: 'Mar 10', status: 'Ahead', statusColor: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20', budget: 12000, spent: 10800, tasks: { total: 30, done: 27 }, icon: Zap },
]

const teamMembers = [
  { name: 'Alice Johnson', role: 'Frontend Lead', status: 'online', tasks: 12, completed: 47, color: 'bg-primary-400', efficiency: 94 },
  { name: 'Bob Smith', role: 'Backend Dev', status: 'online', tasks: 8, completed: 38, color: 'bg-cyan-400', efficiency: 91 },
  { name: 'Carol White', role: 'UX Designer', status: 'away', tasks: 6, completed: 52, color: 'bg-emerald-400', efficiency: 97 },
  { name: 'David Lee', role: 'DevOps Engineer', status: 'online', tasks: 5, completed: 31, color: 'bg-amber-400', efficiency: 88 },
  { name: 'Eva Brown', role: 'Product Manager', status: 'offline', tasks: 15, completed: 63, color: 'bg-rose-400', efficiency: 96 },
]

const tasks = [
  { title: 'Fix authentication bug in login page', priority: 'high', status: 'in-progress', assignee: 'Alice', due: 'Today', comments: 3, attachments: 2 },
  { title: 'Update API documentation for v2', priority: 'medium', status: 'todo', assignee: 'Bob', due: 'Mar 13', comments: 1, attachments: 0 },
  { title: 'Design new onboarding flow screens', priority: 'high', status: 'review', assignee: 'Carol', due: 'Mar 12', comments: 8, attachments: 4 },
  { title: 'Set up CI/CD pipeline for staging', priority: 'medium', status: 'done', assignee: 'David', due: 'Done', comments: 2, attachments: 1 },
  { title: 'Conduct user interview sessions', priority: 'low', status: 'todo', assignee: 'Eva', due: 'Mar 18', comments: 0, attachments: 0 },
  { title: 'Write test cases for checkout flow', priority: 'medium', status: 'in-progress', assignee: 'Frank', due: 'Mar 14', comments: 4, attachments: 0 },
]

const recentActivity = [
  { user: 'Alice Johnson', initials: 'AJ', color: 'bg-primary-400', action: 'pushed 3 commits to', target: 'feature/auth-fix', time: '2 min ago', icon: GitCommit, iconColor: 'text-primary-500 bg-primary-50 dark:bg-primary-900/20', category: 'Code' },
  { user: 'Bob Smith', initials: 'BS', color: 'bg-cyan-400', action: 'merged pull request', target: '#142 API endpoints', time: '18 min ago', icon: GitPullRequest, iconColor: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20', category: 'Review' },
  { user: 'Carol White', initials: 'CW', color: 'bg-emerald-400', action: 'uploaded designs for', target: 'Dashboard v3.0', time: '1h ago', icon: FileText, iconColor: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20', category: 'Design' },
  { user: 'David Lee', initials: 'DL', color: 'bg-amber-400', action: 'deployed to', target: 'Production v2.1.0', time: '2h ago', icon: Zap, iconColor: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', category: 'Deploy' },
  { user: 'Eva Brown', initials: 'EB', color: 'bg-rose-400', action: 'created milestone', target: 'Q2 Product Launch', time: '4h ago', icon: Flag, iconColor: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20', category: 'Plan' },
  { user: 'Frank Wilson', initials: 'FW', color: 'bg-violet-400', action: 'closed issue', target: '#98 Memory leak fix', time: '5h ago', icon: ShieldCheck, iconColor: 'text-violet-500 bg-violet-50 dark:bg-violet-900/20', category: 'Bug Fix' },
]

const quickStats = [
  { label: 'Sprint Progress', value: '68%', sublabel: 'Day 8 of 14' },
  { label: 'Open PRs', value: '12', sublabel: '3 need review' },
  { label: 'Avg Response', value: '2.4h', sublabel: '↓ 18% vs last week' },
  { label: 'Uptime', value: '99.98%', sublabel: 'Last 30 days' },
]

const priorityConfig = {
  high: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  medium: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  low: { color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-700/50' },
}

const statusIcon = {
  'done': <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />,
  'in-progress': <div className="w-3.5 h-3.5 rounded-full border-2 border-primary-500 border-t-transparent animate-spin shrink-0" />,
  'review': <AlertCircle size={15} className="text-amber-500 shrink-0" />,
  'todo': <Circle size={15} className="text-slate-300 dark:text-slate-600 shrink-0" />,
}

const statusDot = { online: 'bg-emerald-500', away: 'bg-amber-500', offline: 'bg-slate-400' }

export default function GeneralDashboard() {
  const [activeTab, setActiveTab] = useState('all')
  const C = useChartColors()

  const projectDistribution = [
    { name: 'Development', value: 40, color: C.primary },
    { name: 'Design', value: 25, color: C.cyan },
    { name: 'Marketing', value: 20, color: C.emerald },
    { name: 'Research', value: 15, color: C.amber },
  ]

  const kpis = [
    { label: 'Total Users', value: '24,521', change: '+12.5%', positive: true, icon: Users, color: 'bg-primary-500', sparkData: [30, 40, 35, 50, 49, 60, 70, 65, 80] },
    { label: 'Active Tasks', value: '1,243', change: '+5.2%', positive: true, icon: CheckSquare, color: 'bg-cyan-500', sparkData: [20, 30, 25, 35, 40, 38, 42, 50, 48] },
    { label: 'Projects', value: '87', change: '+3.1%', positive: true, icon: FolderOpen, color: 'bg-emerald-500', sparkData: [10, 15, 12, 18, 20, 22, 25, 28, 30] },
    { label: 'Revenue', value: '$61.2K', change: '+18.3%', positive: true, icon: DollarSign, color: 'bg-amber-500', sparkData: [40, 38, 42, 45, 50, 55, 52, 58, 65] },
    { label: 'On-time Rate', value: '94.2%', change: '+2.1%', positive: true, icon: Target, color: 'bg-rose-500', sparkData: [88, 90, 89, 91, 92, 94, 93, 94, 95] },
    { label: 'Team Velocity', value: '42 pts', change: '-1.4%', positive: false, icon: Flame, color: 'bg-primary-500', sparkData: [35, 38, 42, 45, 44, 43, 42, 40, 42] },
  ]

  const filteredTasks = activeTab === 'all' ? tasks : tasks.filter(t => t.status === activeTab)

  return (
    <div className="space-y-6">
      <PageHeader
        title="General Dashboard"
        subtitle="Project overview, team productivity and task management."
        action={
          <div className="flex gap-2">
            <button className="btn-outline btn-sm"><Calendar size={14} className="me-1.5 inline" />Schedule</button>
            <button className="btn-gradient"><Plus size={14} className="me-1.5 inline" />New Project</button>
          </div>
        }
      />

      {/* Top Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left - Illustration with Weather */}
        <div className="lg:col-span-3 card overflow-hidden relative bg-sky-100 dark:bg-sky-900/30 p-6 min-h-[220px]">
          {/* Decorative SVG Scene */}
          <svg className="absolute bottom-0 end-0 w-[55%] h-[90%] opacity-80 dark:opacity-50" viewBox="0 0 400 300" fill="none">
            {/* Sun */}
            <circle cx="320" cy="60" r="30" fill="#fbbf24" opacity="0.8" />
            <circle cx="320" cy="60" r="40" fill="#fbbf24" opacity="0.15" />
            {/* Clouds */}
            <ellipse cx="250" cy="80" rx="35" ry="15" fill="white" opacity="0.7" />
            <ellipse cx="270" cy="75" rx="25" ry="12" fill="white" opacity="0.6" />
            <ellipse cx="140" cy="55" rx="28" ry="11" fill="white" opacity="0.5" />
            {/* Mountains */}
            <polygon points="0,300 80,140 160,300" fill="#86efac" opacity="0.5" />
            <polygon points="100,300 200,100 300,300" fill="#34d399" opacity="0.6" />
            <polygon points="200,300 320,130 400,300" fill="#6ee7b7" opacity="0.5" />
            {/* Trees */}
            <rect x="120" y="220" width="6" height="30" rx="2" fill="#92400e" opacity="0.6" />
            <polygon points="123,160 100,225 146,225" fill="#22c55e" opacity="0.7" />
            <polygon points="123,180 105,220 141,220" fill="#16a34a" opacity="0.7" />
            <rect x="280" y="210" width="6" height="35" rx="2" fill="#92400e" opacity="0.6" />
            <polygon points="283,155 258,215 308,215" fill="#22c55e" opacity="0.7" />
            <polygon points="283,175 263,210 303,210" fill="#16a34a" opacity="0.7" />
            {/* Ground */}
            <ellipse cx="200" cy="300" rx="220" ry="30" fill="#86efac" opacity="0.4" />
            {/* Person hiking */}
            <circle cx="190" cy="195" r="8" fill="#6366f1" opacity="0.8" />
            <line x1="190" y1="203" x2="190" y2="230" stroke="#6366f1" strokeWidth="3" opacity="0.8" strokeLinecap="round" />
            <line x1="190" y1="230" x2="180" y2="250" stroke="#6366f1" strokeWidth="3" opacity="0.8" strokeLinecap="round" />
            <line x1="190" y1="230" x2="200" y2="250" stroke="#6366f1" strokeWidth="3" opacity="0.8" strokeLinecap="round" />
            <line x1="190" y1="212" x2="178" y2="222" stroke="#6366f1" strokeWidth="3" opacity="0.8" strokeLinecap="round" />
            <line x1="190" y1="212" x2="202" y2="205" stroke="#6366f1" strokeWidth="3" opacity="0.8" strokeLinecap="round" />
            {/* Birds */}
            <path d="M60 90 Q65 85 70 90" stroke="#475569" strokeWidth="1.5" fill="none" opacity="0.4" />
            <path d="M80 75 Q85 70 90 75" stroke="#475569" strokeWidth="1.5" fill="none" opacity="0.3" />
          </svg>

          {/* Weather info overlay */}
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <Sun size={20} className="text-amber-500" />
              <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">27°C</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 text-sm mb-4">
              <MapPin size={13} />
              <span>San Francisco, California</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <CloudSun size={13} /> Partly Cloudy
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm rounded-lg px-3 py-1.5">
                Humidity: 58%
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs leading-relaxed">
              Good morning! You have <span className="font-semibold text-primary-600 dark:text-primary-400">5 meetings</span> and <span className="font-semibold text-primary-600 dark:text-primary-400">12 tasks</span> scheduled today.
            </p>
          </div>
        </div>

        {/* Right - 4 Stat Cards (2x2) */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <div className="card p-4 bg-primary-500 text-white relative overflow-hidden">
            <div className="absolute top-0 end-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 start-0 w-14 h-14 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center mb-3">
                <CheckSquare size={16} />
              </div>
              <p className="text-2xl font-bold">4,006</p>
              <p className="text-xs text-white/70 mt-0.5">Today's Tasks</p>
              <div className="flex items-center gap-1 mt-2 text-xs">
                <ArrowUpRight size={12} />
                <span className="text-emerald-200 font-medium">10.00%</span>
                <span className="text-white/50">30 days</span>
              </div>
            </div>
          </div>

          <div className="card p-4 bg-violet-600 text-white relative overflow-hidden">
            <div className="absolute top-0 end-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 start-0 w-14 h-14 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center mb-3">
                <FolderOpen size={16} />
              </div>
              <p className="text-2xl font-bold">61,344</p>
              <p className="text-xs text-white/70 mt-0.5">Total Projects</p>
              <div className="flex items-center gap-1 mt-2 text-xs">
                <ArrowUpRight size={12} />
                <span className="text-emerald-200 font-medium">22.00%</span>
                <span className="text-white/50">30 days</span>
              </div>
            </div>
          </div>

          <div className="card p-4 bg-purple-500 text-white relative overflow-hidden">
            <div className="absolute top-0 end-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 start-0 w-14 h-14 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center mb-3">
                <Users size={16} />
              </div>
              <p className="text-2xl font-bold">34,040</p>
              <p className="text-xs text-white/70 mt-0.5">No. of Meetings</p>
              <div className="flex items-center gap-1 mt-2 text-xs">
                <ArrowUpRight size={12} />
                <span className="text-emerald-200 font-medium">2.00%</span>
                <span className="text-white/50">30 days</span>
              </div>
            </div>
          </div>

          <div className="card p-4 bg-pink-500 text-white relative overflow-hidden">
            <div className="absolute top-0 end-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 start-0 w-14 h-14 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center mb-3">
                <Briefcase size={16} />
              </div>
              <p className="text-2xl font-bold">47,033</p>
              <p className="text-xs text-white/70 mt-0.5">No. of Clients</p>
              <div className="flex items-center gap-1 mt-2 text-xs">
                <ArrowUpRight size={12} />
                <span className="text-emerald-200 font-medium">0.22%</span>
                <span className="text-white/50">30 days</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickStats.map(stat => (
          <div key={stat.label} className="card px-4 py-3 flex items-center gap-3">
            <div className="w-2 h-10 rounded-full bg-primary-500 shrink-0" />
            <div>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{stat.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{stat.sublabel}</p>
            </div>
          </div>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="card p-4 group hover:shadow-card-md transition-all duration-200">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${k.color} flex items-center justify-center shadow-sm`}>
                <k.icon size={18} className="text-white" />
              </div>
              <span className={`text-[11px] font-bold flex items-center gap-0.5 ${k.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {k.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {k.change}
              </span>
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{k.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{k.label}</p>
            {/* Mini sparkline */}
            <div className="flex items-end gap-px mt-3 h-6">
              {k.sparkData.map((v, j) => (
                <div
                  key={`${k.label}-${j}`}
                  className={`flex-1 rounded-sm transition-all ${k.positive ? 'bg-primary-200 dark:bg-primary-800/40 group-hover:bg-primary-400 dark:group-hover:bg-primary-600/60' : 'bg-red-200 dark:bg-red-800/40 group-hover:bg-red-400 dark:group-hover:bg-red-600/60'}`}
                  style={{ height: `${(v / Math.max(...k.sparkData)) * 100}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Chart + Project Distribution */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 gap-3">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Revenue & Expenses</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Monthly financial overview</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary-500 block" /><span className="text-xs text-slate-500">Revenue</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 block" /><span className="text-xs text-slate-500">Expenses</span></div>
            </div>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyRevenue} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} tickFormatter={v => `$${v / 1000}k`} />
                <Tooltip formatter={(v) => [`$${(v / 1000).toFixed(1)}k`]} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '12px' }} />
                <Bar dataKey="revenue" name="Revenue" fill={C.primary} radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Bar dataKey="expenses" name="Expenses" fill={C.emerald} radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Summary row */}
          <div className="grid grid-cols-3 border-t border-slate-100 dark:border-slate-700">
            {[
              { label: 'Total Revenue', value: '$409K', change: '+24%', positive: true },
              { label: 'Total Expenses', value: '$238K', change: '+8%', positive: false },
              { label: 'Net Profit', value: '$171K', change: '+42%', positive: true },
            ].map(item => (
              <div key={item.label} className="p-4 text-center border-e border-slate-100 dark:border-slate-700 last:border-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-0.5">{item.value}</p>
                <span className={`text-[11px] font-semibold ${item.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{item.change}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Project Distribution + Quick Actions */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-slate-200">Project Distribution</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Resource allocation by department</p>
          </div>
          <div className="p-5">
            <div className="flex justify-center">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={projectDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {projectDistribution.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5 mt-2">
              {projectDistribution.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-slate-600 dark:text-slate-400">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-8 text-end">{item.value}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Quick action buttons */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-2">
            {[
              { icon: GitBranch, label: 'New Branch' },
              { icon: FileText, label: 'Create Doc' },
            ].map(action => (
              <button key={action.label} className="flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100 transition-colors border border-slate-100 dark:border-slate-700">
                <action.icon size={14} />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Projects + Activity Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Active Projects — 3 cols */}
        <div className="xl:col-span-3 card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Active Projects</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{projects.length} projects · {projects.reduce((a, p) => a + p.tasks.done, 0)} tasks completed</p>
            </div>
            <button className="btn-outline btn-sm">View All <ChevronRight size={12} className="inline ms-1" /></button>
          </div>
          {/* Project summary strip */}
          <div className="grid grid-cols-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            {[
              { label: 'Total Budget', value: `$${(projects.reduce((a, p) => a + p.budget, 0) / 1000).toFixed(1)}K` },
              { label: 'Total Spent', value: `$${(projects.reduce((a, p) => a + p.spent, 0) / 1000).toFixed(1)}K` },
              { label: 'On Track', value: projects.filter(p => p.status === 'On Track' || p.status === 'Ahead').length },
              { label: 'At Risk', value: projects.filter(p => p.status === 'At Risk' || p.status === 'Delayed').length },
            ].map(s => (
              <div key={s.label} className="px-4 py-3 border-e border-slate-100 dark:border-slate-700 last:border-0">
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">{s.label}</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="p-4 space-y-3">
            {projects.map(project => {
              const ProjIcon = project.icon
              const budgetPct = Math.round((project.spent / project.budget) * 100)
              return (
                <div key={project.name} className="group rounded-xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-card-sm transition-all duration-200 overflow-hidden">
                  {/* Top color accent */}
                  <div className={`h-1 ${project.color}`} />
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${project.color} flex items-center justify-center shrink-0 shadow-sm`}>
                          <ProjIcon size={18} className="text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{project.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-400 flex items-center gap-1"><Calendar size={10} />{project.due}</span>
                            <span className="text-slate-200 dark:text-slate-700">·</span>
                            <span className="text-[11px] text-slate-400">{project.tasks.done}/{project.tasks.total} tasks</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${project.statusColor}`}>{project.status}</span>
                        <button className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"><MoreHorizontal size={14} /></button>
                      </div>
                    </div>
                    {/* Progress + Budget row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Progress</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{project.progress}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full ${project.color} rounded-full transition-all duration-700`} style={{ width: `${project.progress}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Budget</span>
                          <span className={`text-xs font-bold ${budgetPct > 85 ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>{budgetPct}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${budgetPct > 85 ? 'bg-red-400' : 'bg-slate-300 dark:bg-slate-500'}`} style={{ width: `${budgetPct}%` }} />
                        </div>
                      </div>
                    </div>
                    {/* Footer */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50 dark:border-slate-700/50">
                      <div className="flex items-center">
                        {project.team.map((initials, j) => (
                          <div key={`${project.name}-${initials}-${j}`} className="w-7 h-7 rounded-full bg-slate-400 flex items-center justify-center border-2 border-white dark:border-slate-800 text-white text-[8px] font-bold -ms-1.5 first:ms-0">
                            {initials}
                          </div>
                        ))}
                        {project.team.length > 3 && <span className="text-[10px] text-slate-400 ms-2">+{project.team.length - 3}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span>${(project.spent / 1000).toFixed(1)}K / ${(project.budget / 1000).toFixed(1)}K</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Activity Feed — 2 cols */}
        <div className="xl:col-span-2 card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Activity Feed</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{recentActivity.length} updates today</p>
            </div>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live
            </span>
          </div>
          {/* Activity type filters */}
          <div className="flex items-center gap-1.5 px-5 py-3 border-b border-slate-100 dark:border-slate-700 overflow-x-auto scrollbar-hide">
            {['All', 'Code', 'Review', 'Design', 'Deploy'].map((filter, i) => (
              <button key={filter} className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${i === 0 ? 'bg-primary-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                {filter}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-4 space-y-0.5">
              {recentActivity.map(item => {
                const ActIcon = item.icon
                return (
                  <div key={item.user + item.action + item.target} className="group p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer">
                    <div className="flex gap-3">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center`}>
                          <span className="text-white text-[10px] font-bold">{item.initials}</span>
                        </div>
                        <div className={`absolute -bottom-1 -end-1 w-5 h-5 rounded-md ${item.iconColor} flex items-center justify-center border-2 border-white dark:border-slate-800`}>
                          <ActIcon size={9} />
                        </div>
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                          <strong className="font-semibold">{item.user.split(' ')[0]}</strong>{' '}
                          <span className="text-slate-500 dark:text-slate-400">{item.action}</span>{' '}
                          <span className="text-primary-600 dark:text-primary-400 font-medium">{item.target}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1"><Clock size={9} />{item.time}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{item.category}</span>
                        </div>
                      </div>
                      {/* Hover action */}
                      <button className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all self-center shrink-0">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {/* Activity summary footer */}
          <div className="border-t border-slate-100 dark:border-slate-700">
            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700">
              {[
                { icon: GitCommit, label: 'Commits', value: '24', color: 'text-primary-500' },
                { icon: GitPullRequest, label: 'PRs Merged', value: '8', color: 'text-emerald-500' },
                { icon: ShieldCheck, label: 'Issues Closed', value: '15', color: 'text-amber-500' },
              ].map(stat => (
                <div key={stat.label} className="px-4 py-3 text-center">
                  <stat.icon size={14} className={`mx-auto mb-1 ${stat.color}`} />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{stat.value}</p>
                  <p className="text-[10px] text-slate-400">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="px-4 pb-3">
              <button className="w-full text-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium py-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                View full activity log <ArrowRight size={13} className="inline ms-1" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Productivity Chart + Team Members */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 gap-3">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Weekly Productivity</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tasks completed, bugs fixed, and code reviews</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-primary-500 rounded block" /><span className="text-xs text-slate-500">Tasks</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-400 rounded block" /><span className="text-xs text-slate-500">Bugs</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 rounded block" /><span className="text-xs text-slate-500">Reviews</span></div>
            </div>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gTasks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gBugs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.rose} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={C.rose} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gReviews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.emerald} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={C.emerald} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '12px' }} />
                <Area type="monotone" dataKey="tasks" name="Tasks" stroke={C.primary} strokeWidth={2} fill="url(#gTasks)" dot={{ r: 3, fill: C.primary, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Area type="monotone" dataKey="bugs" name="Bugs" stroke={C.rose} strokeWidth={2} fill="url(#gBugs)" dot={{ r: 3, fill: C.rose, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Area type="monotone" dataKey="reviews" name="Reviews" stroke={C.emerald} strokeWidth={2} fill="url(#gReviews)" dot={{ r: 3, fill: C.emerald, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Weekly summary */}
          <div className="grid grid-cols-4 border-t border-slate-100 dark:border-slate-700">
            {[
              { label: 'Tasks Done', value: '144', icon: CheckSquare, color: 'text-primary-500' },
              { label: 'Bugs Fixed', value: '21', icon: ShieldCheck, color: 'text-red-400' },
              { label: 'Reviews', value: '56', icon: Eye, color: 'text-emerald-500' },
              { label: 'Avg/Day', value: '20.6', icon: TrendingUp, color: 'text-amber-500' },
            ].map(item => (
              <div key={item.label} className="p-4 text-center border-e border-slate-100 dark:border-slate-700 last:border-0">
                <item.icon size={14} className={`mx-auto mb-1.5 ${item.color}`} />
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{item.value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Team Members */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Team Members</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{teamMembers.filter(m => m.status === 'online').length} of {teamMembers.length} online</p>
            </div>
            <button className="btn-primary btn-sm"><Plus size={13} className="me-1 inline" />Invite</button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {teamMembers.map(member => (
              <div key={member.name} className="flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer">
                <div className="relative shrink-0">
                  <div className={`w-10 h-10 rounded-xl ${member.color} flex items-center justify-center`}>
                    <span className="text-white font-bold text-xs">{member.name.split(' ').map(n => n[0]).join('')}</span>
                  </div>
                  <div className={`absolute -bottom-0.5 -end-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${statusDot[member.status]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{member.name}</p>
                  <p className="text-xs text-slate-400 truncate">{member.role}</p>
                </div>
                <div className="text-end shrink-0">
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{member.efficiency}%</span>
                    <Award size={11} className="text-amber-500" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{member.completed} completed</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task Board + Upcoming Deadlines */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Task Board */}
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 gap-3">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Task Board</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Current sprint · {tasks.filter(t => t.status === 'done').length}/{tasks.length} completed</p>
            </div>
            <div className="flex items-center gap-2">
              {[
                { id: 'all', label: 'All' },
                { id: 'in-progress', label: 'Active' },
                { id: 'review', label: 'Review' },
                { id: 'todo', label: 'To Do' },
                { id: 'done', label: 'Done' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${activeTab === tab.id ? 'bg-primary-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <CheckCircle2 size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tasks in this category</p>
              </div>
            ) : (
              filteredTasks.map(task => {
                const p = priorityConfig[task.priority]
                return (
                  <div key={task.id || task.title} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-primary-200 dark:hover:border-primary-800/40 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-all group cursor-pointer">
                    {statusIcon[task.status]}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>{task.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <div className="w-4 h-4 rounded-full bg-slate-300 flex items-center justify-center">
                            <span className="text-white text-[7px] font-bold">{task.assignee[0]}</span>
                          </div>
                          {task.assignee}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-0.5"><Clock size={9} />{task.due}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {task.comments > 0 && (
                        <span className="text-xs text-slate-400 flex items-center gap-1"><MessageCircle size={11} />{task.comments}</span>
                      )}
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${p.color} ${p.bg}`}>{task.priority}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="px-4 pb-4">
            <button className="w-full border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl py-2.5 text-sm text-slate-400 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-500 transition-all flex items-center justify-center gap-2">
              <Plus size={16} />Add new task
            </button>
          </div>
        </div>

        {/* Upcoming Deadlines & Milestones */}
        <div className="card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Upcoming Deadlines</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Milestones and key dates this month</p>
            </div>
            <button className="btn-outline btn-sm"><Calendar size={13} className="me-1 inline" />View Calendar</button>
          </div>
          {/* Deadline countdown cards */}
          <div className="p-4 space-y-3 flex-1">
            {[
              { title: 'API v2 Launch', date: 'Mar 14', daysLeft: 2, type: 'Release', color: 'bg-emerald-500', icon: Zap, progress: 90, owner: 'Bob Smith' },
              { title: 'Website Redesign Review', date: 'Mar 15', daysLeft: 3, type: 'Milestone', color: 'bg-primary-500', icon: Eye, progress: 75, owner: 'Alice Johnson' },
              { title: 'Q1 Sprint Retrospective', date: 'Mar 18', daysLeft: 6, type: 'Meeting', color: 'bg-amber-500', icon: MessageCircle, progress: null, owner: 'Eva Brown' },
              { title: 'Security Audit Completion', date: 'Mar 22', daysLeft: 10, type: 'Compliance', color: 'bg-red-500', icon: ShieldCheck, progress: 58, owner: 'David Lee' },
            ].map(deadline => {
              const DIcon = deadline.icon
              const urgency = deadline.daysLeft <= 3 ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : deadline.daysLeft <= 7 ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-500 bg-slate-50 dark:bg-slate-700/50'
              return (
                <div key={deadline.title} className="group flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-card-sm transition-all cursor-pointer">
                  <div className={`w-10 h-10 rounded-xl ${deadline.color} flex items-center justify-center shrink-0 shadow-sm`}>
                    <DIcon size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{deadline.title}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${urgency}`}>
                        {deadline.daysLeft <= 1 ? 'Tomorrow' : `${deadline.daysLeft}d left`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1"><Calendar size={10} />{deadline.date}</span>
                      <span className="text-slate-200 dark:text-slate-700">·</span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{deadline.type}</span>
                      <span className="text-slate-200 dark:text-slate-700">·</span>
                      <span className="text-[11px] text-slate-400">{deadline.owner.split(' ')[0]}</span>
                    </div>
                    {deadline.progress !== null && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full ${deadline.color} rounded-full transition-all duration-700`} style={{ width: `${deadline.progress}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{deadline.progress}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Summary footer */}
          <div className="grid grid-cols-3 border-t border-slate-100 dark:border-slate-700 divide-x divide-slate-100 dark:divide-slate-700">
            {[
              { label: 'This Week', value: '3', color: 'text-red-500' },
              { label: 'This Month', value: '5', color: 'text-amber-500' },
              { label: 'Completed', value: '12', color: 'text-emerald-500' },
            ].map(s => (
              <div key={s.label} className="px-4 py-3 text-center">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

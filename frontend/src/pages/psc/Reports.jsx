import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/shared/PageHeader'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { stageLabel } from '../../constants/stages'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts'
import {
  Download, Filter, Calendar, TrendingUp, AlertCircle, Clock,
  CheckCircle2, FileText, ChevronRight, BarChart3, PieChart as PieIcon
} from 'lucide-react'
import clsx from 'clsx'

// ─── Constants & Helpers ─────────────────────────────────────────────────────

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#f97316']

const LOCALE_MAP = { en: 'en-GB', fr: 'fr-FR', bi: 'en-GB' }

const KpiCard = ({ title, value, subtitle, icon: Icon, colorClass }) => (
  <div className="card p-6 flex items-start gap-4 hover:shadow-md transition-shadow">
    <div className={clsx("p-3 rounded-2xl shrink-0", colorClass)} aria-hidden="true">
      <Icon size={24} />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{value}</h3>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
        {subtitle}
      </p>
    </div>
  </div>
)

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Reports() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const locale = LOCALE_MAP[i18n.resolvedLanguage] || LOCALE_MAP[i18n.language] || 'en-GB'

  const formatMonth = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(locale, { month: 'short', year: '2-digit' })
  }
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchStats = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/reports/stats/', {
        params: { start_date: startDate, end_date: endDate }
      })
      setData(data)
    } catch (err) {
      console.error('Failed to fetch stats', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [startDate, endDate])

  const canExport = user && ['psc_officer', 'psc_secretary', 'psc_commissioner', 'psc_admin'].includes(user.role)

  const downloadCsv = async () => {
    try {
      const res = await api.get('/submissions/export_csv/', { responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `PSC_Submissions_Export_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed', err)
    }
  }

  // Formatting trend data for Recharts
  const trendData = useMemo(() => {
    if (!data?.trends) return []
    return data.trends.map(row => ({
      name: formatMonth(row.month),
      count: row.count
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, locale])

  // Formatting stage data for Pie chart (using translated stage labels)
  const stageData = useMemo(() => {
    if (!data?.distributions?.by_stage) return []
    return data.distributions.by_stage.map(s => ({
      name: stageLabel(s.current_stage, t),
      value: s.count
    }))
  }, [data, t])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title={t('reports.title')}
          subtitle={t('reports.subtitle')}
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-2 px-3 py-1 text-sm border-r border-slate-100 dark:border-slate-700">
              <Calendar size={14} className="text-slate-400" aria-hidden="true" />
              <label htmlFor="report-start" className="sr-only">{t('reports.start_date')}</label>
              <input
                id="report-start"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                aria-label={t('reports.start_date')}
                className="bg-transparent border-none p-0 focus:ring-0 text-slate-600 dark:text-slate-300 w-32"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-1 text-sm">
              <label htmlFor="report-end" className="sr-only">{t('reports.end_date')}</label>
              <input
                id="report-end"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                aria-label={t('reports.end_date')}
                className="bg-transparent border-none p-0 focus:ring-0 text-slate-600 dark:text-slate-300 w-32"
              />
            </div>
          </div>

          {canExport && (
            <button
              type="button"
              onClick={downloadCsv}
              className="btn btn-primary h-10 px-5 gap-2 shadow-lg shadow-primary-500/20"
            >
              <Download size={16} aria-hidden="true" />
              {t('reports.export_csv')}
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t('reports.total_register')}
          value={data?.summary?.total_submissions ?? 0}
          subtitle={t('reports.total_register_sub')}
          icon={FileText}
          colorClass="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <KpiCard
          title={t('reports.active_workflow')}
          value={data?.summary?.active_submissions ?? 0}
          subtitle={t('reports.active_workflow_sub')}
          icon={TrendingUp}
          colorClass="bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
        />
        <KpiCard
          title={t('reports.overdue_assessments')}
          value={data?.summary?.overdue_assessments ?? 0}
          subtitle={t('reports.overdue_assessments_sub')}
          icon={AlertCircle}
          colorClass="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
        />
        <KpiCard
          title={t('reports.avg_turnaround')}
          value={t('reports.avg_turnaround_value', { count: data?.summary?.avg_turnaround_days ?? 0 })}
          subtitle={t('reports.avg_turnaround_sub')}
          icon={Clock}
          colorClass="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* ── Main Charts Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Submission Trend */}
        <div className="xl:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400" aria-hidden="true">
                <BarChart3 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">{t('reports.submission_volume')}</h3>
                <p className="text-xs text-slate-500">{t('reports.submission_volume_sub')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <TrendingUp size={12} aria-hidden="true" />
              {t('reports.vs_last_year', { percent: 12 })}
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#6366f1" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400" aria-hidden="true">
              <PieIcon size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">{t('reports.workflow_status')}</h3>
              <p className="text-xs text-slate-500">{t('reports.workflow_status_sub')}</p>
            </div>
          </div>

          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stageData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 space-y-2">
            {stageData.slice(0, 4).map((s, i) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[140px]">{s.name}</span>
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Distribution Charts Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Ministry Breakdown */}
        <div className="card p-6">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6">{t('reports.by_ministry')}</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={data?.distributions?.by_ministry?.map(m => ({ name: m.ministry__name, count: m.count }))}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11 }} 
                  width={150}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data?.distributions?.by_ministry?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="card p-6">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6">{t('reports.by_category')}</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.distributions?.by_category?.map(c => ({ name: c.form_category__name, count: c.count }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11 }} 
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data?.distributions?.by_category?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Data Notice ──────────────────────────────────────────────────── */}
      <div className="card p-4 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={16} className="text-emerald-500" aria-hidden="true" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('reports.live_notice')}
          </p>
        </div>
        <div className="text-xs text-slate-400">
          {t('reports.last_updated', { time: new Date().toLocaleTimeString(locale) })}
        </div>
      </div>
    </div>
  )
}

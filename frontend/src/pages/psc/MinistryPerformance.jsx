import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle, Building2, TrendingUp, TrendingDown } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'

function Bar({ value, max, color = 'bg-primary-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 w-6 text-right">{value}</span>
    </div>
  )
}

export default function MinistryPerformance() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sort, setSort] = useState('total')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/ops/ministry-performance/')
      setData(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load ministry performance data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const ministries = [...(data?.ministries ?? [])].sort((a, b) => b[sort] - a[sort])
  const maxTotal = Math.max(1, ...ministries.map(m => m.total))
  const maxActive = Math.max(1, ...ministries.map(m => m.active))

  const SORT_OPTIONS = [
    { key: 'total',        label: 'Total' },
    { key: 'active',       label: 'Active' },
    { key: 'overdue',      label: 'Overdue' },
    { key: 'approval_rate',label: 'Approval Rate' },
    { key: 'recent_30d',   label: 'Last 30 Days' },
  ]

  return (
    <div>
      <PageHeader
        title="Ministry Performance"
        subtitle="Submission volumes, active cases, and compliance overview by ministry"
        action={
          <button
            type="button"
            className="btn-outline flex items-center gap-2 py-2 px-3 text-sm"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Summary row */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Ministries with submissions', value: data.total_ministries, color: 'text-primary-600' },
            { label: 'Total active cases', value: ministries.reduce((s, m) => s + m.active, 0), color: 'text-amber-600' },
            { label: 'Total overdue', value: ministries.reduce((s, m) => s + m.overdue, 0), color: 'text-red-600' },
            { label: 'Submitted (last 30d)', value: ministries.reduce((s, m) => s + m.recent_30d, 0), color: 'text-emerald-600' },
          ].map(card => (
            <div key={card.label} className="card p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{card.label}</p>
              <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sort tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs text-slate-500 self-center mr-1">Sort by:</span>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSort(opt.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              sort === opt.key
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Loading…</div>
        ) : ministries.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">No ministry data available.</p>
          </div>
        ) : (
          <table className="table w-full">
            <thead>
              <tr>
                <th>#</th>
                <th>Ministry</th>
                <th>Total</th>
                <th>Active</th>
                <th className="text-red-600 dark:text-red-400">Overdue</th>
                <th>Last 30 Days</th>
                <th>Approval Rate</th>
              </tr>
            </thead>
            <tbody>
              {ministries.map((m, idx) => (
                <tr key={m.ministry_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                  <td className="text-xs text-slate-400 font-mono w-8">{idx + 1}</td>
                  <td>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{m.ministry}</p>
                  </td>
                  <td>
                    <Bar value={m.total} max={maxTotal} color="bg-primary-500" />
                  </td>
                  <td>
                    <Bar value={m.active} max={maxActive} color="bg-amber-400" />
                  </td>
                  <td>
                    {m.overdue > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                        <AlertCircle size={12} /> {m.overdue}
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">0</span>
                    )}
                  </td>
                  <td className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {m.recent_30d}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-bold ${m.approval_rate >= 70 ? 'text-emerald-600 dark:text-emerald-400' : m.approval_rate >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        {m.approval_rate}%
                      </span>
                      {m.approval_rate >= 70 ? <TrendingUp size={12} className="text-emerald-500" /> : <TrendingDown size={12} className="text-red-400" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Users, BrainCircuit, RefreshCw, Inbox, UserX, ListTodo, AlertCircle, Timer,
} from 'lucide-react'
import api from '../../api/client'
import useChartColors from '../../hooks/useChartColors'
import PageHeader from '../../components/shared/PageHeader'
import ChartCard from '../../components/shared/ChartCard'
import StatCard from '../../components/shared/StatCard'
import Modal from '../../components/shared/Modal'
import BaseInput from '../../components/shared/BaseInput'
import BaseButton from '../../components/shared/BaseButton'
import BaseBadge from '../../components/shared/BaseBadge'
import BaseSpinner from '../../components/shared/BaseSpinner'
import { useToast } from '../../context/ToastContext'

const loadBadge = (weighted) => {
  if (weighted >= 20) return { color: 'danger', label: 'Overloaded' }
  if (weighted >= 10) return { color: 'warning', label: 'Heavy' }
  return { color: 'success', label: 'Available' }
}

function AgeBuckets({ buckets }) {
  const total = buckets.fresh + buckets.aging + buckets.stale
  if (!total) return <span className="text-xs text-slate-400">—</span>
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold">
      {buckets.fresh > 0 && <span className="text-emerald-600 dark:text-emerald-400" title="Fresh (< 1 week)">{buckets.fresh}</span>}
      {buckets.aging > 0 && <span className="text-amber-600 dark:text-amber-400" title="Aging (1–3 weeks)">{buckets.aging}</span>}
      {buckets.stale > 0 && <span className="text-red-600 dark:text-red-400" title="Stale (> 3 weeks)">{buckets.stale}</span>}
    </div>
  )
}

export default function WorkloadDashboard() {
  const toast = useToast()
  const C = useChartColors()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showIdle, setShowIdle] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [suggestionLoading, setSuggestionLoading] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const [submissionId, setSubmissionId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/workload/summary/')
      setData(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load workload data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSuggest = async () => {
    if (!submissionId) { toast.error('Enter a submission ID.'); return }
    setSuggestionLoading(true)
    setSuggestion(null)
    try {
      const res = await api.post('/workload/suggest-assignment/', { submission_id: parseInt(submissionId) })
      setSuggestion(res.data)
    } catch (e) {
      toast.error('AI suggestion failed: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setSuggestionLoading(false)
    }
  }

  const totals = data?.totals
  const units = data?.units ?? []
  const allOfficers = data?.officers ?? []
  const officers = showIdle
    ? allOfficers
    : allOfficers.filter(o => o.weighted_load > 0 || o.open_tasks > 0)

  const unitChart = units.map(u => ({
    name: u.unit.toUpperCase(),
    load: u.weighted_load,
    unassigned: u.unassigned,
  }))

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto pb-10">
      <PageHeader
        title="Workload Dashboard"
        subtitle="Age-weighted submissions and tasks per officer and unit — older work weighs more"
        action={
          <div className="flex gap-2">
            <BaseButton
              variant="ghost"
              icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
              onClick={load}
              disabled={loading}
            >
              Refresh
            </BaseButton>
            <BaseButton icon={<BrainCircuit size={15} />} variant="primary" onClick={() => setAssignDialogOpen(true)}>
              AI Smart Assignment
            </BaseButton>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* KPI cards */}
      {totals && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard title="Active submissions" value={totals.active_submissions} icon={Inbox} color="blue" />
          <StatCard title="Unassigned" value={totals.unassigned} icon={UserX} color="amber" />
          <StatCard title="Open tasks" value={totals.open_tasks} icon={ListTodo} color="purple" />
          <StatCard title="Overdue tasks" value={totals.overdue_tasks} icon={AlertCircle} color="red" />
          <StatCard
            title="Avg days in assessment"
            value={totals.avg_assessment_days ?? '—'}
            icon={Timer}
            color="emerald"
          />
        </div>
      )}

      {data && (
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
          Weighted load: {data.weighting} Durations are averages over the last {data.duration_window_days} days.
        </p>
      )}

      {/* Unit rollup */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Weighted load by unit" subtitle="Active submissions, age-weighted">
          {unitChart.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">No active unit-routed submissions.</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, unitChart.length * 44)}>
              <BarChart data={unitChart} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} strokeOpacity={0.5} />
                <XAxis type="number" tick={{ fontSize: 11, fill: C.axis }} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11, fill: C.axis }} />
                <Tooltip />
                <Bar dataKey="load" name="Weighted load" radius={[0, 4, 4, 0]}>
                  {unitChart.map((u, i) => (
                    <Cell key={i} fill={u.unassigned > 0 ? C.amber : C.primary} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Units</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Heaviest first · amber bar = has unassigned papers</p>
          </div>
          <table className="table w-full">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Active</th>
                <th>Weighted</th>
                <th className="text-amber-600 dark:text-amber-400">Unassigned</th>
                <th>Age mix</th>
                <th>Avg assess. days</th>
              </tr>
            </thead>
            <tbody>
              {units.map(u => (
                <tr key={u.unit}>
                  <td className="text-sm font-semibold uppercase">{u.unit}</td>
                  <td className="text-sm">{u.active_count}</td>
                  <td className="text-sm font-bold">{u.weighted_load}</td>
                  <td className="text-sm">{u.unassigned > 0
                    ? <span className="font-semibold text-amber-600 dark:text-amber-400">{u.unassigned}</span>
                    : <span className="text-emerald-600 dark:text-emerald-400">0</span>}
                  </td>
                  <td><AgeBuckets buckets={u.buckets} /></td>
                  <td className="text-sm">{u.avg_assessment_days ?? '—'}</td>
                </tr>
              ))}
              {units.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-sm text-slate-500">No unit-routed active submissions.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Officer table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-primary-500" />
            <span className="font-bold text-slate-800 dark:text-slate-100">Staff Workload</span>
            <span className="text-xs text-slate-400">heaviest first</span>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
            <input type="checkbox" checked={showIdle} onChange={e => setShowIdle(e.target.checked)} />
            Show staff with no load
          </label>
        </div>
        {loading ? (
          <div className="text-center p-10"><BaseSpinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Officer</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2" title="Primary active submissions (+ co-assignments)">Active</th>
                  <th className="px-3 py-2" title="Age mix: fresh < 1wk · aging 1–3wk · stale > 3wk">Age mix</th>
                  <th className="px-3 py-2" title="1 + min(age,21)/7 per submission; co-assignments at half weight">Weighted</th>
                  <th className="px-3 py-2">Tasks</th>
                  <th className="px-3 py-2" title="Average days a paper spends in assessment with this officer">Avg assess. days</th>
                  <th className="px-3 py-2">Load</th>
                </tr>
              </thead>
              <tbody>
                {officers.map(o => {
                  const badge = loadBadge(o.weighted_load)
                  return (
                    <tr key={o.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 text-slate-700 dark:text-slate-300">
                      <td className="px-3 py-2">
                        <span className="font-semibold block text-slate-800 dark:text-slate-100">{o.full_name}</span>
                        <span className="block text-[10px] text-slate-500">@{o.username}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">{(o.role || '').replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2">
                        <span className="font-bold text-base text-slate-800 dark:text-slate-100">{o.active_count}</span>
                        {o.co_assigned_count > 0 && (
                          <span className="text-xs text-slate-400 ml-1">+{o.co_assigned_count} co</span>
                        )}
                      </td>
                      <td className="px-3 py-2"><AgeBuckets buckets={o.buckets} /></td>
                      <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">{o.weighted_load}</td>
                      <td className="px-3 py-2">
                        {o.open_tasks}
                        {o.overdue_tasks > 0 && (
                          <span className="ml-1 text-xs font-semibold text-red-600 dark:text-red-400">
                            ({o.overdue_tasks} overdue)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {o.avg_assessment_days != null
                          ? <>{o.avg_assessment_days} <span className="text-[10px] text-slate-400">({o.assessments_completed})</span></>
                          : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <BaseBadge color={badge.color} size="small">{badge.label}</BaseBadge>
                      </td>
                    </tr>
                  )
                })}
                {officers.length === 0 && (
                  <tr><td colSpan={8} className="p-6 text-slate-500">No staff with active load. Tick "Show staff with no load" to list everyone.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        title="AI Smart Assignment"
        footer={<BaseButton variant="secondary" onClick={() => setAssignDialogOpen(false)}>Close</BaseButton>}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Enter a submission ID to get an AI-powered assignment recommendation based on form type, ministry, and officer workload.
          </p>
          <BaseInput label="Submission ID" required type="number" value={submissionId}
            onChange={e => setSubmissionId(e.target.value)} placeholder="Enter submission ID" />
          <BaseButton
            icon={suggestionLoading ? <BaseSpinner size="sm" label="" /> : <BrainCircuit size={15} />}
            variant="primary" onClick={handleSuggest} disabled={suggestionLoading}>
            {suggestionLoading ? 'Analysing…' : 'Get Suggestion'}
          </BaseButton>
          {suggestion && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
              <span className="font-bold text-slate-800 dark:text-slate-100">Recommended Officer</span>
              <p className="mt-2 font-semibold text-slate-800 dark:text-slate-100">{suggestion.recommended_officer || suggestion.officer_username || '—'}</p>
              {suggestion.reasoning && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{suggestion.reasoning}</p>}
              {suggestion.confidence_score != null && <BaseBadge color="success" size="small" className="mt-2">{suggestion.confidence_score}% confidence</BaseBadge>}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

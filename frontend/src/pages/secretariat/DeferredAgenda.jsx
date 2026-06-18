import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Clock, CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { stageLabel } from '../../constants/stages'

const TYPE_STYLE = {
  to_next_meeting: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  push_to_next:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  back_to_unit:    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  back_to_hr:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  on_hold:         'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
}

const SECRETARIAT_ROLES = new Set(['psc_secretary', 'senior_admin_officer', 'psc_admin'])

export default function DeferredAgenda() {
  const { user } = useAuth()
  const toast = useToast()
  const canResolve = SECRETARIAT_ROLES.has(user?.role)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [resolvedFilter, setResolvedFilter] = useState('false') // open by default
  const [typeFilter, setTypeFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (resolvedFilter) params.resolved = resolvedFilter
      if (typeFilter) params.deferral_type = typeFilter
      const res = await api.get('/agenda-deferrals/', { params })
      setRows(Array.isArray(res.data) ? res.data : (res.data?.results || []))
    } catch { setRows([]) } finally { setLoading(false) }
  }, [resolvedFilter, typeFilter])

  useEffect(() => { load() }, [load])

  const resolve = async (id) => {
    try {
      await api.post(`/agenda-deferrals/${id}/resolve/`)
      toast.success('Deferral marked resolved.')
      await load()
    } catch (ex) { toast.error(ex.response?.data?.detail || 'Could not resolve.') }
  }

  const openCount = useMemo(() => rows.filter(r => !r.resolved).length, [rows])

  return (
    <div>
      <PageHeader
        title="Deferred Agenda"
        subtitle="Every item deferred from a sitting — so nothing falls off the agenda."
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select className="input sm:w-44 text-sm" value={resolvedFilter} onChange={e => setResolvedFilter(e.target.value)}>
          <option value="false">Open deferrals</option>
          <option value="true">Resolved</option>
          <option value="">All</option>
        </select>
        <select className="input sm:w-56 text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="to_next_meeting">Deferred to Next Meeting</option>
          <option value="push_to_next">Moved to Next Meeting (pre-sitting)</option>
          <option value="back_to_unit">Deferred Back to Unit</option>
          <option value="back_to_hr">Deferred Back to HR</option>
          <option value="on_hold">On Hold</option>
        </select>
        <span className="text-sm text-slate-500 ml-auto inline-flex items-center gap-1.5">
          <Clock size={14} /> {openCount} shown open
        </span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Submission</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">From → To</th>
              <th className="px-4 py-2.5">Current Stage</th>
              <th className="px-4 py-2.5">Deferrals</th>
              <th className="px-4 py-2.5">When</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center"><Loader2 size={20} className="animate-spin text-slate-300 mx-auto" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No deferrals match this filter.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5">
                  <Link to={`/submissions/${r.submission}`} className="font-semibold text-primary-600 hover:underline">{r.submission_ref}</Link>
                  <p className="text-xs text-slate-400 truncate max-w-[220px]">{r.submission_title}</p>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TYPE_STYLE[r.deferral_type] || TYPE_STYLE.on_hold}`}>{r.type_label}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{r.from_meeting_ref || '—'} → {r.to_meeting_ref || '—'}</td>
                <td className="px-4 py-2.5 text-xs">{stageLabel(r.current_stage)}</td>
                <td className="px-4 py-2.5">
                  <span className={`font-semibold ${r.deferral_count > 1 ? 'text-orange-600' : 'text-slate-500'}`}>{r.deferral_count}×</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{r.deferred_at ? new Date(r.deferred_at).toLocaleDateString() : ''}</td>
                <td className="px-4 py-2.5 text-right">
                  {r.resolved ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 size={13} /> Resolved</span>
                  ) : canResolve ? (
                    <button onClick={() => resolve(r.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
                      <RotateCcw size={13} /> Resolve
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

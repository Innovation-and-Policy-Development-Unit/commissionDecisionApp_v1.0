import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scale, RefreshCw, ExternalLink } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'

const LIT_STATUS_COLORS = {
  active:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  settled:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  closed:   'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
  pending:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

function fmt(n) {
  if (n == null || n === '') return '—'
  return `VT ${Number(n).toLocaleString()}`
}

export default function LitigationTracker() {
  const navigate = useNavigate()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get('/compliance/cases/')
      setCases(res.data?.results ?? res.data ?? [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load cases.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Flatten all litigation records with their parent case reference
  const records = []
  cases.forEach((c) => {
    if (c.litigation_records?.length) {
      c.litigation_records.forEach((lit) => {
        records.push({ ...lit, case_id: c.id, case_ref: c.reference_number, case_subject: c.subject_name, case_family_display: c.case_family_display })
      })
    }
  })

  const totalEst    = records.reduce((s, l) => s + (parseFloat(l.estimated_cost) || 0), 0)
  const totalActual = records.reduce((s, l) => s + (parseFloat(l.actual_cost)    || 0), 0)
  const activeCount = records.filter((l) => l.status === 'active').length

  return (
    <div>
      <PageHeader
        title="Litigation Tracker"
        subtitle="All litigation matters and associated costs across compliance cases"
        action={
          <button className="btn-outline flex items-center gap-2 py-2 px-3 text-sm" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-400">Loading…</div>
      ) : (
        <>
          {/* Summary row */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{records.length}</div>
              <div className="text-xs text-slate-500 mt-0.5">Total records</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{activeCount}</div>
              <div className="text-xs text-slate-500 mt-0.5">Active litigation</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{fmt(totalActual || null)}</div>
              <div className="text-xs text-slate-500 mt-0.5">Total actual cost</div>
              {totalEst > 0 && <div className="text-[11px] text-slate-400 mt-0.5">Est. {fmt(totalEst)}</div>}
            </div>
          </div>

          {records.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Scale size={40} className="mx-auto mb-3 opacity-40" />
              No litigation records across any compliance case.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Case</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Legal counsel</th>
                    <th className="px-4 py-3">Court ref</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Est. cost</th>
                    <th className="px-4 py-3">Actual cost</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {records.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-primary-600 dark:text-primary-400">{l.case_ref}</div>
                        <div className="text-xs text-slate-500">{l.case_subject}</div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="truncate text-slate-800 dark:text-slate-100">{l.description}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{l.legal_counsel || '—'}</td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{l.court_reference || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LIT_STATUS_COLORS[l.status] || 'bg-slate-100 text-slate-600'}`}>
                          {l.status_display || l.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmt(l.estimated_cost)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmt(l.actual_cost)}</td>
                      <td className="px-4 py-3">
                        <button
                          className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                          onClick={() => navigate(`/compliance/cases/${l.case_id}`)}
                        >
                          <ExternalLink size={12} /> Case
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

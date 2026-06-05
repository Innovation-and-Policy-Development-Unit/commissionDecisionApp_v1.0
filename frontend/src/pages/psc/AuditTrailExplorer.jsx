import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import BaseSelect from '../../components/shared/BaseSelect'
import BaseInput from '../../components/shared/BaseInput'
import BaseButton from '../../components/shared/BaseButton'
import BaseBadge from '../../components/shared/BaseBadge'
import BaseSpinner from '../../components/shared/BaseSpinner'

const ACTION_COLORS = {
  CREATE: 'success', UPDATE: 'info', DELETE: 'danger',
  LOGIN: 'default', LOGOUT: 'default', DECISION: 'primary',
}

export default function AuditTrailExplorer() {
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [numPages, setNumPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ q: '', action: '', resource_type: '', date_from: '', date_to: '' })
  const searchTimer = useRef(null)

  const load = useCallback(async (params = {}) => {
    setLoading(true)
    try {
      const p = { ...filters, ...params, page }
      const res = await api.get('/audit-logs/search/', { params: p })
      setRecords(res.data.results || [])
      setTotal(res.data.total || 0)
      setNumPages(res.data.num_pages || 1)
    } catch (e) {
      console.error('Audit log error', e)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => { load() }, [load])

  const handleSearchChange = (val) => {
    setFilters(f => ({ ...f, q: val }))
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setPage(1), 400)
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10">
      <PageHeader title="Audit Trail Explorer" subtitle="Search and filter all system activity logs" />

      <div className="flex gap-3 flex-wrap items-end p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
        <div className="flex-1 min-w-[200px]">
          <BaseInput hideLabel label="Search" placeholder="Search description, user, resource…"
            contentBefore={<Search size={15} className="text-slate-400" />}
            value={filters.q} onChange={(e) => handleSearchChange(e.target.value)} />
        </div>
        <BaseSelect hideLabel label="Action" className="w-44" value={filters.action} placeholder="All Actions"
          options={[
            { value: 'CREATE', label: 'Create' }, { value: 'UPDATE', label: 'Update' }, { value: 'DELETE', label: 'Delete' },
            { value: 'LOGIN', label: 'Login' }, { value: 'LOGOUT', label: 'Logout' }, { value: 'DECISION', label: 'Decision' },
          ]}
          onChange={(_, v) => setFilters(f => ({ ...f, action: v }))} />
        <BaseSelect hideLabel label="Resource type" className="w-48" value={filters.resource_type} placeholder="All Resources"
          options={[
            { value: 'Submission', label: 'Submission' }, { value: 'Meeting', label: 'Meeting' }, { value: 'User', label: 'User' },
            { value: 'Minutes', label: 'Minutes' }, { value: 'CommissionTask', label: 'Commission Task' },
          ]}
          onChange={(_, v) => setFilters(f => ({ ...f, resource_type: v }))} />
        <BaseInput hideLabel label="From date" type="date" className="w-40" value={filters.date_from} onChange={(e) => setFilters(f => ({ ...f, date_from: e.target.value }))} />
        <BaseInput hideLabel label="To date" type="date" className="w-40" value={filters.date_to} onChange={(e) => setFilters(f => ({ ...f, date_to: e.target.value }))} />
        <BaseButton icon={<Filter size={15} />} variant="primary" onClick={() => setPage(1)}>Filter</BaseButton>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-200">{total.toLocaleString()} results</span>
          {loading && <BaseSpinner size="sm" label="" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 w-40">Timestamp</th>
                <th className="px-3 py-2 w-32">User</th>
                <th className="px-3 py-2 w-28">Action</th>
                <th className="px-3 py-2 w-36">Resource</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 w-28">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {records.map(log => (
                <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 text-slate-700 dark:text-slate-300">
                  <td className="px-3 py-2">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-3 py-2 font-semibold">{log.user || '—'}</td>
                  <td className="px-3 py-2"><BaseBadge color={ACTION_COLORS[log.action] || 'default'} size="small">{log.action}</BaseBadge></td>
                  <td className="px-3 py-2">
                    {log.resource_type}
                    {log.resource_label && <span className="block text-[10px] text-slate-500">{log.resource_label}</span>}
                  </td>
                  <td className="px-3 py-2">{log.description}</td>
                  <td className="px-3 py-2 font-mono">{log.ip_address || '—'}</td>
                </tr>
              ))}
              {records.length === 0 && !loading && (
                <tr><td colSpan={6} className="p-6 text-slate-500">No audit logs found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end items-center gap-2 px-4 py-3">
          <BaseButton size="sm" variant="ghost" iconOnly icon={<ChevronLeft size={16} />} disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page" />
          <span className="text-sm text-slate-600 dark:text-slate-300">Page {page} of {numPages}</span>
          <BaseButton size="sm" variant="ghost" iconOnly icon={<ChevronRight size={16} />} disabled={page >= numPages} onClick={() => setPage(p => p + 1)} aria-label="Next page" />
        </div>
      </div>
    </div>
  )
}

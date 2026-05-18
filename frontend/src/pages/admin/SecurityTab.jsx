/**
 * SecurityTab — NCSS 2030 / ISO 27001 security features
 * Sub-tabs: Audit Trail | Vulnerability Scan | Incident Response
 * Rendered from /admin/security (AdminSecurityPage).
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileSearch,
  Flag,
  Info,
  ListChecks,
  Play,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-VU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-VU', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const SEV_COLORS = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  high:     'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  HIGH:     'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  medium:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  MEDIUM:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  low:      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  LOW:      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}

const STATUS_COLORS = {
  open:          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  investigating: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  resolved:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  closed:        'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
}

const ACTION_COLORS = {
  LOGIN:           'bg-green-100 text-green-700',
  LOGOUT:          'bg-slate-100 text-slate-600',
  LOGIN_FAILED:    'bg-red-100 text-red-700',
  LOCKOUT:         'bg-red-100 text-red-700',
  UNLOCK:          'bg-amber-100 text-amber-700',
  CREATE:          'bg-blue-100 text-blue-700',
  READ:            'bg-slate-100 text-slate-600',
  UPDATE:          'bg-indigo-100 text-indigo-700',
  DELETE:          'bg-rose-100 text-rose-700',
  DOWNLOAD:        'bg-cyan-100 text-cyan-700',
  BACKUP:          'bg-violet-100 text-violet-700',
  RESTORE:         'bg-orange-100 text-orange-700',
  SETTINGS:        'bg-amber-100 text-amber-700',
  PASSWORD_CHANGE: 'bg-purple-100 text-purple-700',
  '2FA':           'bg-teal-100 text-teal-700',
  PERMISSION:      'bg-pink-100 text-pink-700',
  EXPORT:          'bg-sky-100 text-sky-700',
}

function Chip({ label, colorClass }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${colorClass}`}>
      {label}
    </span>
  )
}

// ─── Audit Trail ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

const ACTION_CHOICES = [
  'LOGIN','LOGOUT','LOGIN_FAILED','LOCKOUT','UNLOCK',
  'CREATE','READ','UPDATE','DELETE','DOWNLOAD',
  'BACKUP','RESTORE','SETTINGS','PASSWORD_CHANGE','2FA','PERMISSION','EXPORT',
]

function AuditTrailPanel() {
  const [logs, setLogs]       = useState([])
  const [page, setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ actor: '', action: '', resource: '', from: '', to: '' })

  const load = useCallback(async (p, f) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', PAGE_SIZE)
      params.set('offset', (p - 1) * PAGE_SIZE)
      if (f.actor)    params.set('actor',    f.actor)
      if (f.action)   params.set('action',   f.action)
      if (f.resource) params.set('resource', f.resource)
      if (f.from)     params.set('from',     f.from)
      if (f.to)       params.set('to',       f.to)
      const res = await api.get(`/audit-logs/?${params}`)
      const data  = Array.isArray(res.data) ? res.data : (res.data?.results ?? [])
      const count = typeof res.data?.count === 'number' ? res.data.count : data.length
      setLogs(data)
      setTotalPages(Math.max(1, Math.ceil(count / PAGE_SIZE)))
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(1, filters) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilters() { setPage(1); load(1, filters) }
  function clearFilters() {
    const empty = { actor: '', action: '', resource: '', from: '', to: '' }
    setFilters(empty); setPage(1); load(1, empty)
  }
  function goPage(p) { setPage(p); load(p, filters) }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input
            className="input text-sm col-span-2 md:col-span-1"
            placeholder="Actor username"
            value={filters.actor}
            onChange={e => setFilters(f => ({ ...f, actor: e.target.value }))}
          />
          <select
            className="input text-sm"
            value={filters.action}
            onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
          >
            <option value="">All actions</option>
            {ACTION_CHOICES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <input
            className="input text-sm"
            placeholder="Resource type"
            value={filters.resource}
            onChange={e => setFilters(f => ({ ...f, resource: e.target.value }))}
          />
          <input type="date" className="input text-sm" value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          <input type="date" className="input text-sm" value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={applyFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors">
            <Search size={12} /> Search
          </button>
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <X size={12} /> Clear
          </button>
          <button onClick={() => load(page, filters)} disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm gap-2">
            <RefreshCw size={15} className="animate-spin" /> Loading audit log…
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm gap-2">
            <Activity size={24} className="opacity-30" />
            No audit records match your filters.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  {['Timestamp','Actor','Action','Resource','Description','IP'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">{fmt(log.timestamp)}</td>
                    <td className="font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {log.actor_username || <span className="italic text-slate-400">anonymous</span>}
                    </td>
                    <td className="whitespace-nowrap">
                      <Chip label={log.action} colorClass={ACTION_COLORS[log.action] ?? 'bg-slate-100 text-slate-600'} />
                    </td>
                    <td className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {log.resource_type ? `${log.resource_type}${log.resource_id ? ` #${log.resource_id}` : ''}` : '—'}
                    </td>
                    <td className="text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {log.description || log.resource_label || '—'}
                    </td>
                    <td className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap font-mono">
                      {log.ip_address || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-500">
            <span className="text-xs">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => goPage(page - 1)} disabled={page <= 1}
                className="p-1.5 rounded border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => goPage(page + 1)} disabled={page >= totalPages}
                className="p-1.5 rounded border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vulnerability Scan ───────────────────────────────────────────────────────

function StatCard({ label, value, colorClass, icon: Icon }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${colorClass}`}><Icon size={18} /></div>
      <div>
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value ?? '—'}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  )
}

function VulnScanPanel() {
  const toast   = useToast()
  const confirm = useConfirm()
  const [scan, setScan]           = useState(null)
  const [loading, setLoading]     = useState(false)
  const [running, setRunning]     = useState(false)
  const [scanType, setScanType]   = useState('full')
  const [section, setSection]     = useState('deps')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/security-scans/latest/')
      setScan(res.status === 204 ? null : res.data)
    } catch { setScan(null) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function runScan() {
    const ok = await confirm({ title: 'Run Security Scan', message: `Start a ${scanType} security scan? This may take 30–90 seconds.`, confirmLabel: 'Run Scan', variant: 'warning' })
    if (!ok) return
    setRunning(true)
    try {
      const res = await api.post('/security-scans/run/', { scan_type: scanType })
      setScan(res.data)
      toast.success('Security scan completed.')
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Scan failed. Check server logs.')
    } finally { setRunning(false) }
  }

  const depVulns   = scan?.dependency_results ?? []
  const sastIssues = scan?.sast_results?.results ?? []
  const summary    = scan?.summary ?? {}

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Scan type:</label>
        <select value={scanType} onChange={e => setScanType(e.target.value)} className="input text-sm w-44">
          <option value="full">Full Scan</option>
          <option value="dependency">Dependencies only</option>
          <option value="sast">SAST only</option>
        </select>
        <button onClick={runScan} disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
          {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
          {running ? 'Scanning…' : 'Run Scan'}
        </button>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        {scan && (
          <div className="ml-auto text-xs text-slate-400">
            Last scan: <span className="font-medium">{fmt(scan.completed_at)}</span>
            {' · '}
            <Chip label={scan.status} colorClass={
              scan.status === 'completed' ? 'bg-green-100 text-green-700' :
              scan.status === 'running'   ? 'bg-blue-100 text-blue-700'  :
                                            'bg-red-100 text-red-700'
            } />
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm gap-2">
          <RefreshCw size={15} className="animate-spin" /> Loading scan results…
        </div>
      )}

      {!loading && !scan && (
        <div className="flex flex-col items-center justify-center h-48 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 text-sm gap-3">
          <ShieldCheck size={32} className="opacity-30" />
          <p>No scans have been run yet.</p>
          <p className="text-xs">Click <strong>Run Scan</strong> to start the first security audit.</p>
        </div>
      )}

      {!loading && scan && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Dep. Vulnerabilities" value={summary.dependency_vulnerabilities ?? depVulns.length}
              colorClass="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400" icon={AlertCircle} />
            <StatCard label="SAST Issues" value={summary.sast_issues_total ?? sastIssues.length}
              colorClass="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" icon={Bug} />
            <StatCard label="High Severity" value={summary.sast_high ?? 0}
              colorClass="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" icon={ShieldAlert} />
            <StatCard label="Medium Severity" value={summary.sast_medium ?? 0}
              colorClass="bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400" icon={AlertTriangle} />
          </div>

          {scan.error_message && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
              <p className="font-semibold mb-1">Scan errors:</p>
              <pre className="text-xs whitespace-pre-wrap">{scan.error_message}</pre>
            </div>
          )}

          {/* Section toggle */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
            {[['deps','Dependencies'], ['sast','SAST (Code)']].map(([id, label]) => (
              <button key={id} onClick={() => setSection(id)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${section === id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Dependency vulnerabilities */}
          {section === 'deps' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {depVulns.length === 0 ? (
                <div className="flex items-center gap-3 p-6 text-green-600 dark:text-green-400">
                  <CheckCircle2 size={20} />
                  <span className="text-sm font-medium">No known vulnerabilities found in dependencies.</span>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        {['Package','Version','CVE / ID','Description','Fix'].map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {depVulns.map((v, i) => (
                        <tr key={i}>
                          <td className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{v.package || v.name || '—'}</td>
                          <td className="font-mono text-xs text-slate-500">{v.installed_version || v.version || '—'}</td>
                          <td className="text-xs text-red-600 dark:text-red-400 font-mono">{v.id || v.vulnerability_id || '—'}</td>
                          <td className="text-xs text-slate-600 dark:text-slate-300 max-w-sm truncate">{v.description || '—'}</td>
                          <td className="text-xs text-slate-500 whitespace-nowrap">
                            {v.fix_versions?.length ? v.fix_versions.join(', ') : (v.fix_version || 'No fix available')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SAST findings */}
          {section === 'sast' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {sastIssues.length === 0 ? (
                <div className="flex items-center gap-3 p-6 text-green-600 dark:text-green-400">
                  <CheckCircle2 size={20} />
                  <span className="text-sm font-medium">No static analysis issues found.</span>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        {['Severity','Issue','File','Line','CWE'].map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sastIssues.map((issue, i) => (
                        <tr key={i}>
                          <td>
                            <Chip label={issue.issue_severity || '—'}
                              colorClass={SEV_COLORS[issue.issue_severity] ?? 'bg-slate-100 text-slate-600'} />
                          </td>
                          <td className="text-xs text-slate-700 dark:text-slate-200 max-w-xs">
                            <span className="font-medium">{issue.test_id}</span>
                            <span className="text-slate-400 ml-1">— {issue.issue_text}</span>
                          </td>
                          <td className="font-mono text-xs text-slate-500 max-w-[200px] truncate" title={issue.filename}>
                            {issue.filename?.split(/[\\/]/).slice(-2).join('/') ?? '—'}
                          </td>
                          <td className="text-xs text-slate-400 font-mono">{issue.line_number ?? '—'}</td>
                          <td className="text-xs text-slate-400">
                            {issue.issue_cwe ? `CWE-${String(issue.issue_cwe).match?.(/\d+/)?.[0] ?? issue.issue_cwe}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Incident Response ────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'phishing',            label: 'Phishing / Social Engineering' },
  { value: 'unauthorized_access', label: 'Unauthorized Access' },
  { value: 'data_breach',         label: 'Data Breach / Exposure' },
  { value: 'malware',             label: 'Malware / Ransomware' },
  { value: 'account_compromise',  label: 'Account Compromise' },
  { value: 'policy_violation',    label: 'Policy Violation' },
  { value: 'suspicious_activity', label: 'Suspicious Activity' },
  { value: 'system_outage',       label: 'System Outage / DoS' },
  { value: 'other',               label: 'Other' },
]

const SEVERITIES = ['low', 'medium', 'high', 'critical']
const STATUSES   = ['open', 'investigating', 'resolved', 'closed']

const INCIDENT_REPORT_EMPTY_FORM = { title: '', description: '', category: 'suspicious_activity', severity: 'medium', affected_systems: '' }
const EMPTY_EDIT = { status: '', severity: '', assigned_to: '', resolution_notes: '' }

function IncidentResponsePanel() {
  const toast = useToast()
  const [incidents, setIncidents]       = useState([])
  const [loading, setLoading]           = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [showReport, setShowReport]     = useState(false)
  const [editId, setEditId]             = useState(null)
  const [form, setForm]                 = useState(INCIDENT_REPORT_EMPTY_FORM)
  const [editForm, setEditForm]         = useState(EMPTY_EDIT)
  const [saving, setSaving]             = useState(false)
  const [users, setUsers]               = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = statusFilter ? `?status=${statusFilter}` : ''
      const [incRes, usrRes] = await Promise.allSettled([
        api.get(`/incidents/${params}`),
        api.get('/users/'),
      ])
      if (incRes.status === 'fulfilled') setIncidents(incRes.value.data)
      if (usrRes.status === 'fulfilled') setUsers(usrRes.value.data)
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  async function submitReport(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/incidents/', form)
      setShowReport(false)
      setForm(INCIDENT_REPORT_EMPTY_FORM)
      load()
      toast.success('Incident reported successfully.')
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Failed to submit incident.')
    } finally { setSaving(false) }
  }

  async function saveEdit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {}
      if (editForm.status)           payload.status           = editForm.status
      if (editForm.severity)         payload.severity         = editForm.severity
      if (editForm.resolution_notes !== undefined) payload.resolution_notes = editForm.resolution_notes
      if (editForm.assigned_to)      payload.assigned_to      = Number(editForm.assigned_to)
      await api.patch(`/incidents/${editId}/`, payload)
      setEditId(null)
      setEditForm(EMPTY_EDIT)
      load()
      toast.success('Incident updated.')
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Failed to update incident.')
    } finally { setSaving(false) }
  }

  function openEdit(inc) {
    setEditId(inc.id)
    setEditForm({
      status:           inc.status,
      severity:         inc.severity,
      assigned_to:      inc.assigned_to ?? '',
      resolution_notes: inc.resolution_notes || '',
    })
    setShowReport(false)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap items-center gap-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input text-sm w-44">
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        <button onClick={() => { setShowReport(s => !s); setEditId(null) }}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0c2451] hover:bg-[#0a1d3e] text-white text-sm font-medium transition-colors">
          <Flag size={14} /> Report Incident
        </button>
      </div>

      {/* Report form */}
      {showReport && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
          <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-4 flex items-center gap-2 text-sm">
            <ShieldAlert size={16} /> Report a Security Incident
          </h3>
          <form onSubmit={submitReport} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Incident Title *</label>
                <input className="input text-sm" required value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Brief summary of the incident" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Category</label>
                <select className="input text-sm" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Severity</label>
                <select className="input text-sm" value={form.severity}
                  onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Affected Systems</label>
                <input className="input text-sm" value={form.affected_systems}
                  onChange={e => setForm(f => ({ ...f, affected_systems: e.target.value }))}
                  placeholder="e.g. Login portal, database, email server" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Description *</label>
                <textarea className="input text-sm resize-none" rows={3} required value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe what happened, when it was noticed, and any impact observed." />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <Flag size={13} />}
                Submit Report
              </button>
              <button type="button" onClick={() => setShowReport(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit form */}
      {editId && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
          <h3 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-4 flex items-center gap-2 text-sm">
            <Shield size={16} /> Update Incident #{editId}
          </h3>
          <form onSubmit={saveEdit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Status</label>
                <select className="input text-sm" value={editForm.status}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Severity</label>
                <select className="input text-sm" value={editForm.severity}
                  onChange={e => setEditForm(f => ({ ...f, severity: e.target.value }))}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Assign To</label>
                <select className="input text-sm" value={editForm.assigned_to}
                  onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Resolution Notes</label>
                <textarea className="input text-sm resize-none" rows={3} value={editForm.resolution_notes}
                  onChange={e => setEditForm(f => ({ ...f, resolution_notes: e.target.value }))}
                  placeholder="Document investigation findings, actions taken, and resolution steps." />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Save Changes
              </button>
              <button type="button" onClick={() => { setEditId(null); setEditForm(EMPTY_EDIT) }}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Incident list */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400 text-sm gap-2">
          <RefreshCw size={15} className="animate-spin" /> Loading incidents…
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 text-sm gap-2">
          <ShieldCheck size={28} className="opacity-30" />
          <p>No incidents reported.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map(inc => (
            <div key={inc.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{inc.title}</span>
                    <Chip label={inc.severity} colorClass={SEV_COLORS[inc.severity] ?? 'bg-slate-100 text-slate-600'} />
                    <Chip label={inc.status.replace('_', ' ')} colorClass={STATUS_COLORS[inc.status] ?? 'bg-slate-100 text-slate-600'} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">{inc.description}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1">
                      <Flag size={11} />
                      {CATEGORIES.find(c => c.value === inc.category)?.label ?? inc.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> Reported {fmtDate(inc.created_at)} by {inc.reported_by_username || '—'}
                    </span>
                    {inc.assigned_to_username && (
                      <span className="flex items-center gap-1">
                        <Shield size={11} /> Assigned to {inc.assigned_to_username}
                      </span>
                    )}
                    {inc.affected_systems && (
                      <span className="flex items-center gap-1">
                        <Info size={11} /> {inc.affected_systems}
                      </span>
                    )}
                  </div>
                  {inc.resolution_notes && (
                    <div className="mt-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-xs text-green-700 dark:text-green-300">
                      <strong>Resolution:</strong> {inc.resolution_notes}
                    </div>
                  )}
                </div>
                <button onClick={() => openEdit(inc)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
                  Update
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Root SecurityTab ─────────────────────────────────────────────────────────

// ─── System Audit Panel ───────────────────────────────────────────────────────

const STATUS_ICON = {
  pass: <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />,
  warn: <AlertCircle size={16} className="text-amber-500  shrink-0" />,
  fail: <AlertTriangle size={16} className="text-red-500    shrink-0" />,
}

const STATUS_ROW = {
  pass: 'border-emerald-100 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20',
  warn: 'border-amber-100  bg-amber-50  dark:border-amber-800  dark:bg-amber-900/20',
  fail: 'border-red-100    bg-red-50    dark:border-red-800    dark:bg-red-900/20',
}

function SystemAuditPanel() {
  const [audit,     setAudit]     = useState(null)
  const [inventory, setInventory] = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [showAll,   setShowAll]   = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [auditRes, invRes] = await Promise.all([
        api.get('/auth/security-audit/'),
        api.get('/auth/api-inventory/'),
      ])
      setAudit(auditRes.data)
      setInventory(invRes.data)
    } catch {
      setError('Failed to load audit data. Admin access required.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { run() }, [run])

  const endpoints = inventory?.endpoints || []
  const visible   = showAll ? endpoints : endpoints.slice(0, 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">System Security Audit</h3>
          <p className="text-xs text-slate-500 mt-0.5">Configuration health checks and API endpoint inventory.</p>
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Running…' : 'Re-run Audit'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Config health checks */}
      {audit && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
            <Shield size={15} className="text-slate-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Configuration Checks</span>
            <div className="ml-auto flex gap-2 text-xs">
              <span className="text-emerald-600 font-medium">{audit.summary.pass} pass</span>
              <span className="text-amber-600 font-medium">{audit.summary.warn} warn</span>
              <span className="text-red-600 font-medium">{audit.summary.fail} fail</span>
            </div>
          </div>
          <div className="space-y-2">
            {audit.checks.map(c => (
              <div key={c.id}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${STATUS_ROW[c.status]}`}>
                {STATUS_ICON[c.status]}
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 dark:text-slate-200">{c.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API inventory */}
      {inventory && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
            <ListChecks size={15} className="text-slate-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">API Endpoint Inventory</span>
            <span className="ml-auto text-xs text-slate-400">{inventory.count} endpoints</span>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Name</th>
                  <th>Handler</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((ep, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs text-slate-700 dark:text-slate-300">{ep.path}</td>
                    <td className="text-xs text-slate-500 dark:text-slate-400">{ep.name || '—'}</td>
                    <td className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{ep.handler}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {endpoints.length > 20 && (
            <button onClick={() => setShowAll(p => !p)}
              className="text-xs text-primary-600 hover:underline">
              {showAll ? 'Show less' : `Show all ${endpoints.length} endpoints`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-tab registry ─────────────────────────────────────────────────────────

const ALL_SUB_TABS = [
  { id: 'audit',    label: 'Audit Trail',        icon: Activity,   adminOnly: false },
  { id: 'sysaudit', label: 'System Audit',       icon: Shield,     adminOnly: true  },
  { id: 'scan',     label: 'Vulnerability Scan', icon: FileSearch, adminOnly: true  },
  { id: 'incident', label: 'Incident Response',  icon: ShieldAlert,adminOnly: true  },
]

export default function SecurityTab({ isAdmin = false }) {
  const subTabs = ALL_SUB_TABS.filter(t => !t.adminOnly || isAdmin)
  const [sub, setSub] = useState('audit')

  // If the current sub-tab is no longer visible (e.g. non-admin sees scan), reset to audit
  const visibleIds = subTabs.map(t => t.id)
  const activeSub  = visibleIds.includes(sub) ? sub : 'audit'

  return (
    <div className="space-y-5">
      {/* Non-admin notice shown only when there's more than one tab and user can't see it */}
      {!isAdmin && (
        <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          <span>You have read-only access to the Audit Trail. Vulnerability scanning and incident management are restricted to system administrators.</span>
        </div>
      )}

      {/* Sub-tab bar */}
      {subTabs.length > 1 && (
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
          {subTabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setSub(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeSub === id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      )}

      {activeSub === 'audit'    && <AuditTrailPanel />}
      {activeSub === 'sysaudit' && isAdmin && <SystemAuditPanel />}
      {activeSub === 'scan'     && isAdmin && <VulnScanPanel />}
      {activeSub === 'incident' && isAdmin && <IncidentResponsePanel />}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, RefreshCw, Send, Trash2 } from 'lucide-react'
import api from '../../api/client'
import { formatApiError } from '../../utils/apiError'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  userCanAccessAdminPanel,
  userCanManageRoles,
} from '../../utils/adminAccess'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'settings', label: 'Settings', manageOnly: true },
  { id: 'logs', label: 'Delivery Logs' },
  { id: 'preferences', label: 'Staff Preferences', manageOnly: true },
]

const HOURS = [5, 6, 7, 8, 9, 10, 11, 12]

function KpiCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function DailyBriefAdmin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const canManage = userCanManageRoles(user)
  const canView = userCanAccessAdminPanel(user)

  const [tab, setTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState(null)
  const [dashboardError, setDashboardError] = useState('')
  const [settings, setSettings] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState({ results: [], count: 0 })
  const [logFilters, setLogFilters] = useState({
    brief_type: '',
    status: '',
    date_from: '',
    date_to: '',
    page: 1,
  })
  const [preferences, setPreferences] = useState([])
  const [prefSaving, setPrefSaving] = useState(null)
  const [testSending, setTestSending] = useState(false)
  const [testUserId, setTestUserId] = useState('')
  const [testBriefType, setTestBriefType] = useState('staff')

  useEffect(() => {
    if (user && !canView) navigate('/', { replace: true })
  }, [user, canView, navigate])

  const fetchDashboard = useCallback(async () => {
    setDashboardError('')
    try {
      const res = await api.get('/daily-brief/dashboard/')
      setDashboard(res.data)
    } catch (err) {
      setDashboard(null)
      setDashboardError(
        formatApiError(err, 'Daily Brief dashboard is unavailable. Check that API migrations have run.'),
      )
      throw err
    }
  }, [])

  const fetchSettings = useCallback(async () => {
    const res = await api.get('/daily-brief/settings/')
    setSettings(res.data)
  }, [])

  const fetchLogs = useCallback(async () => {
    const params = { page: logFilters.page, page_size: 25 }
    if (logFilters.brief_type) params.brief_type = logFilters.brief_type
    if (logFilters.status) params.status = logFilters.status
    if (logFilters.date_from) params.date_from = logFilters.date_from
    if (logFilters.date_to) params.date_to = logFilters.date_to
    const res = await api.get('/daily-brief/logs/', { params })
    setLogs(res.data)
  }, [logFilters])

  const fetchPreferences = useCallback(async () => {
    const res = await api.get('/daily-brief/preferences/')
    setPreferences(Array.isArray(res.data) ? res.data : [])
  }, [])

  const fetchUsers = useCallback(async () => {
    if (!canManage) return
    try {
      const res = await api.get('/users/')
      setUsers(Array.isArray(res.data) ? res.data : [])
    } catch {
      setUsers([])
    }
  }, [canManage])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await fetchDashboard()
      if (canManage) {
        await Promise.all([fetchSettings(), fetchUsers()])
      }
      if (tab === 'logs') await fetchLogs()
      if (tab === 'preferences' && canManage) await fetchPreferences()
    } catch {
      toast.error('Failed to load daily brief data.')
    } finally {
      setLoading(false)
    }
  }, [canManage, tab, fetchDashboard, fetchSettings, fetchUsers, fetchLogs, fetchPreferences, toast])

  useEffect(() => {
    if (canView) refresh()
  }, [canView])

  useEffect(() => {
    if (!canView) return
    if (tab === 'logs') fetchLogs()
    if (tab === 'preferences' && canManage) fetchPreferences()
  }, [tab, logFilters.page, canView, canManage, fetchLogs, fetchPreferences])

  const visibleTabs = useMemo(
    () => TABS.filter(t => !t.manageOnly || canManage),
    [canManage],
  )

  const saveSettings = async () => {
    if (!settings) return
    setSavingSettings(true)
    try {
      const res = await api.patch('/daily-brief/settings/', settings)
      setSettings(res.data)
      await fetchDashboard()
      toast.success('Settings saved.')
    } catch (err) {
      toast.error(formatApiError(err, 'Failed to save settings.'))
    } finally {
      setSavingSettings(false)
    }
  }

  const toggleModule = async () => {
    if (!settings) return
    const next = { ...settings, enabled: !settings.enabled }
    setSavingSettings(true)
    try {
      const res = await api.patch('/daily-brief/settings/', { enabled: next.enabled })
      setSettings(res.data)
      await fetchDashboard()
      toast.success(next.enabled ? 'Daily brief enabled.' : 'Daily brief paused.')
    } catch (err) {
      toast.error(formatApiError(err, 'Failed to update status.'))
    } finally {
      setSavingSettings(false)
    }
  }

  const sendTest = async () => {
    setTestSending(true)
    try {
      await api.post('/daily-brief/send-test/', {
        test_user_id: testUserId ? Number(testUserId) : user?.id,
        brief_type: testBriefType,
      })
      toast.success('Test brief sent (check delivery logs).')
      await fetchLogs()
    } catch (err) {
      toast.error(formatApiError(err, 'Test send failed.'))
    } finally {
      setTestSending(false)
    }
  }

  const purgeLogs = async () => {
    const ok = await confirm({
      title: 'Purge old logs?',
      message: 'Delete delivery logs older than 90 days. This cannot be undone.',
      confirmLabel: 'Purge',
      variant: 'danger',
    })
    if (!ok) return
    try {
      const res = await api.post('/daily-brief/purge-logs/')
      toast.success(`Purged ${res.data.deleted ?? 0} log entries.`)
      fetchLogs()
    } catch {
      toast.error('Purge failed.')
    }
  }

  const savePreference = async (userId, enabled) => {
    setPrefSaving(userId)
    try {
      await api.patch(`/daily-brief/preferences/${userId}/`, { enabled })
      setPreferences(prev =>
        prev.map(p => (p.user_id === userId ? { ...p, enabled } : p)),
      )
    } catch {
      toast.error('Failed to save preference.')
    } finally {
      setPrefSaving(null)
    }
  }

  const bulkPreferences = async (enabled) => {
    const ids = preferences.map(p => p.user_id)
    if (!ids.length) return
    try {
      await api.post('/daily-brief/preferences/bulk/', { user_ids: ids, enabled })
      setPreferences(prev => prev.map(p => ({ ...p, enabled })))
      toast.success(enabled ? 'All staff enabled.' : 'All staff disabled.')
    } catch {
      toast.error('Bulk update failed.')
    }
  }

  if (!user || !canView) return null

  const statusBadge =
    dashboard?.module_status === 'active'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Daily Brief</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Morning email digests for staff and managers — tasks, submissions, and meetings.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {dashboard?.test_mode && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle size={16} />
          Test mode is on — all briefs go to {settings?.test_recipient_email || 'configured test email'}.
        </div>
      )}

      {dashboard?.beat_stale_warning && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          <AlertTriangle size={16} />
          Celery beat has not run in over 28 hours. Check worker/beat containers.
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !dashboard && !dashboardError ? (
        <div className="flex justify-center h-48 items-center text-slate-400 text-sm gap-2">
          <RefreshCw size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {dashboardError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-100">
              {dashboardError}
            </div>
          )}
          {tab === 'dashboard' && dashboard && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge}`}>
                  {dashboard.module_status === 'active' ? 'ACTIVE' : 'PAUSED'}
                </span>
                {canManage && (
                  <button
                    type="button"
                    onClick={toggleModule}
                    disabled={savingSettings}
                    className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {dashboard.enabled ? 'Pause module' : 'Enable module'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Briefs sent today" value={dashboard.briefs_sent_today ?? 0} />
                <KpiCard
                  label="Staff receiving briefs"
                  value={dashboard.staff_receiving_today ?? 0}
                  sub={`${dashboard.staff_enabled_count ?? 0} / ${dashboard.staff_total ?? 0} enabled`}
                />
                <KpiCard
                  label="Next beat run"
                  value={
                    dashboard.next_scheduled_run
                      ? new Date(dashboard.next_scheduled_run).toLocaleString()
                      : '—'
                  }
                />
                <KpiCard label="Failed (7 days)" value={dashboard.failed_last_7_days ?? 0} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Recent deliveries</h2>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-left text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Recipient</th>
                        <th className="px-3 py-2">Sections</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dashboard.recent_deliveries || []).map(row => (
                        <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-2 whitespace-nowrap">
                            {new Date(row.created_at).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 capitalize">{row.brief_type}</td>
                          <td className="px-3 py-2 capitalize">{row.status}</td>
                          <td className="px-3 py-2">{row.recipient_email}</td>
                          <td className="px-3 py-2">{row.sections_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'settings' && canManage && settings && (
            <div className="space-y-6 max-w-2xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={e => setSettings(s => ({ ...s, enabled: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Enable daily brief delivery</span>
              </label>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Delivery hour (Pacific/Efate)
                </label>
                <select
                  value={settings.delivery_hour}
                  onChange={e =>
                    setSettings(s => ({ ...s, delivery_hour: Number(e.target.value) }))
                  }
                  className="w-full max-w-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                >
                  {HOURS.map(h => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.weekdays_only}
                  onChange={e =>
                    setSettings(s => ({ ...s, weekdays_only: e.target.checked }))
                  }
                  className="rounded"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Weekdays only (Mon–Fri)</span>
              </label>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Manager brief recipients
                </label>
                <select
                  multiple
                  value={(settings.manager_recipient_ids || []).map(String)}
                  onChange={e => {
                    const selected = Array.from(e.target.selectedOptions).map(o => Number(o.value))
                    setSettings(s => ({ ...s, manager_recipient_ids: selected }))
                  }}
                  className="w-full min-h-[120px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.username} — {u.email || 'no email'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple users.</p>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Test mode</h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.test_mode}
                    onChange={e => setSettings(s => ({ ...s, test_mode: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Redirect all briefs to test email</span>
                </label>
                <input
                  type="email"
                  placeholder="test@example.gov.vu"
                  value={settings.test_recipient_email || ''}
                  onChange={e =>
                    setSettings(s => ({ ...s, test_recipient_email: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Brief type</label>
                    <select
                      value={testBriefType}
                      onChange={e => setTestBriefType(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1.5 text-sm"
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">As user ID (staff)</label>
                    <input
                      type="number"
                      value={testUserId}
                      onChange={e => setTestUserId(e.target.value)}
                      placeholder={String(user?.id ?? '')}
                      className="w-28 rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={sendTest}
                    disabled={testSending}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Send size={14} />
                    {testSending ? 'Sending…' : 'Send test brief now'}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={saveSettings}
                disabled={savingSettings}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium disabled:opacity-50"
              >
                {savingSettings ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          )}

          {tab === 'logs' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-end">
                <select
                  value={logFilters.brief_type}
                  onChange={e => setLogFilters(f => ({ ...f, brief_type: e.target.value, page: 1 }))}
                  className="rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1.5 text-sm"
                >
                  <option value="">All types</option>
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                </select>
                <select
                  value={logFilters.status}
                  onChange={e => setLogFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
                  className="rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1.5 text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                  <option value="skipped">Skipped</option>
                </select>
                <input
                  type="date"
                  value={logFilters.date_from}
                  onChange={e => setLogFilters(f => ({ ...f, date_from: e.target.value, page: 1 }))}
                  className="rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1.5 text-sm"
                />
                <input
                  type="date"
                  value={logFilters.date_to}
                  onChange={e => setLogFilters(f => ({ ...f, date_to: e.target.value, page: 1 }))}
                  className="rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1.5 text-sm"
                />
                {canManage && (
                  <button
                    type="button"
                    onClick={purgeLogs}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 size={14} /> Purge &gt;90 days
                  </button>
                )}
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">User</th>
                      <th className="px-3 py-2">Recipient</th>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Items</th>
                      <th className="px-3 py-2">ms</th>
                      <th className="px-3 py-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(logs.results || []).map(row => (
                      <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 capitalize">{row.brief_type}</td>
                        <td className="px-3 py-2 capitalize">{row.status}</td>
                        <td className="px-3 py-2">{row.username || '—'}</td>
                        <td className="px-3 py-2">{row.recipient_email}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate" title={row.subject}>
                          {row.subject}
                        </td>
                        <td className="px-3 py-2">
                          {row.sections_count}/{row.items_total}
                        </td>
                        <td className="px-3 py-2">{row.generation_ms}</td>
                        <td className="px-3 py-2 text-red-600 max-w-[160px] truncate" title={row.error_message}>
                          {row.error_message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center text-sm text-slate-500">
                <span>{logs.count ?? 0} entries</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={logFilters.page <= 1}
                    onClick={() => setLogFilters(f => ({ ...f, page: f.page - 1 }))}
                    className="px-3 py-1 border rounded-lg disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={(logs.results || []).length < 25}
                    onClick={() => setLogFilters(f => ({ ...f, page: f.page + 1 }))}
                    className="px-3 py-1 border rounded-lg disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'preferences' && canManage && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => bulkPreferences(true)}
                  className="text-sm px-3 py-1.5 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Enable all
                </button>
                <button
                  type="button"
                  onClick={() => bulkPreferences(false)}
                  className="text-sm px-3 py-1.5 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Disable all
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">User</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Enabled</th>
                      <th className="px-3 py-2">Last delivery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preferences.map(p => (
                      <tr key={p.user_id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2">{p.full_name || p.username}</td>
                        <td className="px-3 py-2">{p.email}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            disabled={prefSaving === p.user_id}
                            onClick={() => savePreference(p.user_id, !p.enabled)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${
                              p.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                p.enabled ? 'left-5' : 'left-0.5'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {p.last_delivered_at
                            ? new Date(p.last_delivered_at).toLocaleString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

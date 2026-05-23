import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  Eye,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { userCanManageRoles } from '../../utils/adminAccess'

const CATEGORY_ORDER = [
  { id: 'authentication', label: 'Authentication' },
  { id: 'submission_workflow', label: 'Submission workflow' },
  { id: 'tasks', label: 'Tasks & deadlines' },
  { id: 'system', label: 'System' },
]

const EMPTY_EDIT = {
  name: '',
  description: '',
  subject_template: '',
  body_text_template: '',
  body_html_template: '',
  is_active: true,
}

export default function AdminEmailTemplatesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSlug, setSelectedSlug] = useState(null)
  const [edit, setEdit] = useState(EMPTY_EDIT)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [filterQ, setFilterQ] = useState('')

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/email-templates/')
      const list = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setTemplates(list)
      setSelectedSlug(prev => prev || (list.length > 0 ? list[0].slug : null))
    } catch {
      setTemplates([])
      toast.error('Failed to load email templates.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  useEffect(() => {
    if (user?.email && !testTo) setTestTo(user.email)
  }, [user?.email, testTo])

  useEffect(() => {
    if (user && !userCanManageRoles(user)) navigate('/', { replace: true })
  }, [user, navigate])

  const selected = useMemo(
    () => templates.find(t => t.slug === selectedSlug) ?? null,
    [templates, selectedSlug],
  )

  useEffect(() => {
    if (!selected) {
      setEdit(EMPTY_EDIT)
      setPreview(null)
      return
    }
    setEdit({
      name: selected.name,
      description: selected.description || '',
      subject_template: selected.subject_template || '',
      body_text_template: selected.body_text_template || '',
      body_html_template: selected.body_html_template || '',
      is_active: selected.is_active,
    })
    setPreview(null)
  }, [selected?.slug])

  const filteredByCategory = useMemo(() => {
    const q = filterQ.trim().toLowerCase()
    const groups = {}
    CATEGORY_ORDER.forEach(c => { groups[c.id] = [] })
    templates.forEach(t => {
      if (q && !`${t.name} ${t.slug} ${t.description}`.toLowerCase().includes(q)) return
      const cat = t.category || 'system'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(t)
    })
    return groups
  }, [templates, filterQ])

  const saveTemplate = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await api.patch(`/email-templates/${selected.slug}/`, edit)
      setTemplates(prev => prev.map(t => (t.slug === selected.slug ? res.data : t)))
      toast.success('Template saved.')
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to save template.')
    } finally {
      setSaving(false)
    }
  }

  const runPreview = async () => {
    if (!selected) return
    setPreviewLoading(true)
    try {
      await api.patch(`/email-templates/${selected.slug}/`, edit)
      const res = await api.post(`/email-templates/${selected.slug}/preview/`, {})
      setPreview(res.data)
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Preview failed.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const sendTest = async () => {
    if (!selected) return
    const to = testTo.trim()
    if (!to) {
      toast.error('Enter a recipient email.')
      return
    }
    setTestSending(true)
    try {
      await api.patch(`/email-templates/${selected.slug}/`, edit)
      const res = await api.post(`/email-templates/${selected.slug}/send-test/`, { to })
      toast.success(res.data.detail ?? 'Test email sent.')
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to send test email.')
    } finally {
      setTestSending(false)
    }
  }

  const resetTemplate = async () => {
    if (!selected?.is_system) return
    const ok = await confirm({
      title: 'Reset template?',
      message: `Restore “${selected.name}” to the built-in default text? Your edits will be lost.`,
      confirmLabel: 'Reset',
      variant: 'warning',
    })
    if (!ok) return
    try {
      const res = await api.post(`/email-templates/${selected.slug}/reset/`)
      setTemplates(prev => prev.map(t => (t.slug === selected.slug ? res.data : t)))
      toast.success('Template reset to default.')
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Reset failed.')
    }
  }

  const syncDefaults = async () => {
    try {
      await api.post('/email-templates/seed-defaults/')
      await fetchTemplates()
      toast.success('Default templates synced.')
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Sync failed.')
    }
  }

  if (!user || !userCanManageRoles(user)) return null

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Mail size={22} className="text-primary-500" />
            Email templates
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Edit subject and body for password reset, submission workflow updates, task assignment, and due-date reminders.
            Greet each user by first name — e.g. <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">Dear {'{{firstname}}'},</code> becomes
            <span className="text-slate-700 dark:text-slate-300"> Dear Herman,</span> when sent.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={syncDefaults}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Sync defaults
          </button>
          <button
            type="button"
            onClick={fetchTemplates}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600"
            aria-label="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm gap-2">
          <RefreshCw size={16} className="animate-spin" /> Loading templates…
        </div>
      ) : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          <aside className="space-y-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                className="input text-sm pl-9 w-full"
                placeholder="Search templates…"
                value={filterQ}
                onChange={e => setFilterQ(e.target.value)}
              />
            </div>
            <nav className="space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
              {CATEGORY_ORDER.map(cat => {
                const items = filteredByCategory[cat.id] || []
                if (items.length === 0) return null
                return (
                  <div key={cat.id}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1">
                      {cat.label}
                    </p>
                    <ul className="space-y-0.5">
                      {items.map(t => (
                        <li key={t.slug}>
                          <button
                            type="button"
                            onClick={() => setSelectedSlug(t.slug)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              selectedSlug === t.slug
                                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="block truncate">{t.name}</span>
                            {!t.is_active && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400">Inactive</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </nav>
          </aside>

          <div className="min-w-0">
            {!selected ? (
              <p className="text-sm text-slate-500">Select a template to edit.</p>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selected.name}</h2>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{selected.slug}</p>
                    {selected.description && (
                      <p className="text-sm text-slate-500 mt-2">{selected.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Active</span>
                    <button
                      type="button"
                      onClick={() => setEdit(e => ({ ...e, is_active: !e.is_active }))}
                      aria-label="Toggle active"
                    >
                      {edit.is_active
                        ? <ToggleRight size={28} className="text-emerald-500" />
                        : <ToggleLeft size={28} className="text-slate-300" />}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-primary-200 dark:border-primary-800/50 bg-primary-50/50 dark:bg-primary-900/20 px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <p className="font-medium text-slate-700 dark:text-slate-200">Personalization (filled from the recipient&apos;s account)</p>
                  <p>
                    <code className="bg-white/80 dark:bg-slate-800 px-1 rounded">{'{{firstname}}'}</code> or{' '}
                    <code className="bg-white/80 dark:bg-slate-800 px-1 rounded">{'{firstname}'}</code>
                    {' '}— first name (e.g. Herman). Also:{' '}
                    <code className="bg-white/80 dark:bg-slate-800 px-1 rounded">{'{{greeting}}'}</code>
                    {' '}(Dear Herman,),{' '}
                    <code className="bg-white/80 dark:bg-slate-800 px-1 rounded">{'{{lastname}}'}</code>,{' '}
                    <code className="bg-white/80 dark:bg-slate-800 px-1 rounded">{'{{full_name}}'}</code>,{' '}
                    <code className="bg-white/80 dark:bg-slate-800 px-1 rounded">{'{{email}}'}</code>
                  </p>
                </div>

                {selected.placeholder_list?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      All placeholders for this template
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.placeholder_list.map(ph => (
                        <code
                          key={ph}
                          className={`text-[11px] px-2 py-0.5 rounded-full ${
                            ['firstname', 'lastname', 'full_name', 'greeting', 'recipient_name', 'username', 'email'].includes(ph)
                              ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {`{{${ph}}}`}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Display name</label>
                    <input
                      className="input text-sm w-full"
                      value={edit.name}
                      onChange={e => setEdit(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Subject</label>
                    <input
                      className="input text-sm w-full font-mono"
                      value={edit.subject_template}
                      onChange={e => setEdit(f => ({ ...f, subject_template: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Plain text body</label>
                    <textarea
                      className="input text-sm w-full font-mono min-h-[200px]"
                      value={edit.body_text_template}
                      onChange={e => setEdit(f => ({ ...f, body_text_template: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">HTML body (optional)</label>
                    <textarea
                      className="input text-sm w-full font-mono min-h-[100px]"
                      placeholder="Leave empty for plain text only"
                      value={edit.body_html_template}
                      onChange={e => setEdit(f => ({ ...f, body_html_template: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveTemplate}
                    disabled={saving}
                    className="btn-primary py-2 px-4 text-sm inline-flex items-center gap-2"
                  >
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={runPreview}
                    disabled={previewLoading}
                    className="py-2 px-4 text-sm rounded-lg border border-slate-200 dark:border-slate-700 inline-flex items-center gap-2"
                  >
                    {previewLoading ? <RefreshCw size={14} className="animate-spin" /> : <Eye size={14} />}
                    Preview
                  </button>
                  {selected.is_system && (
                    <button
                      type="button"
                      onClick={resetTemplate}
                      className="py-2 px-4 text-sm rounded-lg border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 inline-flex items-center gap-2"
                    >
                      <RotateCcw size={14} /> Reset to default
                    </button>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Send test (uses sample placeholder data)</p>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                    <input
                      type="email"
                      className="input text-sm flex-1"
                      placeholder="Recipient email"
                      value={testTo}
                      onChange={e => setTestTo(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={sendTest}
                      disabled={testSending}
                      className="py-2 px-4 text-sm rounded-lg border border-primary-500 text-primary-600 inline-flex items-center justify-center gap-2"
                    >
                      {testSending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                      Send test
                    </button>
                  </div>
                </div>

                {preview && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600">
                      Preview — {preview.subject}
                    </div>
                    <pre className="p-4 text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300 max-h-80 overflow-y-auto">
                      {preview.body_text}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

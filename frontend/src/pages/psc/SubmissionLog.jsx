import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/shared/PageHeader'
import Modal from '../../components/shared/Modal'
import Badge from '../../components/shared/Badge'
import api from '../../api/client'
import { stageLabel, stageBadgeClass, STAGE_META } from '../../constants/stages'
import SubmissionProgressBar from '../../components/shared/SubmissionProgressBar'
import { PlusCircle, RefreshCw, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Eye, FileText, Sparkles, Loader2, LayoutList, Columns3 } from 'lucide-react'
import SubmissionKanbanBoard from '../../components/submissions/SubmissionKanbanBoard'
import SubmissionForm from './SubmissionForm'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
import { isComplianceRole } from '../../constants/compliance'
import BulkOperationsBar from '../../components/shared/BulkOperationsBar'
import { useToast } from '../../context/ToastContext'
import { QualityScoreBadge } from '../../components/submissions/SubmissionQualityScore'

const PER_PAGE = 15

function normalizeSubmissionsPayload(data) {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.results)) return data.results
  return []
}

// Map workflow stages to Badge variants
const STAGE_VARIANT = {
  draft:                'secondary',
  submitted:            'info',
  received:             'info',
  under_assessment:     'warning',
  assessment_complete:  'primary',
  scheduled_for_meeting:'primary',
  decided:              'success',
  implemented:          'success',
  closed:               'secondary',
  withdrawn:            'secondary',
  rejected:             'danger',
}

export default function SubmissionLog() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()

  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState('')
  const [q, setQ]                 = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [ministryFilter, setMinistryFilter] = useState('')
  const [page, setPage]           = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected]   = useState(new Set())
  const [nlQuery, setNlQuery]     = useState('')
  const [nlBusy, setNlBusy]       = useState(false)
  const [nlMeta, setNlMeta]       = useState(null)
  const [nlIdSet, setNlIdSet]     = useState(null)
  const [viewMode, setViewMode]   = useState('list')

  const isAdmin = user?.role === 'psc_admin'
  const isComplianceUser = user && isComplianceRole(user.role)
  const canCreateSubmission = user && !isComplianceUser
  const showQualityColumn = user && [
    'psc_officer', 'psc_admin', 'psc_secretary', 'senior_admin_officer', 'psc_manager',
    'odu_manager', 'hr_unit_manager', 'vipam_manager', 'compliance_manager',
    'compliance_senior', 'compliance_principal',
  ].includes(user.role)

  const localeForDates = useMemo(() => {
    const map = { en: 'en-GB', fr: 'fr-FR', bi: 'en-GB' }
    return map[i18n.resolvedLanguage] || map[i18n.language] || 'en-GB'
  }, [i18n.resolvedLanguage, i18n.language])

  const loadRows = useCallback(() => {
    setLoading(true)
    setLoadError('')
    return api.get('/submissions/')
      .then(res => setRows(normalizeSubmissionsPayload(res.data)))
      .catch(err => {
        const d = err.response?.data
        const msg = typeof d?.detail === 'string' ? d.detail : err.message || t('submission.load_error_default')
        setLoadError(msg)
        setRows([])
      })
      .finally(() => setLoading(false))
  }, [t])

  useEffect(() => { loadRows() }, [loadRows])

  // Unique sorted ministries from loaded data
  const ministryOptions = useMemo(() => {
    const names = [...new Set(rows.map(r => r.ministry_name).filter(Boolean))].sort()
    return names
  }, [rows])

  // Stage groups for the dropdown optgroups
  const stageGroups = useMemo(() => {
    const groups = {}
    Object.entries(STAGE_META).forEach(([code, meta]) => {
      if (!groups[meta.category]) groups[meta.category] = []
      groups[meta.category].push(code)
    })
    return groups
  }, [])

  const runNlSearch = async () => {
    const query = nlQuery.trim()
    if (!query) return
    setNlBusy(true)
    try {
      const res = await api.post('/submissions/nl-search/', { query })
      setNlMeta({
        explanation: res.data.explanation,
        disclaimer: res.data.disclaimer,
        filters: res.data.filters,
        count: res.data.count,
      })
      setNlIdSet(new Set(res.data.submission_ids || []))
      setPage(1)
    } catch (err) {
      const d = err.response?.data
      setNlMeta({ error: typeof d?.detail === 'string' ? d.detail : 'Smart search failed.' })
      setNlIdSet(null)
    } finally {
      setNlBusy(false)
    }
  }

  const clearNlSearch = () => {
    setNlQuery('')
    setNlMeta(null)
    setNlIdSet(null)
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter(r => {
      if (nlIdSet && !nlIdSet.has(r.id)) return false
      if (stageFilter && r.current_stage !== stageFilter) return false
      if (ministryFilter && r.ministry_name !== ministryFilter) return false
      if (s && !(
        (r.reference_number && r.reference_number.toLowerCase().includes(s)) ||
        (r.title && r.title.toLowerCase().includes(s)) ||
        (r.ministry_name && r.ministry_name.toLowerCase().includes(s))
      )) return false
      return true
    })
  }, [rows, q, stageFilter, ministryFilter, nlIdSet])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage   = Math.min(page, totalPages)
  const paged      = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)
  const changePage = (p) => setPage(Math.max(1, Math.min(totalPages, p)))

  useEffect(() => { setSelected(new Set()) }, [q, stageFilter, ministryFilter])

  const toggleAll = () => setSelected(prev =>
    paged.every(r => prev.has(r.id)) ? new Set() : new Set(paged.map(r => r.id))
  )

  const toggleOne = id => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleBulkDelete = async () => {
    const count = selected.size
    const ok = await confirm({
      title: `Delete ${count} Submission${count !== 1 ? 's' : ''}`,
      message: `Permanently delete ${count} selected submission${count !== 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    const ids = [...selected]
    await Promise.all(ids.map(id => api.delete(`/submissions/${id}/`).catch(() => {})))
    setRows(prev => prev.filter(r => !selected.has(r.id)))
    setSelected(new Set())
  }

  const handleBulkAction = async (action, extra = {}) => {
    const ids = [...selected]
    try {
      const res = await api.post('/submissions/bulk-action/', { action, ids, ...extra })
      toast.success(res.data?.detail || 'Bulk action completed.')
      if (action === 'export_list' && res.data?.submissions) {
        const blob = new Blob([JSON.stringify(res.data.submissions, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'submissions-export.json'; a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Bulk action failed.')
    }
  }

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: 'Delete Submission',
      message: `Delete ${row.reference_number}? This cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await api.delete(`/submissions/${row.id}/`)
      setRows(prev => prev.filter(r => r.id !== row.id))
    } catch { /* handled by api interceptor */ }
  }

  const cols = (isAdmin ? 6 : 4) + (showQualityColumn ? 1 : 0)

  return (
    <div>
      <PageHeader
        title={t('submission.list_title')}
        subtitle={t('submission.list_subtitle')}
        action={
          canCreateSubmission ? (
            <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
              <PlusCircle size={16} />
              {t('submission.new_submission')}
            </button>
          ) : null
        }
      />

      {isComplianceUser && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100">
          Create and approve cases in <strong>CMS</strong> (COMP-* types). After sync, linked records appear here
          for Secretary / Commission tracking. Post-decision tasks stay in <strong>SCDMS</strong>; the CMS case
          closes automatically when the portal matter is fully complete.
        </div>
      )}

      {loadError && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          {loadError}
        </div>
      )}

      <div className="card overflow-hidden">
        {/* ── Toolbar ── */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <LayoutList size={15} />
            {t('submission.view_list')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'kanban'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Columns3 size={15} />
            {t('submission.view_kanban')}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder={t('submission.filter_placeholder')}
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1) }}
              className="input pl-9 text-sm w-full"
            />
          </div>
          <select
            className="input text-sm sm:w-52"
            value={stageFilter}
            onChange={e => { setStageFilter(e.target.value); setPage(1) }}
          >
            <option value="">All stages</option>
            {Object.entries(stageGroups).map(([category, codes]) => (
              <optgroup key={category} label={category}>
                {codes.map(code => (
                  <option key={code} value={code}>{stageLabel(code, t)}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            className="input text-sm sm:w-48"
            value={ministryFilter}
            onChange={e => { setMinistryFilter(e.target.value); setPage(1) }}
          >
            <option value="">All ministries</option>
            {ministryOptions.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          {isAdmin && selected.size > 0 && (
            <>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="btn-danger text-sm inline-flex items-center gap-2 py-2 px-3 whitespace-nowrap"
              >
                <Trash2 size={14} />
                Delete {selected.size}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => loadRows()}
            disabled={loading}
            className="btn-outline text-sm inline-flex items-center gap-2 py-2 px-3 whitespace-nowrap"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('submission.reload')}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            className="input text-sm flex-1"
            placeholder='Smart search, e.g. "ODU restructures deferred in 2025"'
            value={nlQuery}
            onChange={e => setNlQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runNlSearch() } }}
          />
          <button
            type="button"
            onClick={runNlSearch}
            disabled={nlBusy || !nlQuery.trim()}
            className="btn-secondary text-sm inline-flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            {nlBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Smart search
          </button>
          {nlIdSet && (
            <button type="button" onClick={clearNlSearch} className="btn-outline text-sm shrink-0">
              Clear AI filter
            </button>
          )}
        </div>
        {nlMeta && (
          <div className={`text-xs rounded-lg px-3 py-2 ${nlMeta.error ? 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200' : 'bg-violet-50 text-violet-900 dark:bg-violet-950/30 dark:text-violet-100'}`}>
            {nlMeta.error ? nlMeta.error : (
              <>
                <span className="font-semibold">AI draft — verify filters.</span>{' '}
                {nlMeta.explanation}
                {nlMeta.count != null && ` (${nlMeta.count} match${nlMeta.count !== 1 ? 'es' : ''})`}
              </>
            )}
          </div>
        )}
        </div>

        {viewMode === 'kanban' && (
          <div className="p-4">
            {loading ? (
              <div className="py-16 text-center text-slate-400 dark:text-slate-500">
                <RefreshCw size={24} className="mx-auto mb-2 animate-spin opacity-40" />
                <p className="text-sm">{t('common.loading')}</p>
              </div>
            ) : (
              <SubmissionKanbanBoard
                submissions={filtered}
                showQualityColumn={showQualityColumn}
                onRefresh={loadRows}
              />
            )}
          </div>
        )}

        {viewMode === 'list' && (
        <>
        {/* ── Bulk Operations Bar ── */}
        {isAdmin && selected.size > 0 && (
          <div className="p-4 pb-0">
            <BulkOperationsBar
              selectedIds={[...selected]}
              onClear={() => setSelected(new Set())}
              onBulkAction={handleBulkAction}
            />
          </div>
        )}
        {/* ── Table ── */}
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                {isAdmin && (
                  <th className="w-10">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded"
                      checked={paged.length > 0 && paged.every(r => selected.has(r.id))}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                <th>{t('submission.reference_short')}</th>
                <th className="min-w-[220px]">{t('submission.title')}</th>
                <th>{t('submission.stage')}</th>
                {showQualityColumn && (
                  <th className="w-16">{t('submission.quality_column')}</th>
                )}
                <th>{t('submission.deadline_short')}</th>
                {isAdmin && <th className="sr-only">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={cols} className="py-16 text-center text-slate-400 dark:text-slate-500">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin opacity-40" />
                    <p className="text-sm">{t('common.loading')}</p>
                  </td>
                </tr>
              )}
              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={cols} className="py-16 text-center text-slate-400 dark:text-slate-500">
                    <FileText size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">{(q || stageFilter || ministryFilter) ? t('submission.no_matches') : t('submission.empty_state_title')}</p>
                  </td>
                </tr>
              )}
              {!loading && paged.map(r => (
                <>
                  {/* ── Parent row ── */}
                  <tr key={r.id} className={selected.has(r.id) ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}>
                    {isAdmin && (
                      <td>
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded"
                          checked={selected.has(r.id)}
                          onChange={() => toggleOne(r.id)}
                        />
                      </td>
                    )}
                    <td>
                      <Link
                        to={`/submissions/${r.id}`}
                        className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap"
                      >
                        {r.reference_number}
                      </Link>
                    </td>
                    <td className="max-w-md">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{r.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {[r.category_name, r.ministry_name].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </td>
                    <td className="min-w-[140px]">
                      <Badge variant={STAGE_VARIANT[r.current_stage] ?? 'secondary'} dot className="whitespace-nowrap">
                        {stageLabel(r.current_stage, t)}
                        {r.is_assessment_overdue && <span className="ml-1 text-red-500 font-bold">!</span>}
                      </Badge>
                      {r.current_stage !== 'draft' && (
                        <div className="mt-1.5 max-w-[140px]">
                          <SubmissionProgressBar currentStage={r.current_stage} compact />
                        </div>
                      )}
                    </td>
                    {showQualityColumn && (
                      <td>
                        <QualityScoreBadge submission={r} compact />
                      </td>
                    )}
                    <td>
                      {r.is_assessment_overdue ? (
                        <Badge variant="danger" className="whitespace-nowrap">{t('submission.overdue')}</Badge>
                      ) : (
                        <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <span>
                            {r.assessment_deadline_at
                              ? new Date(r.assessment_deadline_at).toLocaleDateString(localeForDates)
                              : '—'}
                          </span>
                          {r.received_at && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                              {t('submission.received_short')}{' '}
                              {new Date(r.received_at).toLocaleDateString(localeForDates)}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            title="View"
                            onClick={() => navigate(`/submissions/${r.id}`)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => navigate(`/submissions/${r.id}`)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => handleDelete(r)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  {/* ── Attached child submissions (indented) ── */}
                  {r.attached_submissions?.map(child => (
                    <tr key={`child-${child.id}`} className="bg-slate-50/60 dark:bg-slate-800/40">
                      {isAdmin && <td />}
                      <td>
                        <div className="flex items-center gap-1.5 pl-4">
                          <span className="text-slate-300 dark:text-slate-600 select-none">└</span>
                          <Link
                            to={`/submissions/${child.id}`}
                            className="font-mono text-xs font-semibold text-primary-500 dark:text-primary-400 hover:underline whitespace-nowrap"
                          >
                            {child.reference_number}
                          </Link>
                        </div>
                      </td>
                      <td className="max-w-md">
                        <p className="truncate text-xs text-slate-600 dark:text-slate-400 pl-1">
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 mr-1.5">JD attached</span>
                          {child.title}
                        </p>
                      </td>
                      <td>
                        <Badge variant={STAGE_VARIANT[child.current_stage] ?? 'secondary'} dot className="whitespace-nowrap text-xs">
                          {stageLabel(child.current_stage, t)}
                        </Badge>
                      </td>
                      {showQualityColumn && <td />}
                      <td colSpan={isAdmin ? 2 : 1} />
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {(safePage - 1) * PER_PAGE + 1}
              </span>
              {' – '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {Math.min(safePage * PER_PAGE, filtered.length)}
              </span>
              {' of '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{filtered.length}</span>
              {' submissions'}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => changePage(safePage - 1)}
                  disabled={safePage === 1}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = i + 1
                  if (totalPages > 5 && safePage > 3) p = safePage - 2 + i
                  if (p > totalPages) return null
                  return (
                    <button
                      key={p}
                      onClick={() => changePage(p)}
                      className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                        safePage === p
                          ? 'bg-primary-500 text-white'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
                <button
                  onClick={() => changePage(safePage + 1)}
                  disabled={safePage === totalPages}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
        </>
        )}
      </div>

      {/* ── New Submission modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('submission.new_submission')}
        subtitle={t('submission.new_submission_hint')}
        size="lg"
      >
        <SubmissionForm
          modal
          onClose={() => setModalOpen(false)}
          onSuccess={id => { setModalOpen(false); navigate(`/submissions/${id}`) }}
        />
      </Modal>
    </div>
  )
}

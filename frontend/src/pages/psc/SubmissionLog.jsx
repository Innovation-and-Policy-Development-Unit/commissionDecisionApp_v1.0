import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/shared/PageHeader'
import Modal from '../../components/shared/Modal'
import Badge from '../../components/shared/Badge'
import BaseButton from '../../components/shared/BaseButton'
import BaseInput from '../../components/shared/BaseInput'
import BaseSelect from '../../components/shared/BaseSelect'
import BaseCheckbox from '../../components/shared/BaseCheckbox'
import api from '../../api/client'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { queryClient } from '../../api/queryClient'
import { stageLabel, stageBadgeClass, STAGE_META } from '../../constants/stages'
import SubmissionProgressBar from '../../components/shared/SubmissionProgressBar'
import { PlusCircle, RefreshCw, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Eye, FileText, Sparkles, Loader2, LayoutList, Columns3 } from 'lucide-react'
import SubmissionKanbanBoard from '../../components/submissions/SubmissionKanbanBoard'
import SubmissionForm, { SUBMISSION_CREATE_ALLOWED_ROLES } from './SubmissionForm'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'
import { isComplianceRole } from '../../constants/compliance'
import { userIsOpscInternal } from '../../utils/opscAccess'
import BulkOperationsBar from '../../components/shared/BulkOperationsBar'
import { useToast } from '../../context/ToastContext'
import { QualityScoreBadge } from '../../components/submissions/SubmissionQualityScore'
import { normalizeListPayload } from '../../utils/listPayload'
import { useAgendaSections } from '../../hooks/useAgendaSections'
import { prefetchSubmissionDetail } from '../../utils/submissionBootstrap'

const PER_PAGE = 15
// Kanban groups every matching card by stage, so it fetches in one capped page
// rather than paginating. Mirrors the backend SubmissionPagination.max_page_size.
const KANBAN_CAP = 500

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
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { agendaSectionLabel } = useAgendaSections()
  const confirm = useConfirm()
  const toast = useToast()

  // Dashboard quick-filter from ?filter= query param
  const [dashboardFilter, setDashboardFilter] = useState(() => searchParams.get('filter') || '')

  const [q, setQ]                 = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [ministryFilter, setMinistryFilter] = useState('')
  const [page, setPage]           = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  /** @type {'commission'|'secretary'|null} */
  const [modalCreateMode, setModalCreateMode] = useState(null)
  const [selected, setSelected]   = useState(new Set())
  const [nlQuery, setNlQuery]     = useState('')
  const [nlBusy, setNlBusy]       = useState(false)
  const [nlMeta, setNlMeta]       = useState(null)
  const [nlIdSet, setNlIdSet]     = useState(null)
  const [viewMode, setViewMode]   = useState('list')
  const isAdmin = user?.role === 'psc_admin'
  // Same role set the backend's DELETE /submissions/{id}/ already allows to
  // trash their own Draft submissions (views.py SubmissionViewSet.destroy) —
  // the list here only needed a matching frontend affordance.
  const canDeleteDrafts = user && ['ministry_hr', 'dept_admin', 'head_of_agency'].includes(user.role)
  const showActionsColumn = isAdmin || canDeleteDrafts
  const isComplianceUser = user && isComplianceRole(user.role)
  // Also require the role to be one SubmissionForm.jsx actually accepts —
  // otherwise roles outside that list (e.g. senior_admin_officer, psc_commissioner)
  // would see a button that just opens the modal to a permission-denied message.
  const canCreateSubmission = user
    && (!isComplianceUser || user.role === 'compliance_manager')
    && SUBMISSION_CREATE_ALLOWED_ROLES.includes(user.role)
  const isTraveller = user?.role === 'traveller'
  const isInternalCreate = user && user.role === 'csu_manager'
  const showCommissionCreate = canCreateSubmission && !isTraveller && !isInternalCreate
  const showInternalCreate = canCreateSubmission && isInternalCreate

  const warmSubmission = useCallback(submissionId => {
    prefetchSubmissionDetail(submissionId)
  }, [])

  const openCreateModal = mode => {
    setModalCreateMode(mode)
    setModalOpen(true)
  }
  const closeCreateModal = () => {
    setModalOpen(false)
    setModalCreateMode(null)
  }
  const showQualityColumn = user && [
    'psc_officer', 'psc_admin', 'psc_secretary', 'senior_admin_officer', 'psc_manager',
    'odu_manager', 'hr_unit_manager', 'vipam_manager', 'compliance_manager',
    'compliance_senior', 'compliance_principal',
  ].includes(user.role)
  // Who a submission is currently allocated to — internal OPSC staffing
  // detail, never shown to ministry-side viewers (API strips it for them too).
  const showAssignedColumn = userIsOpscInternal(user)

  const localeForDates = useMemo(() => {
    const map = { en: 'en-GB', fr: 'fr-FR', bi: 'en-GB' }
    return map[i18n.resolvedLanguage] || map[i18n.language] || 'en-GB'
  }, [i18n.resolvedLanguage, i18n.language])

  // Debounce the free-text search before it hits the server query.
  useEffect(() => {
    const id = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(id)
  }, [q])

  // Server-side filter params shared by the list and kanban queries.
  const filterParams = useMemo(() => {
    const p = {}
    if (qDebounced) p.search = qDebounced
    if (stageFilter) p.current_stage = stageFilter
    if (ministryFilter) p.ministry = ministryFilter
    if (dashboardFilter && dashboardFilter !== 'all') p.dashboard = dashboardFilter
    if (nlIdSet) p.ids = [...nlIdSet].join(',')
    return p
  }, [qDebounced, stageFilter, ministryFilter, dashboardFilter, nlIdSet])

  // The api client unwraps DRF pagination to a bare array (r.data) and exposes
  // the total on r.pagination.count — normalise both into { results, count }.
  const toPage = r => ({ results: Array.isArray(r.data) ? r.data : [], count: r.pagination?.count ?? (Array.isArray(r.data) ? r.data.length : 0) })

  // ── List query (server-paginated, stale-while-revalidate) ───────────────────
  const listQuery = useQuery({
    queryKey: ['submissions', 'list', { page, ...filterParams }],
    queryFn: () =>
      api.get('/submissions/', { params: { page, page_size: PER_PAGE, ...filterParams } })
        .then(toPage),
    placeholderData: keepPreviousData,
    enabled: viewMode === 'list',
  })

  // ── Kanban query (capped bulk fetch, grouped client-side) ───────────────────
  const kanbanQuery = useQuery({
    queryKey: ['submissions', 'kanban', filterParams],
    queryFn: () =>
      api.get('/submissions/', { params: { page_size: KANBAN_CAP, ...filterParams } })
        .then(toPage),
    placeholderData: keepPreviousData,
    enabled: viewMode === 'kanban',
  })

  // ── Ministry filter options (can't be derived from one page any more) ───────
  const ministriesQuery = useQuery({
    queryKey: ['ministries', 'options'],
    queryFn: () => api.get('/ministries/').then(r => normalizeListPayload(r.data)),
    staleTime: 5 * 60_000,
  })

  const rows = listQuery.data?.results ?? []
  const totalCount = listQuery.data?.count ?? 0
  const kanbanRows = kanbanQuery.data?.results ?? []
  const kanbanCount = kanbanQuery.data?.count ?? 0

  const loading = viewMode === 'list' ? listQuery.isLoading : kanbanQuery.isLoading
  const refreshing = listQuery.isFetching || kanbanQuery.isFetching
  const activeError = listQuery.error || kanbanQuery.error
  const loadError = activeError
    ? (activeError?.response?.data?.detail || t('submission.load_error_default'))
    : ''

  const ministryOptions = useMemo(
    () => [...new Set((ministriesQuery.data ?? []).map(m => m.name).filter(Boolean))].sort(),
    [ministriesQuery.data],
  )

  // Invalidate every submissions query (list + kanban) after a mutation/refresh.
  const refetchSubmissions = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['submissions'] }),
    [],
  )

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

  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE))
  const safePage   = Math.min(page, totalPages)
  const changePage = (p) => setPage(Math.max(1, Math.min(totalPages, p)))

  // Reset to page 1 (and clear selection) whenever the active filters change.
  useEffect(() => {
    setSelected(new Set())
    setPage(1)
  }, [qDebounced, stageFilter, ministryFilter, dashboardFilter, nlIdSet])

  // Clamp the page if a delete/filter shrinks the result set below it.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const toggleAll = () => setSelected(prev =>
    rows.length > 0 && rows.every(r => prev.has(r.id)) ? new Set() : new Set(rows.map(r => r.id))
  )

  const toggleOne = id => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleBulkDelete = async () => {
    const count = selected.size
    const ok = await confirm({
      title: `Move ${count} Submission${count !== 1 ? 's' : ''} to Trash`,
      message: `Move ${count} selected submission${count !== 1 ? 's' : ''} to the trash bin? Nothing is destroyed — PSC Admin can restore from Admin → Trash Bin.`,
      confirmLabel: 'Move to trash',
    })
    if (!ok) return
    const ids = [...selected]
    await Promise.all(ids.map(id => api.delete(`/submissions/${id}/`).catch(() => {})))
    setSelected(new Set())
    refetchSubmissions()
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
      if (action !== 'export_list') refetchSubmissions()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Bulk action failed.')
    }
  }

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: 'Move to Trash',
      message: `Move ${row.reference_number} to the trash bin? Nothing is destroyed — PSC Admin can restore it from Admin → Trash Bin.`,
      confirmLabel: 'Move to trash',
    })
    if (!ok) return
    try {
      await api.delete(`/submissions/${row.id}/`)
      refetchSubmissions()
    } catch { /* handled by api interceptor */ }
  }

  const cols = (isAdmin ? 1 : 0) + 4 + (showActionsColumn ? 1 : 0) + (showQualityColumn ? 1 : 0) + (showAssignedColumn ? 1 : 0)

  return (
    <div>
      <PageHeader
        title={t('submission.list_title')}
        subtitle={t('submission.list_subtitle')}
        action={
          canCreateSubmission ? (
            <div className="flex flex-wrap items-center gap-2">
              {showCommissionCreate && (
                <BaseButton
                  variant="primary"
                  icon={<PlusCircle size={16} />}
                  onClick={() => openCreateModal('commission')}
                >
                  {t('submission.submit_for_commission')}
                </BaseButton>
              )}
              {showInternalCreate && (
                <BaseButton
                  variant="primary"
                  icon={<PlusCircle size={16} />}
                  onClick={() => openCreateModal(null)}
                >
                  {t('submission.internal_submission')}
                </BaseButton>
              )}
            </div>
          ) : null
        }
      />

      {dashboardFilter && dashboardFilter !== 'all' && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
          <span>
            Showing:{' '}
            <strong>
              {dashboardFilter === 'active' && 'Active / Pending submissions'}
              {dashboardFilter === 'this_week' && 'Submissions from the last 7 days'}
              {dashboardFilter === 'this_month' && 'Submissions from the last 30 days'}
              {dashboardFilter === 'overdue' && 'Overdue submissions (>30 days)'}
            </strong>
          </span>
          <BaseButton
            variant="ghost"
            size="sm"
            className="ml-4"
            onClick={() => { setDashboardFilter(''); setSearchParams({}) }}
          >
            Clear filter
          </BaseButton>
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
          <BaseButton
            variant={viewMode === 'list' ? 'primary' : 'ghost'}
            size="sm"
            icon={<LayoutList size={15} />}
            onClick={() => setViewMode('list')}
          >
            {t('submission.view_list')}
          </BaseButton>
          <BaseButton
            variant={viewMode === 'kanban' ? 'primary' : 'ghost'}
            size="sm"
            icon={<Columns3 size={15} />}
            onClick={() => setViewMode('kanban')}
          >
            {t('submission.view_kanban')}
          </BaseButton>
        </div>
        {/* Filters arranged in columns (stack only on small screens) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:items-end">
          <BaseInput
            hideLabel
            label={t('submission.filter_placeholder')}
            type="search"
            className="lg:col-span-5"
            placeholder={t('submission.filter_placeholder')}
            value={q}
            onChange={e => setQ(e.target.value)}
            contentBefore={<Search size={15} className="text-slate-400" />}
          />
          <BaseSelect
            hideLabel
            label="Stage"
            className="lg:col-span-3"
            placeholder="All stages"
            value={stageFilter}
            options={[
              // Unit managers/principals/seniors get a narrowed default list
              // (stages still in their unit's court) when no stage is picked —
              // this is the explicit escape hatch back to everything, including
              // submissions they've already forwarded on.
              { value: '__all__', label: 'All statuses (incl. forwarded on)' },
              ...Object.entries(stageGroups).flatMap(([, codes]) =>
                codes.map(code => ({ value: code, label: stageLabel(code, t) }))
              ),
            ]}
            onChange={(_, v) => { setStageFilter(v); setPage(1) }}
          />
          <BaseSelect
            hideLabel
            label="Ministry"
            className="lg:col-span-2"
            value={ministryFilter}
            placeholder="All ministries"
            options={ministryOptions}
            onChange={(_, value) => { setMinistryFilter(value); setPage(1) }}
          />
          <div className="lg:col-span-2 flex gap-2">
            {isAdmin && selected.size > 0 && (
              <BaseButton
                variant="danger"
                icon={<Trash2 size={14} />}
                onClick={handleBulkDelete}
                className="whitespace-nowrap"
              >
                Delete {selected.size}
              </BaseButton>
            )}
            <BaseButton
              variant="outline"
              onClick={() => refetchSubmissions()}
              disabled={refreshing}
              icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
              className="flex-1 justify-center whitespace-nowrap"
            >
              {t('submission.reload')}
            </BaseButton>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <BaseInput
            hideLabel
            label="Smart search"
            type="text"
            className="flex-1"
            placeholder='Smart search, e.g. "ODU restructures deferred in 2025"'
            value={nlQuery}
            onChange={e => setNlQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runNlSearch() } }}
          />
          <BaseButton
            variant="secondary"
            onClick={runNlSearch}
            loading={nlBusy}
            loadingLabel="Searching"
            disabled={!nlQuery.trim()}
            icon={!nlBusy ? <Sparkles size={14} /> : undefined}
            className="shrink-0"
          >
            Smart search
          </BaseButton>
          {nlIdSet && (
            <BaseButton variant="outline" onClick={clearNlSearch} className="shrink-0">
              Clear AI filter
            </BaseButton>
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
              <>
                {kanbanCount > KANBAN_CAP && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                    {t('submission.kanban_cap_notice', {
                      shown: KANBAN_CAP,
                      total: kanbanCount,
                      defaultValue: `Showing the first ${KANBAN_CAP} of ${kanbanCount} matching submissions. Use filters to narrow the board.`,
                    })}
                  </div>
                )}
                <SubmissionKanbanBoard
                  submissions={kanbanRows}
                  showQualityColumn={showQualityColumn}
                  onRefresh={refetchSubmissions}
                />
              </>
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
                    <BaseCheckbox
                      checked={rows.length > 0 && rows.every(r => selected.has(r.id))}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                <th>{t('submission.reference_short')}</th>
                <th className="min-w-[220px]">{t('submission.title')}</th>
                <th>{t('submission.stage')}</th>
                {showAssignedColumn && (
                  <th>{t('submission.assigned_to', { defaultValue: 'With' })}</th>
                )}
                {showQualityColumn && (
                  <th className="w-16">{t('submission.quality_column')}</th>
                )}
                <th>{t('submission.deadline_short')}</th>
                {showActionsColumn && <th className="sr-only">Actions</th>}
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
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={cols} className="py-16 text-center text-slate-400 dark:text-slate-500">
                    <FileText size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">{(q || stageFilter || ministryFilter || dashboardFilter || nlIdSet) ? t('submission.no_matches') : t('submission.empty_state_title')}</p>
                  </td>
                </tr>
              )}
              {!loading && rows.map(r => (
                <>
                  {/* ── Parent row ── */}
                  <tr key={r.id} className={selected.has(r.id) ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}>
                    {isAdmin && (
                      <td>
                        <BaseCheckbox
                          checked={selected.has(r.id)}
                          onChange={() => toggleOne(r.id)}
                        />
                      </td>
                    )}
                    <td>
                      <Link
                        to={`/submissions/${r.id}`}
                        className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap"
                        onMouseEnter={() => warmSubmission(r.id)}
                        onFocus={() => warmSubmission(r.id)}
                      >
                        {r.reference_number}
                      </Link>
                    </td>
                    <td className="max-w-md">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{r.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {[
                          (r.form_agenda_category || r.agenda_category)
                            ? agendaSectionLabel(r.form_agenda_category || r.agenda_category).replace(/^\d+\.\s*/, '')
                            : null,
                          r.ministry_name,
                        ].filter(Boolean).join(' · ') || '—'}
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
                    {showAssignedColumn && (
                      <td className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {r.allocated_to_label || <span className="text-slate-400 dark:text-slate-500">Unassigned</span>}
                      </td>
                    )}
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
                    {showActionsColumn && (
                      <td>
                        <div className="flex items-center gap-0.5">
                          {isAdmin && (
                            <>
                              <BaseButton
                                variant="ghost" size="icon" iconOnly
                                aria-label="View"
                                title="View"
                                onMouseEnter={() => warmSubmission(r.id)}
                                onFocus={() => warmSubmission(r.id)}
                                onClick={() => navigate(`/submissions/${r.id}`)}
                                icon={<Eye size={13} />}
                              />
                              <BaseButton
                                variant="ghost" size="icon" iconOnly
                                aria-label="Edit"
                                title="Edit"
                                onClick={() => navigate(`/submissions/${r.id}`)}
                                icon={<Pencil size={13} />}
                              />
                            </>
                          )}
                          {/* Ministry roles may only trash their own Draft
                              submissions — matches the backend check in
                              SubmissionViewSet.destroy(). */}
                          {(isAdmin || (canDeleteDrafts && r.current_stage === 'draft')) && (
                            <BaseButton
                              variant="ghost" size="icon" iconOnly
                              aria-label="Delete"
                              title="Delete"
                              onClick={() => handleDelete(r)}
                              icon={<Trash2 size={13} />}
                            />
                          )}
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
                            onMouseEnter={() => warmSubmission(child.id)}
                            onFocus={() => warmSubmission(child.id)}
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
                      {showAssignedColumn && <td />}
                      {showQualityColumn && <td />}
                      <td colSpan={showActionsColumn ? 2 : 1} />
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!loading && totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {(safePage - 1) * PER_PAGE + 1}
              </span>
              {' – '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {Math.min(safePage * PER_PAGE, totalCount)}
              </span>
              {' of '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{totalCount}</span>
              {' submissions'}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <BaseButton
                  variant="ghost" size="icon" iconOnly
                  aria-label="Previous page"
                  onClick={() => changePage(safePage - 1)}
                  disabled={safePage === 1}
                  icon={<ChevronLeft size={16} />}
                />
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = i + 1
                  if (totalPages > 5 && safePage > 3) p = safePage - 2 + i
                  if (p > totalPages) return null
                  return (
                    <BaseButton
                      key={p}
                      variant={safePage === p ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => changePage(p)}
                      className="!min-w-8"
                    >
                      {p}
                    </BaseButton>
                  )
                })}
                <BaseButton
                  variant="ghost" size="icon" iconOnly
                  aria-label="Next page"
                  onClick={() => changePage(safePage + 1)}
                  disabled={safePage === totalPages}
                  icon={<ChevronRight size={16} />}
                />
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
        onClose={closeCreateModal}
        title={
          modalCreateMode === 'commission'
              ? t('submission.submit_for_commission')
              : t('submission.internal_submission')
        }
        subtitle={modalCreateMode !== 'commission' ? t('submission.internal_submission_hint') : undefined}
        size="lg"
      >
        <SubmissionForm
          modal
          createMode={modalCreateMode}
          onClose={closeCreateModal}
          onSuccess={id => { closeCreateModal(); navigate(`/submissions/${id}`) }}
        />
      </Modal>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/shared/PageHeader'
import Badge from '../../components/shared/Badge'
import api from '../../api/client'
import { stageLabel, stageBadgeClass, STAGE_META } from '../../constants/stages'
import SubmissionProgressBar from '../../components/shared/SubmissionProgressBar'
import { PlusCircle, RefreshCw, X, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Eye, FileText } from 'lucide-react'
import SubmissionForm from './SubmissionForm'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/ConfirmContext'

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

  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState('')
  const [q, setQ]                 = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [ministryFilter, setMinistryFilter] = useState('')
  const [page, setPage]           = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected]   = useState(new Set())

  const isAdmin = user?.role === 'psc_admin'

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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter(r => {
      if (stageFilter && r.current_stage !== stageFilter) return false
      if (ministryFilter && r.ministry_name !== ministryFilter) return false
      if (s && !(
        (r.reference_number && r.reference_number.toLowerCase().includes(s)) ||
        (r.title && r.title.toLowerCase().includes(s)) ||
        (r.ministry_name && r.ministry_name.toLowerCase().includes(s))
      )) return false
      return true
    })
  }, [rows, q, stageFilter, ministryFilter])

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

  const cols = isAdmin ? 9 : 7

  return (
    <div>
      <PageHeader
        title={t('submission.list_title')}
        subtitle={t('submission.list_subtitle')}
        action={
          <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
            <PlusCircle size={16} />
            {t('submission.new_submission')}
          </button>
        }
      />

      {loadError && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          {loadError}
        </div>
      )}

      <div className="card overflow-hidden">
        {/* ── Toolbar ── */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-3">
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
            <button
              type="button"
              onClick={handleBulkDelete}
              className="btn-danger text-sm inline-flex items-center gap-2 py-2 px-3 whitespace-nowrap"
            >
              <Trash2 size={14} />
              Delete {selected.size}
            </button>
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
                <th>{t('submission.title')}</th>
                <th>{t('submission.ministry')}</th>
                <th>{t('submission.progress')}</th>
                <th>{t('submission.stage')}</th>
                <th>{t('submission.received_at')}</th>
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
                  <td className="max-w-xs">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{r.title}</p>
                    {r.category_name && (
                      <p className="text-xs text-slate-400 truncate">{r.category_name}</p>
                    )}
                  </td>
                  <td>
                    <span className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{r.ministry_name}</span>
                  </td>
                  <td className="min-w-[90px]">
                    {r.current_stage !== 'draft' && (
                      <SubmissionProgressBar currentStage={r.current_stage} compact />
                    )}
                  </td>
                  <td>
                    <Badge variant={STAGE_VARIANT[r.current_stage] ?? 'secondary'} dot className="whitespace-nowrap">
                      {stageLabel(r.current_stage, t)}
                      {r.is_assessment_overdue && <span className="ml-1 text-red-500 font-bold">!</span>}
                    </Badge>
                  </td>
                  <td>
                    <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {r.received_at ? new Date(r.received_at).toLocaleDateString(localeForDates) : '—'}
                    </span>
                  </td>
                  <td>
                    {r.is_assessment_overdue ? (
                      <Badge variant="danger" className="whitespace-nowrap">{t('submission.overdue')}</Badge>
                    ) : (
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {r.assessment_deadline_at
                          ? new Date(r.assessment_deadline_at).toLocaleDateString(localeForDates)
                          : '—'}
                      </span>
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
      </div>

      {/* ── New Submission modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('submission.new_submission')}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('submission.new_submission_hint')}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-6">
              <SubmissionForm
                modal
                onClose={() => setModalOpen(false)}
                onSuccess={id => { setModalOpen(false); navigate(`/submissions/${id}`) }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

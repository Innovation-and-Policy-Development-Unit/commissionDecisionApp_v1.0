import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/shared/PageHeader'
import BaseButton from '../../components/shared/BaseButton'
import BaseInput from '../../components/shared/BaseInput'
import BaseSelect from '../../components/shared/BaseSelect'
import {
  Plus, X, Gavel, CheckCircle2, XCircle, RotateCcw, Clock, FileText, RefreshCw,
  ChevronLeft, ChevronRight, ShieldCheck, PenLine, ClipboardCheck, Hourglass, FileCheck2, Download,
} from 'lucide-react'
import api from '../../api/client'

const PER_PAGE = 15

// ── Reference data (labels resolved at render time via t()) ──────────────────

const DECISION_TYPES = [
  { value: 'approved', i18nKey: 'secretariat.outcome_approved', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', icon: CheckCircle2 },
  { value: 'rejected', i18nKey: 'secretariat.outcome_rejected', cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',                  icon: XCircle      },
  { value: 'deferred', i18nKey: 'secretariat.outcome_deferred', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',          icon: Clock        },
  { value: 'returned', i18nKey: 'secretariat.outcome_returned', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',      icon: RotateCcw    },
]

const TYPE_MAP = Object.fromEntries(DECISION_TYPES.map(t => [t.value, t]))

// Post-decision processing status — distinct from the outcome (approved/rejected/…) above.
// The four outcome stages sit at "pending_entry" until the register/implementation pipeline moves them along.
const STATUS_STAGE_MAP = {
  approved: 'pending_entry',
  rejected: 'pending_entry',
  deferred: 'pending_entry',
  returned: 'pending_entry',
  minutes_drafted_signed: 'minutes_drafted_signed',
  decision_entered_assigned: 'decision_entered_assigned',
  under_implementation: 'under_implementation',
  implementation_report: 'implementation_report',
}

const STATUS_TYPES = [
  { value: 'pending_entry',              i18nKey: 'secretariat.status_pending_entry',              cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',   icon: Hourglass      },
  { value: 'minutes_drafted_signed',     i18nKey: 'secretariat.status_minutes_drafted',             cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',           icon: PenLine        },
  { value: 'decision_entered_assigned',  i18nKey: 'secretariat.status_entered_assigned',            cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', icon: ClipboardCheck },
  { value: 'under_implementation',       i18nKey: 'secretariat.status_under_implementation',        cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', icon: RefreshCw      },
  { value: 'implementation_report',      i18nKey: 'secretariat.status_implementation_report',       cls: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',       icon: FileCheck2     },
]

const STATUS_MAP = Object.fromEntries(STATUS_TYPES.map(s => [s.value, s]))

const LOCALE_MAP = { en: 'en-GB', fr: 'fr-FR', bi: 'en-GB' }

function csvEscape(value) {
  const s = String(value ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// ── Components ──────────────────────────────────────────────────────────────

function DecisionBadge({ decision }) {
  const { t } = useTranslation()
  const meta = TYPE_MAP[decision]
  if (!meta) return <span className="text-xs text-slate-400 capitalize">{decision.replace(/_/g, ' ')}</span>
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>
      <Icon size={12} aria-hidden="true" />
      {t(meta.i18nKey)}
    </span>
  )
}

function StatusBadge({ decision }) {
  const { t } = useTranslation()
  const meta = STATUS_MAP[STATUS_STAGE_MAP[decision]]
  if (!meta) return <span className="text-xs text-slate-400">—</span>
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>
      <Icon size={12} aria-hidden="true" />
      {t(meta.i18nKey)}
    </span>
  )
}

function SummaryBar({ submissions }) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {DECISION_TYPES.map(({ value, i18nKey, cls, icon: Icon }) => {
        const count = submissions.filter(s => s.current_stage === value).length
        return (
          <div key={value} className="card px-3 py-2.5 flex items-center gap-3">
            <Icon size={18} className={`shrink-0 ${cls.split(' ')[1]}`} aria-hidden="true" />
            <div>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-none">{count}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t(i18nKey)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────

export default function Decisions() {
  const { t, i18n } = useTranslation()
  const locale = LOCALE_MAP[i18n.resolvedLanguage] || LOCALE_MAP[i18n.language] || 'en-GB'
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [ministryFilter, setMinistryFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [meetingFilter, setMeetingFilter] = useState('')
  const [page, setPage] = useState(1)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await api.get('/submissions/?page_size=500')
      const decisionStages = ['approved', 'rejected', 'deferred', 'returned', 'minutes_drafted_signed', 'decision_entered_assigned', 'under_implementation', 'implementation_report']
      const list = Array.isArray(res.data) ? res.data : (res.data.results || [])
      setSubmissions(list.filter(s => decisionStages.includes(s.current_stage)))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Department filter cascades off the selected Ministry — reset it if the ministry changes.
  useEffect(() => {
    setDepartmentFilter('')
  }, [ministryFilter])

  const ministryOptions = useMemo(
    () => [...new Set(submissions.map(s => s.ministry_name).filter(Boolean))].sort(),
    [submissions],
  )

  const departmentOptions = useMemo(() => {
    const pool = ministryFilter ? submissions.filter(s => s.ministry_name === ministryFilter) : submissions
    return [...new Set(pool.map(s => s.department_name).filter(Boolean))].sort()
  }, [submissions, ministryFilter])

  // "Year" = year of the record's last update (approval/rejection/etc. move the record, so this
  // tracks closely with when the decision was actually made — there's no separate decision-date field).
  const yearOptions = useMemo(
    () => [...new Set(submissions.map(s => s.updated_at && new Date(s.updated_at).getFullYear()).filter(Boolean))]
      .sort((a, b) => b - a)
      .map(String),
    [submissions],
  )

  const meetingOptions = useMemo(
    () => [...new Set(submissions.map(s => s.scheduled_meeting_reference).filter(Boolean))].sort().reverse(),
    [submissions],
  )

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return submissions.filter(d => {
      if (typeFilter && d.current_stage !== typeFilter) return false
      if (ministryFilter && d.ministry_name !== ministryFilter) return false
      if (departmentFilter && d.department_name !== departmentFilter) return false
      if (yearFilter && (!d.updated_at || String(new Date(d.updated_at).getFullYear()) !== yearFilter)) return false
      if (meetingFilter && d.scheduled_meeting_reference !== meetingFilter) return false
      if (s && !d.reference_number.toLowerCase().includes(s) && !d.title.toLowerCase().includes(s) && !d.ministry_name.toLowerCase().includes(s)) return false
      return true
    })
  }, [submissions, q, typeFilter, ministryFilter, departmentFilter, yearFilter, meetingFilter])

  const exportCsv = () => {
    const headers = [
      t('secretariat.submission_ref'), t('secretariat.title_subject'), t('submission.ministry'),
      t('submission.department'), t('secretariat.outcome_col'), t('secretariat.status_col'),
      t('secretariat.last_updated_col'),
    ]
    const rows = filtered.map(d => [
      d.reference_number,
      d.title,
      d.ministry_name,
      d.department_name || '',
      TYPE_MAP[d.current_stage] ? t(TYPE_MAP[d.current_stage].i18nKey) : d.current_stage,
      STATUS_MAP[STATUS_STAGE_MAP[d.current_stage]] ? t(STATUS_MAP[STATUS_STAGE_MAP[d.current_stage]].i18nKey) : '',
      d.updated_at ? new Date(d.updated_at).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `commission-decisions-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage   = Math.min(page, totalPages)
  const paged      = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)
  const changePage = p => setPage(Math.max(1, Math.min(totalPages, p)))

  return (
    <div>
      <PageHeader
        title={t('secretariat.decisions_title')}
        subtitle={t('secretariat.decisions_subtitle')}
      />

      <SummaryBar submissions={submissions} />

      {/* Filters */}
      <div className="card p-4 mb-4 space-y-2">
        {/* Row 1: search */}
        <BaseInput
          hideLabel
          label={t('common.search')}
          type="search"
          placeholder={t('secretariat.search_decisions_placeholder')}
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1) }}
        />
        {/* Row 2: outcome / ministry / department filters + refresh */}
        <div className="flex flex-wrap gap-2 items-center">
          <BaseSelect
            hideLabel
            label={t('secretariat.all_outcomes')}
            className="w-44"
            value={typeFilter}
            placeholder={t('secretariat.all_outcomes')}
            options={DECISION_TYPES.map(opt => ({ value: opt.value, label: t(opt.i18nKey) }))}
            onChange={(_, v) => { setTypeFilter(v); setPage(1) }}
          />
          <BaseSelect
            hideLabel
            label={t('submission.ministry')}
            className="w-44"
            value={ministryFilter}
            placeholder={t('secretariat.all_ministries')}
            options={ministryOptions}
            onChange={(_, v) => { setMinistryFilter(v); setPage(1) }}
          />
          <BaseSelect
            hideLabel
            label={t('submission.department')}
            className="w-44"
            value={departmentFilter}
            placeholder={t('secretariat.all_departments')}
            options={departmentOptions}
            onChange={(_, v) => { setDepartmentFilter(v); setPage(1) }}
          />
          <BaseSelect
            hideLabel
            label={t('secretariat.year_label')}
            className="w-32"
            value={yearFilter}
            placeholder={t('secretariat.all_years')}
            options={yearOptions}
            onChange={(_, v) => { setYearFilter(v); setPage(1) }}
          />
          <BaseSelect
            hideLabel
            label={t('secretariat.meeting_ref_label')}
            className="w-44"
            value={meetingFilter}
            placeholder={t('secretariat.meeting_ref_label')}
            options={meetingOptions}
            onChange={(_, v) => { setMeetingFilter(v); setPage(1) }}
          />
          <BaseButton
            variant="outline"
            size="sm"
            icon={<RefreshCw size={14} aria-hidden="true" className={loading ? 'animate-spin' : ''} />}
            onClick={fetchData}
            aria-label={t('submission.reload')}
          >
            {t('submission.reload')}
          </BaseButton>
          <BaseButton
            variant="outline"
            size="sm"
            icon={<Download size={14} aria-hidden="true" />}
            onClick={exportCsv}
            disabled={!filtered.length}
            aria-label={t('secretariat.export_csv')}
          >
            {t('secretariat.export_csv')}
          </BaseButton>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('secretariat.submission_ref')}</th>
                <th>{t('secretariat.title_subject')}</th>
                <th>{t('submission.ministry')}</th>
                <th>{t('secretariat.outcome_col')}</th>
                <th>{t('secretariat.status_col')}</th>
                <th>{t('decision_proof.badge_label')}</th>
                <th>{t('secretariat.last_updated_col')}</th>
                <th className="text-end">{t('secretariat.details_col')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && !submissions.length ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <RefreshCw size={20} aria-hidden="true" className="animate-spin mx-auto mb-2" />
                    {t('secretariat.loading_decisions')}
                  </td>
                </tr>
              ) : paged.map(d => (
                <tr key={d.id}>
                  <td className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400">{d.reference_number}</td>
                  <td className="max-w-xs">
                    <p className="text-slate-800 dark:text-slate-200 leading-snug text-xs truncate">{d.title}</p>
                  </td>
                  <td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{d.ministry_name}</td>
                  <td><DecisionBadge decision={d.current_stage} /></td>
                  <td><StatusBadge decision={d.current_stage} /></td>
                  <td>
                    {['approved', 'rejected'].includes(d.current_stage) ? (
                      <Link
                        to={`/submissions/${d.id}#audit-trail`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                        title={t('decision_proof.popover_title')}
                      >
                        <ShieldCheck size={14} aria-hidden />
                        {t('decision_proof.badge_label')}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(d.updated_at).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="text-end">
                    <Link
                      to={`/submissions/${d.id}`}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {t('secretariat.view_full_file')}
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && !filtered.length && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    {t('secretariat.no_decisions_match')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > PER_PAGE && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{(safePage - 1) * PER_PAGE + 1}</span>
              {' – '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(safePage * PER_PAGE, filtered.length)}</span>
              {' of '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-1">
              <BaseButton variant="ghost" size="icon" iconOnly aria-label="Previous" onClick={() => changePage(safePage - 1)} disabled={safePage === 1} icon={<ChevronLeft size={16} />} />
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1
                if (totalPages > 5 && safePage > 3) p = safePage - 2 + i
                if (p > totalPages) return null
                return <BaseButton key={p} variant={safePage === p ? 'primary' : 'ghost'} size="sm" onClick={() => changePage(p)} className="!min-w-8">{p}</BaseButton>
              })}
              <BaseButton variant="ghost" size="icon" iconOnly aria-label="Next" onClick={() => changePage(safePage + 1)} disabled={safePage === totalPages} icon={<ChevronRight size={16} />} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/shared/PageHeader'
import BaseButton from '../../components/shared/BaseButton'
import BaseInput from '../../components/shared/BaseInput'
import BaseSelect from '../../components/shared/BaseSelect'
import {
  Plus, X, Gavel, CheckCircle2, XCircle, RotateCcw, Clock, FileText, RefreshCw,
  ChevronLeft, ChevronRight, ShieldCheck,
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

const LOCALE_MAP = { en: 'en-GB', fr: 'fr-FR', bi: 'en-GB' }

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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return submissions.filter(d => {
      if (typeFilter && d.current_stage !== typeFilter) return false
      if (s && !d.reference_number.toLowerCase().includes(s) && !d.title.toLowerCase().includes(s) && !d.ministry_name.toLowerCase().includes(s)) return false
      return true
    })
  }, [submissions, q, typeFilter])

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
        {/* Row 2: outcome filter + refresh */}
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
          <BaseButton
            variant="outline"
            size="sm"
            icon={<RefreshCw size={14} aria-hidden="true" className={loading ? 'animate-spin' : ''} />}
            onClick={fetchData}
            aria-label={t('submission.reload')}
          >
            {t('submission.reload')}
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
                <th>{t('decision_proof.badge_label')}</th>
                <th>{t('secretariat.last_updated_col')}</th>
                <th className="text-end">{t('secretariat.details_col')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && !submissions.length ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
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
                  <td colSpan={7} className="py-10 text-center text-slate-400">
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

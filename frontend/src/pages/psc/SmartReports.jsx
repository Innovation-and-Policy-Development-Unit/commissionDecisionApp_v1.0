import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Send, Library as LibraryIcon, Plus } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'
import { smartReportsApi } from '../../api/smartReports'
import { useToast } from '../../context/ToastContext'
import PageHeader from '../../components/shared/PageHeader'
import SmartReportCatalog from '../../components/reports/SmartReportCatalog'
import SmartReportLibrary from '../../components/reports/SmartReportLibrary'
import SmartReportViewer from '../../components/reports/SmartReportViewer'

export default function SmartReports() {
  const { t } = useTranslation()
  const toast = useToast()

  const [tab, setTab] = useState('new')
  const [catalog, setCatalog] = useState([])
  const [ministries, setMinistries] = useState([])
  const [categories, setCategories] = useState([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [activeReportId, setActiveReportId] = useState(null)
  const [libraryKey, setLibraryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      smartReportsApi.catalog(),
      api.get('/ministries/'),
      api.get('/form-categories/'),
    ]).then(([cat, min, fc]) => {
      if (cancelled) return
      if (cat.status === 'fulfilled') setCatalog(cat.value?.reports || [])
      if (min.status === 'fulfilled') setMinistries(min.value?.data?.results || min.value?.data || [])
      if (fc.status === 'fulfilled') setCategories(fc.value?.data?.results || fc.value?.data || [])
    })
    return () => { cancelled = true }
  }, [])

  const startReport = useCallback(async (payload) => {
    setBusy(true)
    try {
      const res = await smartReportsApi.create(payload)
      setActiveReportId(res.id)
      setLibraryKey(k => k + 1)
      setTab('new')
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.response?.data?.prompt || t('smart_reports.create_failed'))
    } finally {
      setBusy(false)
    }
  }, [t, toast])

  const handleGenerate = (report_type, params) => startReport({ report_type, params })

  const handleAdhoc = () => {
    if (!query.trim()) return
    startReport({ report_type: 'adhoc', prompt: query.trim() })
  }

  const handleRerun = async (id) => {
    setBusy(true)
    try {
      const res = await smartReportsApi.rerun(id)
      setActiveReportId(res.id)
      setLibraryKey(k => k + 1)
      setTab('new')
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('smart_reports.create_failed'))
    } finally {
      setBusy(false)
    }
  }

  const handleView = (id) => {
    setActiveReportId(id)
    setTab('new')
  }

  const TabButton = ({ id, icon: Icon, label }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={clsx(
        'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
        tab === id
          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200'
          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/50',
      )}
    >
      <Icon size={16} /> {label}
    </button>
  )

  return (
    <div className="max-w-screen-2xl mx-auto space-y-6 pb-10">
      <PageHeader title={t('smart_reports.title')} subtitle={t('smart_reports.subtitle')} />

      <div className="flex items-center gap-2">
        <TabButton id="new" icon={Plus} label={t('smart_reports.tab_new')} />
        <TabButton id="library" icon={LibraryIcon} label={t('smart_reports.tab_library')} />
      </div>

      {tab === 'new' && activeReportId && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setActiveReportId(null)}
            className="text-sm text-primary-600 hover:underline"
          >
            ← {t('smart_reports.new_report')}
          </button>
          <SmartReportViewer reportId={activeReportId} onRerun={handleRerun} />
        </div>
      )}

      {tab === 'new' && !activeReportId && (
        <div className="space-y-6">
          {/* Ad-hoc NL */}
          <div className="card p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary-500" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                {t('smart_reports.ask_title')}
              </h3>
            </div>
            <div className="flex gap-3">
              <input
                className="input flex-1"
                placeholder={t('smart_reports.ask_placeholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdhoc()}
              />
              <button className="btn-primary flex items-center gap-2" onClick={handleAdhoc} disabled={busy}>
                <Send size={16} /> {t('smart_reports.generate')}
              </button>
            </div>
            <p className="text-xs text-slate-400 italic">{t('smart_reports.ask_hint')}</p>
          </div>

          {/* Catalog */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">
              {t('smart_reports.catalog_title')}
            </h3>
            <SmartReportCatalog
              reports={catalog}
              ministries={ministries}
              categories={categories}
              busy={busy}
              onGenerate={handleGenerate}
            />
          </div>
        </div>
      )}

      {tab === 'library' && (
        <SmartReportLibrary refreshKey={libraryKey} onView={handleView} onRerun={handleRerun} />
      )}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Library as LibraryIcon, Plus, Settings2 } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'
import { reportTemplatesApi } from '../../api/reportTemplates'
import { smartReportsApi } from '../../api/smartReports'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/shared/PageHeader'
import SmartReportCatalog from '../../components/reports/SmartReportCatalog'
import SmartReportLibrary from '../../components/reports/SmartReportLibrary'
import SmartReportViewer from '../../components/reports/SmartReportViewer'

const MANAGER_ROLES = new Set(['psc_admin'])

export default function ReportBrowse() {
  const { t } = useTranslation()
  const toast = useToast()
  const { user } = useAuth()

  const [tab, setTab] = useState('generate')
  const [templates, setTemplates] = useState([])
  const [ministries, setMinistries] = useState([])
  const [categories, setCategories] = useState([])
  const [busy, setBusy] = useState(false)
  const [activeReportId, setActiveReportId] = useState(null)
  const [libraryKey, setLibraryKey] = useState(0)

  const canManage = user?.is_staff || user?.is_superuser || MANAGER_ROLES.has(user?.role)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      reportTemplatesApi.list(),
      api.get('/ministries/'),
      api.get('/form-categories/'),
    ]).then(([tpl, min, fc]) => {
      if (cancelled) return
      if (tpl.status === 'fulfilled') {
        // Map templates to the catalog-card shape.
        setTemplates((tpl.value || []).map(tt => ({
          key: tt.slug,
          title: tt.name,
          description: tt.description,
          params: tt.param_schema || [],
        })))
      }
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
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.response?.data?.template || t('report_hub.create_failed'))
    } finally {
      setBusy(false)
    }
  }, [t, toast])

  const handleGenerate = (slug, params) => startReport({ template: slug, params })

  const handleRerun = async (id) => {
    setBusy(true)
    try {
      const res = await smartReportsApi.rerun(id)
      setActiveReportId(res.id)
      setLibraryKey(k => k + 1)
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('report_hub.create_failed'))
    } finally {
      setBusy(false)
    }
  }

  const handleView = (id) => { setActiveReportId(id); setTab('generate') }

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
      <PageHeader title={t('report_hub.title')} subtitle={t('report_hub.subtitle')} />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TabButton id="generate" icon={Plus} label={t('report_hub.tab_generate')} />
          <TabButton id="library" icon={LibraryIcon} label={t('report_hub.tab_library')} />
        </div>
        {canManage && (
          <Link to="/reports/templates" className="btn-ghost text-sm flex items-center gap-1">
            <Settings2 size={16} /> {t('report_hub.manage_templates')}
          </Link>
        )}
      </div>

      {tab === 'generate' && activeReportId && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setActiveReportId(null)}
            className="text-sm text-primary-600 hover:underline"
          >
            ← {t('report_hub.back_to_templates')}
          </button>
          <SmartReportViewer reportId={activeReportId} onRerun={handleRerun} />
        </div>
      )}

      {tab === 'generate' && !activeReportId && (
        templates.length ? (
          <SmartReportCatalog
            reports={templates}
            ministries={ministries}
            categories={categories}
            busy={busy}
            onGenerate={handleGenerate}
          />
        ) : (
          <div className="card p-10 text-center text-slate-500 dark:text-slate-400">
            {t('report_hub.no_templates')}
          </div>
        )
      )}

      {tab === 'library' && (
        <SmartReportLibrary refreshKey={libraryKey} onView={handleView} onRerun={handleRerun} />
      )}
    </div>
  )
}

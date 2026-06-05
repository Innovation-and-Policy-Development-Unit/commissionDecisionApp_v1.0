import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, ArrowLeft, Loader2 } from 'lucide-react'
import { reportTemplatesApi } from '../../api/reportTemplates'
import { useToast } from '../../context/ToastContext'
import PageHeader from '../../components/shared/PageHeader'
import Badge from '../../components/shared/Badge'
import ReportTemplateForm from '../../components/reports/ReportTemplateForm'

export default function ReportTemplateManager() {
  const { t } = useTranslation()
  const toast = useToast()

  const [templates, setTemplates] = useState([])
  const [vocabulary, setVocabulary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('list') // list | create | edit
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, vocab] = await Promise.all([
        reportTemplatesApi.listManage(),
        reportTemplatesApi.vocabulary(),
      ])
      setTemplates(list)
      setVocabulary(vocab)
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('report_hub.load_failed'))
    } finally {
      setLoading(false)
    }
  }, [t, toast])

  useEffect(() => { load() }, [load])

  const handleSave = async (payload) => {
    setBusy(true)
    try {
      if (mode === 'edit' && editing) {
        await reportTemplatesApi.update(editing.slug, payload)
        toast.success(t('report_hub.template_saved'))
      } else {
        await reportTemplatesApi.create(payload)
        toast.success(t('report_hub.template_created'))
      }
      setMode('list'); setEditing(null)
      await load()
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('report_hub.save_failed'))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (tmpl) => {
    if (!window.confirm(t('report_hub.confirm_delete', { name: tmpl.name }))) return
    try {
      await reportTemplatesApi.remove(tmpl.slug)
      toast.success(t('report_hub.template_deleted'))
      await load()
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('report_hub.delete_failed'))
    }
  }

  if (mode !== 'list') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-10">
        <PageHeader
          title={mode === 'edit' ? t('report_hub.edit_template') : t('report_hub.new_template')}
          subtitle={t('report_hub.template_builder_hint')}
        />
        <button type="button" onClick={() => { setMode('list'); setEditing(null) }} className="text-sm text-primary-600 hover:underline flex items-center gap-1">
          <ArrowLeft size={15} /> {t('report_hub.back_to_list')}
        </button>
        <div className="card p-6">
          <ReportTemplateForm
            initial={editing}
            vocabulary={vocabulary}
            busy={busy}
            onSave={handleSave}
            onCancel={() => { setMode('list'); setEditing(null) }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-screen-xl mx-auto space-y-6 pb-10">
      <PageHeader title={t('report_hub.template_manager')} subtitle={t('report_hub.template_manager_hint')} />

      <div className="flex items-center justify-between">
        <Link to="/reports" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
          <ArrowLeft size={15} /> {t('report_hub.back_to_reports')}
        </Link>
        <button type="button" className="btn-primary flex items-center gap-1" onClick={() => { setEditing(null); setMode('create') }}>
          <Plus size={16} /> {t('report_hub.new_template')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="animate-spin" size={24} /></div>
      ) : !templates.length ? (
        <div className="card p-10 text-center text-slate-500 dark:text-slate-400">{t('report_hub.no_templates_manage')}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-2.5">{t('report_hub.col_name')}</th>
                <th className="px-4 py-2.5">{t('report_hub.col_visibility')}</th>
                <th className="px-4 py-2.5">{t('report_hub.col_state')}</th>
                <th className="px-4 py-2.5 text-right">{t('report_hub.col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(tmpl => (
                <tr key={tmpl.slug} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{tmpl.name}</div>
                    <div className="text-xs text-slate-500">{tmpl.description}</div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {tmpl.visible_to_all ? t('report_hub.all_staff') : (tmpl.visible_roles || []).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={tmpl.is_active ? 'success' : 'secondary'}>
                      {tmpl.is_active ? t('report_hub.active') : t('report_hub.inactive')}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" className="btn-ghost text-xs flex items-center gap-1" onClick={() => { setEditing(tmpl); setMode('edit') }}>
                        <Pencil size={15} /> {t('report_hub.edit')}
                      </button>
                      <button type="button" className="btn-ghost text-xs text-red-600 flex items-center gap-1" onClick={() => handleDelete(tmpl)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

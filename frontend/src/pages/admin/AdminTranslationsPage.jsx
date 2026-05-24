import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Languages,
  Plus,
  RefreshCw,
  Save,
  Search,
  RotateCcw,
  Download,
} from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import BaseMessageBar from '../../components/shared/BaseMessageBar'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { userCanManageTranslations } from '../../utils/adminAccess'
import { loadRemoteTranslationBundles } from '../../i18n/remoteTranslations'

const PAGE_SIZE = 50

function emptyRow() {
  return { key: '', text_en: '', text_fr: '', text_bi: '' }
}

export default function AdminTranslationsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [namespaces, setNamespaces] = useState([])
  const [namespace, setNamespace] = useState('')
  const [q, setQ] = useState('')
  const [dirty, setDirty] = useState({})
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newRow, setNewRow] = useState(emptyRow())
  const [error, setError] = useState('')
  const autoImportAttempted = useRef(false)

  useEffect(() => {
    if (user && !userCanManageTranslations(user)) navigate('/', { replace: true })
  }, [user, navigate])

  const fetchNamespaces = useCallback(async () => {
    try {
      const { data } = await api.get('/ui-translations/namespaces/')
      setNamespaces(Array.isArray(data) ? data : [])
    } catch {
      setNamespaces([])
    }
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
      if (namespace) params.set('namespace', namespace)
      if (q.trim()) params.set('q', q.trim())
      const { data } = await api.get(`/ui-translations/?${params}`)
      const list = Array.isArray(data) ? data : data.results || []
      setRows(list)
      setTotal(data.count ?? list.length)
      setDirty({})
    } catch (err) {
      setRows([])
      setError(err.response?.data?.detail || t('admin_translations.load_failed'))
    } finally {
      setLoading(false)
    }
  }, [page, namespace, q, t])

  useEffect(() => {
    fetchNamespaces()
  }, [fetchNamespaces])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  const updateCell = (id, field, value) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)))
    setDirty(prev => ({ ...prev, [id]: true }))
  }

  const saveDirty = async () => {
    const ids = Object.keys(dirty).filter(id => dirty[id])
    if (!ids.length) {
      toast.info(t('admin_translations.nothing_to_save'))
      return
    }
    setSaving(true)
    try {
      const items = rows.filter(r => dirty[r.id]).map(r => ({
        id: r.id,
        text_en: r.text_en,
        text_fr: r.text_fr,
        text_bi: r.text_bi,
      }))
      await api.post('/ui-translations/bulk-update/', { items })
      toast.success(t('admin_translations.saved', { count: items.length }))
      await fetchRows()
      await loadRemoteTranslationBundles()
    } catch (err) {
      toast.error(err.response?.data?.detail || t('admin_translations.save_failed'))
    } finally {
      setSaving(false)
    }
  }

  const syncFromFiles = async ({ skipConfirm = false } = {}) => {
    if (!skipConfirm) {
      const ok = await confirm({
        title: t('admin_translations.sync_title'),
        message: t('admin_translations.sync_message'),
        confirmLabel: t('admin_translations.sync_confirm'),
        cancelLabel: t('common.cancel'),
        variant: 'warning',
      })
      if (!ok) return
    }
    setSyncing(true)
    try {
      const { data } = await api.post('/ui-translations/sync-from-files/', { force: false })
      toast.success(
        t('admin_translations.sync_done', {
          created: data.created,
          updated: data.updated,
          skipped: data.skipped,
        }),
      )
      await fetchNamespaces()
      await fetchRows()
      await loadRemoteTranslationBundles()
      return true
    } catch (err) {
      toast.error(err.response?.data?.detail || t('admin_translations.sync_failed'))
      return false
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (loading || autoImportAttempted.current) return
    if (total > 0 || q.trim() || namespace) return
    autoImportAttempted.current = true
    syncFromFiles({ skipConfirm: true })
  }, [loading, total, q, namespace])

  const addKey = async (e) => {
    e.preventDefault()
    if (!newRow.key.trim()) return
    setSaving(true)
    try {
      await api.post('/ui-translations/', {
        key: newRow.key.trim(),
        text_en: newRow.text_en,
        text_fr: newRow.text_fr,
        text_bi: newRow.text_bi,
      })
      toast.success(t('admin_translations.key_added'))
      setShowAdd(false)
      setNewRow(emptyRow())
      await fetchNamespaces()
      await fetchRows()
      await loadRemoteTranslationBundles()
    } catch (err) {
      const detail = err.response?.data
      toast.error(
        typeof detail === 'string'
          ? detail
          : detail?.key?.[0] || detail?.detail || t('admin_translations.add_failed'),
      )
    } finally {
      setSaving(false)
    }
  }

  const dirtyCount = Object.values(dirty).filter(Boolean).length

  return (
    <div>
      <PageHeader
        title={t('admin_translations.title')}
        subtitle={t('admin_translations.subtitle')}
        actions={(
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-sm flex items-center gap-2"
              onClick={() => setShowAdd(true)}
            >
              <Plus size={16} aria-hidden="true" />
              {t('admin_translations.add_key')}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm flex items-center gap-2"
              onClick={() => syncFromFiles()}
              disabled={syncing}
            >
              <Download size={16} className={syncing ? 'animate-spin' : ''} aria-hidden="true" />
              {t('admin_translations.import_json')}
            </button>
            <button
              type="button"
              className="btn-primary text-sm flex items-center gap-2"
              onClick={saveDirty}
              disabled={saving || dirtyCount === 0}
            >
              <Save size={16} aria-hidden="true" />
              {t('admin_translations.save_changes', { count: dirtyCount })}
            </button>
          </div>
        )}
      />

      <div className="card p-4 mb-4 flex items-start gap-3 bg-primary-50/50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-900/30">
        <Languages className="text-primary-600 shrink-0 mt-0.5" size={20} aria-hidden="true" />
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {t('admin_translations.help')}
        </p>
      </div>

      {error && (
        <BaseMessageBar intent="error" className="mb-4">
          {error}
        </BaseMessageBar>
      )}

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              className="input ps-9 text-sm w-full"
              placeholder={t('admin_translations.search_placeholder')}
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1) }}
            />
          </div>
          <select
            className="input text-sm lg:w-48"
            value={namespace}
            onChange={e => { setNamespace(e.target.value); setPage(1) }}
          >
            <option value="">{t('admin_translations.all_namespaces')}</option>
            {namespaces.map(ns => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
          <button type="button" className="btn-outline text-sm flex items-center gap-2" onClick={fetchRows}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {t('common.refresh')}
          </button>
        </div>

        <div className="overflow-x-auto max-h-[calc(100vh-22rem)]">
          <table className="table w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
              <tr>
                <th className="min-w-[200px]">{t('admin_translations.col_key')}</th>
                <th className="min-w-[220px]">{t('admin_translations.col_english')}</th>
                <th className="min-w-[220px]">{t('admin_translations.col_french')}</th>
                <th className="min-w-[220px]">{t('admin_translations.col_bislama')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    {t('admin_translations.loading')}
                  </td>
                </tr>
              )}
              {!loading && rows.map(row => (
                <tr key={row.id} className={dirty[row.id] ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}>
                  <td className="align-top font-mono text-xs text-slate-600 dark:text-slate-400 break-all">
                    <div>{row.key}</div>
                    {row.is_customized && (
                      <span className="text-[10px] uppercase tracking-wide text-primary-600">
                        {t('admin_translations.customized')}
                      </span>
                    )}
                  </td>
                  <td className="align-top p-1">
                    <textarea
                      className="input text-xs min-h-[60px] w-full"
                      value={row.text_en ?? ''}
                      onChange={e => updateCell(row.id, 'text_en', e.target.value)}
                    />
                  </td>
                  <td className="align-top p-1">
                    <textarea
                      className="input text-xs min-h-[60px] w-full"
                      value={row.text_fr ?? ''}
                      onChange={e => updateCell(row.id, 'text_fr', e.target.value)}
                    />
                  </td>
                  <td className="align-top p-1">
                    <textarea
                      className="input text-xs min-h-[60px] w-full"
                      value={row.text_bi ?? ''}
                      onChange={e => updateCell(row.id, 'text_bi', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
              {!loading && !rows.length && (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <p className="text-slate-500 dark:text-slate-400 mb-4">
                      {syncing ? t('admin_translations.importing') : t('admin_translations.empty')}
                    </p>
                    {!syncing && (
                      <button
                        type="button"
                        className="btn-primary text-sm inline-flex items-center gap-2 mx-auto"
                        onClick={() => syncFromFiles()}
                      >
                        <Download size={16} aria-hidden="true" />
                        {t('admin_translations.import_json')}
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {t('admin_translations.pagination', { page, total: pageCount, count: total })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-outline text-xs px-3 py-1.5"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              {t('common.previous')}
            </button>
            <button
              type="button"
              className="btn-outline text-xs px-3 py-1.5"
              disabled={page >= pageCount}
              onClick={() => setPage(p => p + 1)}
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <form
            onSubmit={addKey}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t('admin_translations.add_key')}
            </h2>
            <div>
              <label className="block text-xs font-medium mb-1">{t('admin_translations.col_key')}</label>
              <input
                className="input w-full font-mono text-sm"
                placeholder="e.g. secretariat.new_label"
                value={newRow.key}
                onChange={e => setNewRow({ ...newRow, key: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('admin_translations.col_english')}</label>
              <textarea className="input w-full min-h-[60px]" value={newRow.text_en} onChange={e => setNewRow({ ...newRow, text_en: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('admin_translations.col_french')}</label>
              <textarea className="input w-full min-h-[60px]" value={newRow.text_fr} onChange={e => setNewRow({ ...newRow, text_fr: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('admin_translations.col_bislama')}</label>
              <textarea className="input w-full min-h-[60px]" value={newRow.text_bi} onChange={e => setNewRow({ ...newRow, text_bi: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {t('common.save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { userCanAccessAdminPanel } from '../../utils/adminAccess'
import PageHeader from '../../components/shared/PageHeader'
import { invalidateAgendaSectionsCache } from '../../hooks/useAgendaSections'

export default function AgendaSectionFormsAdmin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [sections, setSections] = useState([])
  const [digitizedForms, setDigitizedForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  useEffect(() => {
    if (user && !userCanAccessAdminPanel(user)) navigate('/', { replace: true })
  }, [user, navigate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [secRes, formsRes] = await Promise.all([
        api.get('/agenda-sections/'),
        api.get('/form-types/', { params: { active_only: '1', digitized_only: '1' } }),
      ])
      const secList = (secRes.data.results ?? secRes.data).slice().sort(
        (a, b) => a.display_order - b.display_order || a.id - b.id,
      )
      const forms = formsRes.data.results ?? formsRes.data
      setSections(secList)
      setDigitizedForms(forms)
    } catch {
      toast.error('Could not load agenda sections or digitized forms.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const assignForm = async (sectionId, formId) => {
    setSavingId(sectionId)
    try {
      const payload = { digitized_form: formId ? Number(formId) : null }
      const { data } = await api.patch(`/agenda-sections/${sectionId}/`, payload)
      setSections(prev => prev.map(s => (s.id === sectionId ? data : s)))
      invalidateAgendaSectionsCache()
      toast.success('Digitized form updated.')
    } catch (err) {
      const d = err.response?.data
      toast.error(typeof d === 'object' ? (d.detail || JSON.stringify(d)) : 'Save failed.')
    } finally {
      setSavingId(null)
    }
  }

  const lodgeSections = sections.filter(s => !s.is_special)

  return (
    <div>
      <PageHeader
        title="Agenda section forms"
        subtitle="Choose which digitized PSC form is used when a ministry lodges a matter under each agenda section."
      />

      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
        Only form types with <strong>Digitized = Yes</strong> in{' '}
        <Link to="/admin/form-types" className="text-primary-600 dark:text-primary-400 underline">
          PSC Form Types
        </Link>{' '}
        appear here. When a submission is created with an agenda section, the linked form is applied automatically
        so staff can complete the digital form on the submission page.
      </div>

      {digitizedForms.length === 0 && !loading && (
        <div className="card p-6 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          No digitized form types found. Mark forms as digitized in{' '}
          <Link to="/admin/form-types" className="underline font-medium">PSC Form Types</Link>
          {' '}and use the form builder to define fields.
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-8 text-sm text-slate-500 text-center">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-start px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Agenda section</th>
                  <th className="text-start px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Digitized form</th>
                  <th className="text-start px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 w-28">Builder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lodgeSections.map(section => (
                  <tr key={section.id} className={!section.is_active ? 'opacity-50' : ''}>
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{section.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <code>{section.code}</code>
                        {section.is_special && (
                          <span className="ml-2">Meeting only</span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top min-w-[280px]">
                      <select
                        className="input w-full max-w-xl"
                        disabled={savingId === section.id || digitizedForms.length === 0}
                        value={section.digitized_form ?? ''}
                        onChange={e => assignForm(section.id, e.target.value)}
                      >
                        <option value="">— None (attachments only) —</option>
                        {digitizedForms.map(ft => (
                          <option key={ft.id} value={ft.id}>
                            {ft.code} — {ft.name}
                          </option>
                        ))}
                      </select>
                      {section.digitized_form_code && (
                        <p className="text-xs text-slate-500 mt-1">
                          Current: {section.digitized_form_code}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {section.digitized_form ? (
                        <Link
                          to={`/admin/form-types/${section.digitized_form}/builder`}
                          className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline text-xs font-medium"
                        >
                          <ExternalLink size={14} />
                          Open builder
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && sections.filter(s => s.is_special).length > 0 && (
          <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800">
            Meeting-only sections (Preliminaries, Matters Arising) are managed under{' '}
            <Link to="/admin/agenda-sections" className="text-primary-600 dark:text-primary-400 underline">
              Agenda sections
            </Link>
            {' '}and do not use lodge forms.
          </p>
        )}
      </div>
    </div>
  )
}

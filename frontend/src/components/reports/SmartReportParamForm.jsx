import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BaseInput from '../shared/BaseInput'
import BaseSelect from '../shared/BaseSelect'

// Common workflow stages offered as report filters (value = backend WorkflowStage).
const STAGE_OPTIONS = [
  { value: 'submitted', label: 'Submitted to PSC' },
  { value: 'received_by_psc', label: 'Received by PSC' },
  { value: 'registered_routed', label: 'Registered and Routed' },
  { value: 'manager_checklist_review', label: 'Manager Checklist Review' },
  { value: 'under_assessment', label: 'Under Assessment' },
  { value: 'pending_secretary_approval', label: 'Pending Secretary Approval' },
  { value: 'forwarded_to_commission', label: 'Forwarded to Commission' },
  { value: 'commission_sitting', label: 'Commission Sitting' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'returned', label: 'Returned' },
  { value: 'under_implementation', label: 'Under Implementation' },
]

/**
 * Renders a catalog report's parameter schema into a form.
 * @param {Array} params  schema: [{ key, type, label, optional }]
 * @param {Array} ministries  [{ id, name }]
 * @param {Array} categories  [{ id, name }]
 * @param {Function} onSubmit (paramsObject) => void
 */
export default function SmartReportParamForm({ params = [], ministries = [], categories = [], busy, onSubmit }) {
  const { t } = useTranslation()
  const [values, setValues] = useState({})

  const set = (key, val) => setValues(v => ({ ...v, [key]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const clean = {}
    Object.entries(values).forEach(([k, v]) => {
      if (v !== '' && v !== false && v != null) clean[k] = v
    })
    onSubmit(clean)
  }

  const optionsFor = (type) => {
    if (type === 'ministry') return ministries.map(m => ({ value: String(m.id), label: m.name }))
    if (type === 'form_category') return categories.map(c => ({ value: String(c.id), label: c.name }))
    if (type === 'stage') return STAGE_OPTIONS
    return []
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {params.map((p) => {
          if (p.type === 'date') {
            return (
              <BaseInput
                key={p.key}
                type="date"
                label={p.label}
                value={values[p.key] || ''}
                onChange={(e) => set(p.key, e.target.value)}
              />
            )
          }
          if (p.type === 'bool') {
            return (
              <label key={p.key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 self-end pb-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={!!values[p.key]}
                  onChange={(e) => set(p.key, e.target.checked)}
                />
                {p.label}
              </label>
            )
          }
          // ministry / form_category / stage → select
          return (
            <BaseSelect
              key={p.key}
              label={`${p.label}${p.optional ? '' : ' *'}`}
              placeholder={t('smart_reports.any')}
              options={optionsFor(p.type)}
              value={values[p.key] || ''}
              onChange={(_e, val) => set(p.key, val ?? '')}
            />
          )
        })}
      </div>
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? t('smart_reports.generating') : t('smart_reports.generate')}
      </button>
    </form>
  )
}

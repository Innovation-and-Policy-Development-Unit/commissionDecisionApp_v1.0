import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileBarChart, ChevronRight } from 'lucide-react'
import SmartReportParamForm from './SmartReportParamForm'

/**
 * Catalog cards → parameter form. Calls onGenerate(report_type, params).
 */
export default function SmartReportCatalog({ reports = [], ministries, categories, busy, onGenerate }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(null)

  if (selected) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="text-sm text-primary-600 hover:underline"
        >
          ← {t('smart_reports.back_to_catalog')}
        </button>
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{selected.title}</h3>
          {selected.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{selected.description}</p>
          )}
        </div>
        <SmartReportParamForm
          params={selected.params}
          ministries={ministries}
          categories={categories}
          busy={busy}
          onSubmit={(params) => onGenerate(selected.key, params)}
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {reports.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => setSelected(r)}
          className="card card-hover p-4 text-left flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <FileBarChart className="text-primary-500" size={22} />
            <ChevronRight className="text-slate-400" size={18} />
          </div>
          <div className="font-semibold text-slate-800 dark:text-slate-100">{r.title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{r.description}</div>
        </button>
      ))}
    </div>
  )
}

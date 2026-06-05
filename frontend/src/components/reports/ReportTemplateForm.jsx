import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import BaseInput from '../shared/BaseInput'
import BaseTextarea from '../shared/BaseTextarea'

// Params the guided builder can expose on the Generate form (matches resolver schema).
const PARAM_OPTIONS = [
  { key: 'date_from', type: 'date', label: 'From' },
  { key: 'date_to', type: 'date', label: 'To' },
  { key: 'ministry_id', type: 'ministry', label: 'Ministry' },
  { key: 'form_category_id', type: 'form_category', label: 'Category' },
  { key: 'stage', type: 'stage', label: 'Stage' },
  { key: 'overdue_only', type: 'bool', label: 'Overdue only' },
]

export default function ReportTemplateForm({ initial, vocabulary, busy, onSave, onCancel }) {
  const { t } = useTranslation()
  const vocab = vocabulary || { chart_types: [], chart_sources: [], kpi_sources: [], table_columns: [] }
  const spec = initial?.spec || {}

  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [visibleToAll, setVisibleToAll] = useState(initial?.visible_to_all ?? true)
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)
  const [params, setParams] = useState(new Set((initial?.param_schema || []).map(p => p.key)))
  const [kpis, setKpis] = useState(new Set((spec.kpis || []).map(k => k.source)))
  const [columns, setColumns] = useState(new Set((spec.table?.columns || [])))
  const [charts, setCharts] = useState(
    (spec.charts || []).map(c => ({ source: c.source, type: c.type, title: c.title || '' }))
  )
  const [narrative, setNarrative] = useState(spec.narrative_markdown || '')

  const kpiLabel = useMemo(() => {
    const m = {}
    ;(vocab.kpi_sources || []).forEach(k => { m[k.key] = k.label })
    return m
  }, [vocab])

  const toggle = (setter, set, value) => {
    const next = new Set(set)
    next.has(value) ? next.delete(value) : next.add(value)
    setter(next)
  }

  const addChart = () =>
    setCharts(cs => [...cs, { source: vocab.chart_sources[0] || '', type: vocab.chart_types[0] || 'bar', title: '' }])
  const updateChart = (i, key, val) => setCharts(cs => cs.map((c, idx) => idx === i ? { ...c, [key]: val } : c))
  const removeChart = (i) => setCharts(cs => cs.filter((_, idx) => idx !== i))

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      name: name.trim(),
      description: description.trim(),
      domain: 'submissions',
      visible_to_all: visibleToAll,
      is_active: isActive,
      param_schema: PARAM_OPTIONS.filter(p => params.has(p.key)).map(p => ({ ...p, optional: true })),
      spec: {
        sections: ['kpis', 'charts', 'table'],
        kpis: [...kpis].map(s => ({ source: s, label: kpiLabel[s] || s })),
        charts: charts
          .filter(c => c.source && c.type)
          .map((c, i) => ({ id: `${c.source}_${i}`, source: c.source, type: c.type, title: c.title || '' })),
        table: { columns: [...columns] },
        narrative_markdown: narrative.trim(),
      },
    }
    onSave(payload)
  }

  const Check = ({ checked, onChange, label }) => (
    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
      <input type="checkbox" className="rounded border-slate-300" checked={checked} onChange={onChange} />
      {label}
    </label>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BaseInput label={t('report_hub.tpl_name')} required value={name} onChange={e => setName(e.target.value)} />
        <BaseInput label={t('report_hub.tpl_description')} value={description} onChange={e => setDescription(e.target.value)} />
      </div>

      <section className="space-y-2">
        <h4 className="font-semibold text-slate-800 dark:text-slate-100">{t('report_hub.tpl_params')}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PARAM_OPTIONS.map(p => (
            <Check key={p.key} checked={params.has(p.key)} onChange={() => toggle(setParams, params, p.key)} label={p.label} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="font-semibold text-slate-800 dark:text-slate-100">{t('report_hub.tpl_kpis')}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(vocab.kpi_sources || []).map(k => (
            <Check key={k.key} checked={kpis.has(k.key)} onChange={() => toggle(setKpis, kpis, k.key)} label={k.label} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-slate-800 dark:text-slate-100">{t('report_hub.tpl_charts')}</h4>
          <button type="button" onClick={addChart} className="btn-ghost text-sm flex items-center gap-1">
            <Plus size={15} /> {t('report_hub.tpl_add_chart')}
          </button>
        </div>
        {charts.map((c, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
            <label className="text-xs text-slate-500">
              {t('report_hub.tpl_chart_source')}
              <select className="input mt-1" value={c.source} onChange={e => updateChart(i, 'source', e.target.value)}>
                {(vocab.chart_sources || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              {t('report_hub.tpl_chart_type')}
              <select className="input mt-1" value={c.type} onChange={e => updateChart(i, 'type', e.target.value)}>
                {(vocab.chart_types || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <BaseInput label={t('report_hub.tpl_chart_title')} value={c.title} onChange={e => updateChart(i, 'title', e.target.value)} />
            <button type="button" onClick={() => removeChart(i)} className="btn-ghost text-red-600 p-2" aria-label="remove">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h4 className="font-semibold text-slate-800 dark:text-slate-100">{t('report_hub.tpl_columns')}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(vocab.table_columns || []).map(col => (
            <Check key={col} checked={columns.has(col)} onChange={() => toggle(setColumns, columns, col)} label={col} />
          ))}
        </div>
      </section>

      <BaseTextarea label={t('report_hub.tpl_narrative')} rows={3} value={narrative} onChange={e => setNarrative(e.target.value)} />

      <div className="flex flex-wrap gap-4">
        <Check checked={visibleToAll} onChange={e => setVisibleToAll(e.target.checked)} label={t('report_hub.tpl_visible_all')} />
        <Check checked={isActive} onChange={e => setIsActive(e.target.checked)} label={t('report_hub.tpl_active')} />
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
          {busy ? t('report_hub.saving') : t('report_hub.save_template')}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>{t('report_hub.cancel')}</button>
      </div>
    </form>
  )
}

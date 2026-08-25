/**
 * Itemized position-by-position costing table for the Organisation
 * Restructure / Establishment Variation submission (PSC Form 2.1, Section 3).
 *
 * Row schema matches RestructureSubmissionData.costing_rows in
 * backend/tracker/models.py for consistency across the codebase, even
 * though this form persists through the generic dynamic-form JSON blob:
 *   current_post_no, current_title, current_level, current_salary,
 *   proposed_post_no, proposed_title, proposed_level, proposed_salary,
 *   salary_difference
 */
import { Plus, Trash2 } from 'lucide-react'

function blankRow() {
  return {
    current_post_no: '', current_title: '', current_level: '', current_salary: '',
    proposed_post_no: '', proposed_title: '', proposed_level: '', proposed_salary: '',
    salary_difference: '',
  }
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (parseFloat(row[key]) || 0), 0)
}

const CELL_INPUT = 'w-full min-w-[6rem] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400'

export default function RestructureCostingTable({ rows, onChange, readOnly = false }) {
  const data = rows || []

  const updateRow = (idx, key, value) => {
    const next = data.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    onChange(next)
  }
  const removeRow = (idx) => onChange(data.filter((_, i) => i !== idx))
  const addRow = () => onChange([...data, blankRow()])

  const currentTotal = sum(data, 'current_salary')
  const proposedTotal = sum(data, 'proposed_salary')
  const netDiff = proposedTotal - currentTotal

  if (readOnly && data.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400 italic py-2">No positions listed.</p>
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th colSpan={4} className="px-2 py-1.5 text-center font-semibold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700">
                Current
              </th>
              <th colSpan={4} className="px-2 py-1.5 text-center font-semibold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700">
                Proposed
              </th>
              <th className="px-2 py-1.5 text-center font-semibold text-slate-600 dark:text-slate-300">
                Salary Difference
              </th>
              {!readOnly && <th className="w-8" />}
            </tr>
            <tr className="text-[11px] font-medium text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700">
              <th className="px-2 py-1.5 text-left">Post No.</th>
              <th className="px-2 py-1.5 text-left">Title / Occupant</th>
              <th className="px-2 py-1.5 text-left">Level / Grade</th>
              <th className="px-2 py-1.5 text-left border-r border-slate-200 dark:border-slate-700">Salary (VT)</th>
              <th className="px-2 py-1.5 text-left">Post No.</th>
              <th className="px-2 py-1.5 text-left">Title / Occupant</th>
              <th className="px-2 py-1.5 text-left">Level / Grade</th>
              <th className="px-2 py-1.5 text-left border-r border-slate-200 dark:border-slate-700">Annual Salary (VT)</th>
              <th className="px-2 py-1.5 text-left">+/- or %</th>
              {!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !readOnly && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-slate-500 dark:text-slate-400 italic">
                  No positions added yet.
                </td>
              </tr>
            )}
            {data.map((row, idx) => (
              <tr key={idx} className="border-t border-slate-100 dark:border-slate-800">
                {readOnly ? (
                  <>
                    <td className="px-2 py-1.5">{row.current_post_no || '—'}</td>
                    <td className="px-2 py-1.5">{row.current_title || '—'}</td>
                    <td className="px-2 py-1.5">{row.current_level || '—'}</td>
                    <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700">{row.current_salary || '—'}</td>
                    <td className="px-2 py-1.5">{row.proposed_post_no || '—'}</td>
                    <td className="px-2 py-1.5">{row.proposed_title || '—'}</td>
                    <td className="px-2 py-1.5">{row.proposed_level || '—'}</td>
                    <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700">{row.proposed_salary || '—'}</td>
                    <td className="px-2 py-1.5">{row.salary_difference || '—'}</td>
                  </>
                ) : (
                  <>
                    <td className="px-1.5 py-1"><input className={CELL_INPUT} value={row.current_post_no} onChange={e => updateRow(idx, 'current_post_no', e.target.value)} /></td>
                    <td className="px-1.5 py-1"><input className={CELL_INPUT} value={row.current_title} onChange={e => updateRow(idx, 'current_title', e.target.value)} /></td>
                    <td className="px-1.5 py-1"><input className={CELL_INPUT} value={row.current_level} onChange={e => updateRow(idx, 'current_level', e.target.value)} /></td>
                    <td className="px-1.5 py-1 border-r border-slate-200 dark:border-slate-700">
                      <input className={CELL_INPUT} type="number" min="0" value={row.current_salary} onChange={e => updateRow(idx, 'current_salary', e.target.value)} />
                    </td>
                    <td className="px-1.5 py-1"><input className={CELL_INPUT} value={row.proposed_post_no} onChange={e => updateRow(idx, 'proposed_post_no', e.target.value)} /></td>
                    <td className="px-1.5 py-1"><input className={CELL_INPUT} value={row.proposed_title} onChange={e => updateRow(idx, 'proposed_title', e.target.value)} /></td>
                    <td className="px-1.5 py-1"><input className={CELL_INPUT} value={row.proposed_level} onChange={e => updateRow(idx, 'proposed_level', e.target.value)} /></td>
                    <td className="px-1.5 py-1 border-r border-slate-200 dark:border-slate-700">
                      <input className={CELL_INPUT} type="number" min="0" value={row.proposed_salary} onChange={e => updateRow(idx, 'proposed_salary', e.target.value)} />
                    </td>
                    <td className="px-1.5 py-1">
                      <input
                        className={CELL_INPUT}
                        value={row.salary_difference}
                        onChange={e => updateRow(idx, 'salary_difference', e.target.value)}
                        placeholder={
                          row.current_salary && row.proposed_salary
                            ? `e.g. ${(parseFloat(row.proposed_salary) - parseFloat(row.current_salary)).toLocaleString()}`
                            : '+/- VT or %'
                        }
                      />
                    </td>
                    <td className="px-1 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        aria-label="Remove position"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot className="bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200">
              <tr>
                <td colSpan={3} className="px-2 py-1.5 text-right">Total</td>
                <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700">VT {currentTotal.toLocaleString()}</td>
                <td colSpan={3} className="px-2 py-1.5 text-right">Total</td>
                <td className="px-2 py-1.5 border-r border-slate-200 dark:border-slate-700">VT {proposedTotal.toLocaleString()}</td>
                <td className={`px-2 py-1.5 ${netDiff < 0 ? 'text-emerald-600 dark:text-emerald-400' : netDiff > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  VT {netDiff.toLocaleString()}
                </td>
                {!readOnly && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          <Plus size={13} /> Add Position
        </button>
      )}
    </div>
  )
}

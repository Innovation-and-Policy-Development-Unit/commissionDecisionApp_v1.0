import { useState } from 'react'
import { Wallet, Plus } from 'lucide-react'

const BASIS = {
  full: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  half: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  no_pay: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

/**
 * Suspension financial implication: half/full/no-pay basis, withheld salary,
 * 2-month expiry, and the OPSC reimbursement assessment.
 */
export default function SuspensionSection({ caseId, suspensions = [], canWrite, busy, post }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({
    salary_basis: 'half', monthly_salary: '', withheld_amount: '', suspension_start: '', notes: '',
  })
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const add = async () => {
    if (!f.suspension_start) { alert('Suspension start date is required.'); return }
    await post(`/compliance/cases/${caseId}/suspensions/`, {
      ...f,
      monthly_salary: f.monthly_salary || null,
      withheld_amount: f.withheld_amount || null,
    })
    setF({ salary_basis: 'half', monthly_salary: '', withheld_amount: '', suspension_start: '', notes: '' })
    setOpen(false)
  }

  const assess = (s, decision) =>
    post(`/compliance/cases/${caseId}/suspensions/${s.id}/assess/`, { reimbursement_status: decision })

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><Wallet size={17} /> Suspension &amp; Salary</h3>
        {canWrite && (
          <button className="text-slate-400 hover:text-slate-600" onClick={() => setOpen((v) => !v)}><Plus size={16} /></button>
        )}
      </div>

      {open && (
        <div className="mb-3 space-y-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-3">
          <select className="form-input w-full text-sm" value={f.salary_basis} onChange={set('salary_basis')}>
            <option value="half">Half Salary (temporary suspension)</option>
            <option value="full">Full Salary</option>
            <option value="no_pay">Without Pay (PSDB sanction)</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input className="form-input w-full text-sm" type="number" placeholder="Monthly salary (VT)" value={f.monthly_salary} onChange={set('monthly_salary')} />
            <input className="form-input w-full text-sm" type="number" placeholder="Withheld amount (VT)" value={f.withheld_amount} onChange={set('withheld_amount')} />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-0.5">Suspension start (expiry auto-set to +2 months)</label>
            <input className="form-input w-full text-sm" type="date" value={f.suspension_start} onChange={set('suspension_start')} />
          </div>
          <textarea className="form-input w-full text-sm" rows={2} placeholder="Notes" value={f.notes} onChange={set('notes')} />
          <button disabled={busy} className="btn-primary text-sm w-full" onClick={add}>Record suspension</button>
        </div>
      )}

      {suspensions.length ? (
        <ul className="space-y-2">
          {suspensions.map((s) => (
            <li key={s.id} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-1">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${BASIS[s.salary_basis] || BASIS.half}`}>{s.salary_basis_display}</span>
                {s.days_remaining != null && (
                  <span className={`text-[11px] font-medium ${s.days_remaining <= 7 ? 'text-red-600' : 'text-slate-500'}`}>
                    {s.days_remaining >= 0 ? `${s.days_remaining}d to expiry` : 'expired'}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {s.suspension_start} → {s.suspension_end || '—'}
                {s.withheld_amount ? ` · withheld VT ${s.withheld_amount}` : ''}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Reimbursement:</span>
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">{s.reimbursement_status_display}</span>
                {canWrite && s.reimbursement_status === 'pending' && (
                  <span className="ml-auto flex gap-1">
                    <button disabled={busy} onClick={() => assess(s, 'reimburse')} className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-700">Reimburse</button>
                    <button disabled={busy} onClick={() => assess(s, 'forfeit')} className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-700">Forfeit</button>
                  </span>
                )}
              </div>
              {s.reinstated_on_full_salary && <div className="mt-1 text-[11px] text-emerald-600">Reinstated on full salary.</div>}
            </li>
          ))}
        </ul>
      ) : !open && <p className="text-sm text-slate-400">No suspensions recorded.</p>}
    </section>
  )
}

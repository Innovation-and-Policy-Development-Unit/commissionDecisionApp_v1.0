import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ScanSearch } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'

function formatWhen(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) } catch { return iso }
}

function Verdict({ row }) {
  if (row.confirmed_by) {
    return (
      <span title={`Confirmed ${formatWhen(row.confirmed_at)}`} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
        <CheckCircle2 size={12} />Confirmed by {row.confirmed_by}
      </span>
    )
  }
  if (row.verdict === 'seen') {
    return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"><CheckCircle2 size={12} />Signature seen</span>
  }
  if (row.verdict === 'unclear') {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Unclear — check the scan</span>
  }
  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Not seen</span>
}

/**
 * Who signed the uploaded scan, read by AI from the signature pages so nobody
 * has to open the file. A hint: it reports what is visible and the Secretary
 * confirms each signer.
 */
export default function MinutesSignatureTable({ minutes, onUpdated, canConfirm, canRecheck }) {
  const check = minutes?.signature_check || {}
  const status = check.status
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // While the check runs in the background, look again every few seconds.
  useEffect(() => {
    if (status !== 'pending' || !minutes?.id) return undefined
    const id = setInterval(async () => {
      try {
        const { data } = await api.get(`/minutes/${minutes.id}/`)
        onUpdated?.(data)
      } catch { /* try again on the next tick */ }
    }, 4000)
    return () => clearInterval(id)
  }, [status, minutes?.id, onUpdated])

  if (!minutes?.id || !minutes.signed_document || !status) return null

  const post = async (path, body = {}) => {
    setBusy(true); setErr('')
    try {
      const { data } = await api.post(`/minutes/${minutes.id}/${path}/`, body)
      onUpdated?.(data)
    } catch (e) {
      setErr(e.response?.data?.detail || 'That did not work.')
    } finally { setBusy(false) }
  }

  const rows = check.rows || []
  const summary = check.summary || {}
  const allSigned = summary.expected > 0 && summary.signed >= summary.expected

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
        <ScanSearch size={16} className="text-slate-500" />
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex-1">Signatures on the signed minutes</h3>
        {canRecheck && status !== 'pending' && (
          <button type="button" disabled={busy} onClick={() => post('recheck-signatures')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 dark:text-primary-300 hover:underline disabled:opacity-60">
            <RefreshCw size={12} />Check again
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

        {status === 'pending' && (
          <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Loader2 size={14} className="animate-spin" />Reading the signature pages of the scan… this usually takes under a minute.
          </p>
        )}

        {(status === 'failed' || status === 'unavailable') && (
          <p className="text-sm text-amber-800 dark:text-amber-300">
            The scan could not be checked automatically{check.note ? ` (${check.note})` : ''}. Open the signed scan to check the signatures yourself.
          </p>
        )}

        {status === 'done' && (
          <>
            <p className={clsx('text-sm font-semibold', allSigned ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300')}>
              {summary.signed} of {summary.expected} signatures {allSigned ? 'seen or confirmed' : 'seen or confirmed'}
              {summary.missing?.length > 0 && <span className="font-normal"> — not seen: {summary.missing.join(', ')}</span>}
            </p>

            <ul className="space-y-1 text-xs">
              {check.header?.matches_sitting === false && (
                <li className="flex items-start gap-1.5 text-red-700 dark:text-red-400"><AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  The meeting number or date on page 1 ({check.header.meeting_number || '?'} / {check.header.meeting_date || '?'}) does not match this sitting. Check this is the right scan.</li>
              )}
              {check.footer?.complete === false && (
                <li className="flex items-start gap-1.5 text-red-700 dark:text-red-400"><AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  The last page is labelled &quot;{check.footer.last_page_label}&quot; but the scan has {check.page_count} pages. Pages may be missing.</li>
              )}
              {check.stamp_seen === false && (
                <li className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300"><AlertTriangle size={12} className="mt-0.5 shrink-0" />No official stamp was seen near the signatures.</li>
              )}
              {check.note && <li className="text-slate-500">{check.note}</li>}
            </ul>

            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">No signature rows could be read from the scan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Signature</th><th className="py-2 pr-3">Date on scan</th>
                      {canConfirm && <th className="py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60 align-top">
                        <td className="py-2 pr-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{r.role}</td>
                        <td className="py-2 pr-3">
                          <span className="font-medium text-slate-800 dark:text-slate-100">{r.name}</span>
                          {!r.expected && <span className="ml-2 text-[10px] text-slate-500">(on the scan only)</span>}
                          {r.scan_name && r.scan_name !== r.name && <span className="block text-[11px] text-slate-500">written as “{r.scan_name}”</span>}
                          {r.note && r.verdict !== 'seen' && <span className="block text-[11px] text-slate-500">{r.note}</span>}
                        </td>
                        <td className="py-2 pr-3"><Verdict row={r} /></td>
                        <td className="py-2 pr-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{r.date_text || '—'}</td>
                        {canConfirm && (
                          <td className="py-2 text-right">
                            <button type="button" disabled={busy}
                              onClick={() => post('confirm-signature', { row_id: r.id, confirmed: !r.confirmed_by })}
                              className="text-xs font-semibold text-primary-700 dark:text-primary-300 hover:underline disabled:opacity-60">
                              {r.confirmed_by ? 'Withdraw' : 'Confirm'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              Read by AI from the signature pages only{check.checked_at ? ` on ${formatWhen(check.checked_at)}` : ''}. It reports what is visible and cannot prove who signed or that a signature is genuine{canConfirm ? '; confirm each signer after looking at the scan' : ''}.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

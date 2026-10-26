import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { CheckCircle2, Undo2, FileText, ShieldCheck, AlertTriangle, Paperclip, CalendarClock } from 'lucide-react'
import BaseButton from '../../components/shared/BaseButton'
import BaseMessageBar from '../../components/shared/BaseMessageBar'

// A plain client on purpose: this page is opened from an email by someone who may
// have a stale SCDMS session, and the shared client would attach it (and redirect to
// the login page on a 401). The link itself is the credential here.
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

const fmtDate = d => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '')

function Shell({ children }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-8"
      style={{ background: 'linear-gradient(145deg, #f0f4f9 0%, #e5eaf3 100%)' }}
    >
      <div className="w-full" style={{ maxWidth: 640 }}>
        <div className="flex items-center gap-3 mb-5">
          <img
            src="/opsc-logo-white-transparent.png"
            alt="OPSC"
            style={{ width: 48, height: 'auto', filter: 'invert(1) brightness(0) saturate(100%) invert(18%) sepia(49%) saturate(700%) hue-rotate(190deg) brightness(80%)' }}
          />
          <div>
            <p className="text-sm font-semibold text-slate-800 leading-tight">Office of the Public Service Commission</p>
            <p className="text-xs text-slate-500 mt-0.5">Government of the Republic of Vanuatu</p>
          </div>
        </div>
        <div
          style={{
            background: 'white', borderRadius: 20, padding: '28px 28px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 20px 60px -10px rgba(0,66,118,0.13)',
            border: '1px solid rgba(0,66,118,0.08)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  if (!children) return null
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800 sm:text-right">{children}</dd>
    </div>
  )
}

function SittingNote({ sitting }) {
  if (!sitting?.nearest_meeting) return null
  const nearest = sitting.nearest_meeting
  const target = sitting.target_meeting
  const moved = sitting.carried_over && target
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${moved ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
      <CalendarClock size={16} className="mt-0.5 shrink-0" />
      <span>
        {moved
          ? <>Papers for the {fmtDate(nearest.date)} sitting closed on {fmtDate(nearest.due_date)}. If you approve now, this paper goes to the sitting on <strong>{fmtDate(target.date)}</strong> ({target.ref}).</>
          : <>Next sitting: {fmtDate(nearest.date)} ({nearest.ref}). Papers must reach PSC by <strong>{fmtDate(nearest.due_date)}</strong> — approving now meets that deadline.</>}
      </span>
    </div>
  )
}

export default function DgApproval() {
  const { token } = useParams()
  const [state, setState] = useState('loading') // loading | review | invalid | done
  const [data, setData] = useState(null)
  const [pin, setPin] = useState('')
  const [returning, setReturning] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    let cancelled = false
    publicApi.get(`/dg-approval/${encodeURIComponent(token)}/`)
      .then(r => { if (!cancelled) { setData(r.data); setState('review') } })
      .catch(() => { if (!cancelled) setState('invalid') })
    return () => { cancelled = true }
  }, [token])

  const decide = async decision => {
    setBusy(true)
    setError('')
    try {
      const r = await publicApi.post(`/dg-approval/${encodeURIComponent(token)}/decide/`, {
        decision, pin, remarks: decision === 'return' ? remarks : '',
      })
      setResult(r.data)
      setState('done')
    } catch (err) {
      const body = err.response?.data || {}
      if (err.response?.status === 404) { setState('invalid'); return }
      if (err.response?.status === 429) { setError('Too many attempts. Please wait a minute and try again.'); return }
      if (body.code === 'wrong_pin') {
        setError(`That PIN is not correct. ${body.attempts_left} attempt${body.attempts_left === 1 ? '' : 's'} left before this link is cancelled.`)
      } else {
        setError(body.detail || 'Something went wrong. Please try again.')
      }
      if (body.code === 'locked') setState('invalid')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') {
    return <Shell><p className="text-sm text-slate-500">Opening the submission…</p></Shell>
  }

  if (state === 'invalid') {
    return (
      <Shell>
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-600 shrink-0" size={24} />
          <div>
            <h1 className="text-lg font-bold text-slate-900">This link is no longer valid</h1>
            <p className="text-sm text-slate-600 mt-1">
              It may already have been used, replaced by a newer link, expired, or the submission may have been withdrawn.
              Ask your ministry HR to send a new link, or sign in to SCDMS to see what is waiting for you.
            </p>
            <a href="/auth/login" className="inline-block mt-4 text-sm font-semibold text-primary-700 hover:underline">Sign in to SCDMS</a>
          </div>
        </div>
      </Shell>
    )
  }

  if (state === 'done') {
    const approved = result.outcome === 'approved'
    return (
      <Shell>
        <div className="flex flex-col items-center text-center py-2">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${approved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {approved ? <CheckCircle2 size={30} /> : <Undo2 size={28} />}
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-4">
            {approved ? 'Submission approved' : 'Returned to HR'}
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            {approved
              ? <><strong>{result.reference_number}</strong> — {result.title}<br />has been approved and sent to the Public Service Commission.</>
              : <><strong>{result.reference_number}</strong> has been returned to your ministry HR with your comments.</>}
          </p>
          <p className="text-sm text-slate-600 mt-4">
            You can sign in to SCDMS to see this submission and follow what happens next.
          </p>
          <a
            href={result.login_url}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-6 py-2.5"
          >
            Sign in to SCDMS
          </a>
          <p className="text-xs text-slate-400 mt-5">You can close this page. This link cannot be used again.</p>
        </div>
      </Shell>
    )
  }

  const needsPin = data.pin_required
  const canAct = !busy && (!needsPin || pin.trim().length >= 4)

  return (
    <Shell>
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={18} className="text-primary-600" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approval needed</span>
      </div>
      <h1 className="text-xl font-bold text-slate-900">{data.title}</h1>
      <p className="text-sm text-slate-500 mt-1">
        {data.reference_number} · for {data.dg_name}, Director-General
      </p>

      <dl className="mt-5 space-y-2.5">
        <Row label="Ministry">{data.ministry}</Row>
        <Row label="Department">{data.department}</Row>
        <Row label="Form">{[data.form_type_code, data.form_type_name].filter(Boolean).join(' — ')}</Row>
        <Row label="Classification">{data.classification}</Row>
        <Row label="Prepared by">{data.prepared_by}</Row>
      </dl>

      {data.notes && (
        <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-700 whitespace-pre-wrap">
          {data.notes}
        </div>
      )}

      {data.form_fields?.length > 0 && (
        <details className="mt-4 rounded-xl border border-slate-200" open>
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-slate-800 flex items-center gap-2">
            <FileText size={15} /> Details of the paper
          </summary>
          <dl className="px-3 pb-3 space-y-2">
            {data.form_fields.map((f, i) => (
              <div key={i} className="text-sm">
                <dt className="text-xs text-slate-500">{f.label}</dt>
                <dd className="text-slate-800 whitespace-pre-wrap break-words">{f.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      {data.documents?.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-1.5"><Paperclip size={15} /> Attached documents</p>
          <ul className="space-y-1">
            {data.documents.map(d => (
              <li key={d.id} className="text-sm">
                <a
                  className="text-primary-700 hover:underline break-all"
                  href={`${publicApi.defaults.baseURL}/dg-approval/${encodeURIComponent(token)}/documents/${d.id}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {d.name}
                </a>
                {d.description && <span className="text-slate-500"> — {d.description}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4"><SittingNote sitting={data.sitting} /></div>

      <div className="mt-6 pt-5 border-t border-slate-100 space-y-4">
        {error && <BaseMessageBar intent="error">{error}</BaseMessageBar>}

        {needsPin && !data.has_pin && (
          <BaseMessageBar intent="warning">
            You have not set your SCDMS PIN yet. <a className="underline font-semibold" href="/auth/login">Sign in to SCDMS</a> once
            to set it, then open this link again — or approve the submission after signing in.
          </BaseMessageBar>
        )}

        {needsPin && (
          <div>
            <label htmlFor="dg-pin" className="block text-xs font-medium text-slate-700 mb-1">
              Confirm with your SCDMS PIN
            </label>
            <input
              id="dg-pin"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={12}
              className="input text-sm w-40 tracking-widest"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        )}

        {returning && (
          <div>
            <label htmlFor="dg-remarks" className="block text-xs font-medium text-slate-700 mb-1">
              What needs to change? (HR will see this) *
            </label>
            <textarea
              id="dg-remarks"
              rows={4}
              className="input text-sm w-full"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              maxLength={5000}
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {!returning ? (
            <>
              <BaseButton
                variant="primary"
                className="sm:flex-1 !py-3"
                icon={<CheckCircle2 size={16} />}
                onClick={() => decide('approve')}
                disabled={!canAct || (needsPin && !data.has_pin)}
                loading={busy}
                loadingLabel="Approving"
              >
                Approve and send to PSC
              </BaseButton>
              <BaseButton
                variant="outline"
                className="sm:flex-1 !py-3"
                icon={<Undo2 size={16} />}
                onClick={() => { setReturning(true); setError('') }}
                disabled={busy}
              >
                Return to HR for changes
              </BaseButton>
            </>
          ) : (
            <>
              <BaseButton
                variant="primary"
                className="sm:flex-1 !py-3"
                icon={<Undo2 size={16} />}
                onClick={() => decide('return')}
                disabled={!canAct || !remarks.trim() || (needsPin && !data.has_pin)}
                loading={busy}
                loadingLabel="Returning"
              >
                Return to HR
              </BaseButton>
              <BaseButton variant="outline" className="sm:flex-1 !py-3" onClick={() => { setReturning(false); setError('') }} disabled={busy}>
                Back
              </BaseButton>
            </>
          )}
        </div>
        <p className="text-xs text-slate-400">
          This link is for you only and works once. Approving records your name, the time and your device, and sends the paper to the Public Service Commission.
        </p>
      </div>
    </Shell>
  )
}

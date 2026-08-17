import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, FileSearch, Check, ArrowLeft } from 'lucide-react'
import api from '../../api/client'
import { formatApiError } from '../../utils/apiError'
import BaseButton from '../../components/shared/BaseButton'
import BaseInput from '../../components/shared/BaseInput'
import BaseMessageBar from '../../components/shared/BaseMessageBar'

const ANIM_STYLES = `
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .anim-slide-up { animation: slide-up 0.5s cubic-bezier(.22,1,.36,1) both; }
  .anim-fade-in  { animation: fade-in 0.6s ease both; }
`

function badgeClass(result) {
  if (result.is_paused) return 'bg-amber-50 text-amber-800 border-amber-200'
  if (result.milestone_index === 6) return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (result.milestone_index === 5) return 'bg-slate-100 text-slate-700 border-slate-200'
  if (result.milestone_index === null) return 'bg-slate-100 text-slate-700 border-slate-200'
  return 'bg-blue-50 text-blue-800 border-blue-200'
}

function Stepper({ milestones, milestoneIndex, isPaused }) {
  if (milestoneIndex === null || milestoneIndex === undefined) return null
  return (
    <div className="flex items-start justify-between">
      {milestones.map((label, i) => {
        const done = i < milestoneIndex
        const current = i === milestoneIndex
        return (
          <div key={label} className="flex-1 flex flex-col items-center text-center px-0.5">
            <div className="flex items-center w-full">
              <div className={`flex-1 h-0.5 ${i === 0 ? 'opacity-0' : done || current ? (current && isPaused ? 'bg-amber-400' : 'bg-primary-600') : 'bg-slate-200'}`} />
              <div
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                  current
                    ? (isPaused ? 'bg-amber-400 border-amber-400 text-white' : 'bg-primary-600 border-primary-600 text-white')
                    : done
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'bg-white border-slate-300 text-slate-400'
                }`}
              >
                {done ? <Check size={12} /> : i + 1}
              </div>
              <div className={`flex-1 h-0.5 ${i === milestones.length - 1 ? 'opacity-0' : done ? 'bg-primary-600' : 'bg-slate-200'}`} />
            </div>
            <span className={`mt-1.5 text-[10px] leading-tight ${current ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function TrackSubmission() {
  const [searchParams] = useSearchParams()
  const [referenceNumber, setReferenceNumber] = useState(searchParams.get('ref') || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const lookup = async ref => {
    if (!ref) return
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const { data } = await api.get(`/track/${encodeURIComponent(ref)}/`)
      setResult(data)
    } catch (err) {
      setError(formatApiError(err, 'Unable to look up that reference number.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) lookup(ref.trim())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = e => {
    e.preventDefault()
    lookup(referenceNumber.trim())
  }

  return (
    <>
      <style>{ANIM_STYLES}</style>

      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
        style={{ background: 'linear-gradient(145deg, #f0f4f9 0%, #e5eaf3 100%)' }}
      >
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,66,118,0.07) 0%, transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: '-80px', left: '-80px', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)' }} />
        </div>

        <div className="relative z-10 w-full" style={{ maxWidth: 480 }}>

          <div className="flex items-center gap-3 mb-6 anim-fade-in" style={{ animationDelay: '0s' }}>
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
            className="anim-slide-up"
            style={{
              background: 'white',
              borderRadius: 20,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 20px 60px -10px rgba(0,66,118,0.13)',
              border: '1px solid rgba(0,66,118,0.08)',
              padding: '36px 32px',
              animationDelay: '0.08s',
            }}
          >
            <div className="flex justify-center mb-5">
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #0c2451, #1a4080)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileSearch size={26} color="white" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-center text-slate-900 mb-1">Track Your Submission</h1>
            <p className="text-sm text-center text-slate-500 mb-6">
              Enter the reference number you received to check its current status.
            </p>

            {error && (
              <BaseMessageBar intent="error" className="mb-4">
                {error}
              </BaseMessageBar>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <BaseInput
                label="Reference Number"
                type="text"
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
                placeholder="e.g. PSC-2026-00042"
                required
                autoFocus
              />
              <BaseButton
                type="submit"
                variant="primary"
                className="w-full !py-3"
                loading={loading}
                loadingLabel="Looking up"
                icon={!loading ? <Search size={16} /> : undefined}
              >
                Track Submission
              </BaseButton>
            </form>

            {result && (
              <div className="mt-6 pt-5 border-t border-slate-100 anim-fade-in space-y-6">
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Reference Number</dt>
                    <dd className="font-semibold text-slate-900">{result.reference_number}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Ministry</dt>
                    <dd className="font-medium text-slate-800">{result.ministry}</dd>
                  </div>
                  {result.unit && (
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Unit</dt>
                      <dd className="font-medium text-slate-800">{result.unit}</dd>
                    </div>
                  )}
                  {result.assigned_role && (
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Being Handled By</dt>
                      <dd className="font-medium text-slate-800">{result.assigned_role}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Status</dt>
                    <dd>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeClass(result)}`}>
                        {result.current_stage_label}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Last Updated</dt>
                    <dd className="font-medium text-slate-800">
                      {new Date(result.last_updated).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>

                {result.milestone_index !== null && result.milestone_index !== undefined && (
                  <div className="pt-2">
                    {result.is_paused && (
                      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                        On hold: {result.current_stage_label}
                      </div>
                    )}
                    <Stepper
                      milestones={result.milestones}
                      milestoneIndex={result.milestone_index}
                      isPaused={result.is_paused}
                    />
                  </div>
                )}

                {result.history?.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">History</p>
                    <ul className="space-y-1.5">
                      {result.history.map((entry, i) => (
                        <li key={i} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700">{entry.stage_label}</span>
                          <span className="text-slate-400">{new Date(entry.occurred_at).toLocaleDateString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-center anim-fade-in" style={{ animationDelay: '0.14s' }}>
            <Link
              to="/auth/login"
              className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 transition-colors font-medium"
            >
              <ArrowLeft size={15} /> Back to Login
            </Link>
          </div>

          <div className="mt-4 flex items-center justify-center text-[11px] text-slate-400 anim-fade-in" style={{ animationDelay: '0.2s' }}>
            <span>© {new Date().getFullYear()} OPSC Vanuatu. All rights reserved.</span>
          </div>
        </div>
      </div>
    </>
  )
}

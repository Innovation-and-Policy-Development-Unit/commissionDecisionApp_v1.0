import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, PenLine } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

export default function TravelEndorsementPanel({ submissionId, submission, onSigned }) {
  const { user } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [signing, setSigning] = useState(null)
  const [secretaryApproved, setSecretaryApproved] = useState(true)
  const [remarks, setRemarks] = useState('')

  const load = useCallback(async () => {
    const res = await api.get(`/submissions/${submissionId}/travel-endorsements/`)
    setData(res.data)
  }, [submissionId])

  useEffect(() => {
    if (submission?.secretary_only) load()
  }, [submission?.secretary_only, load])

  if (!submission?.secretary_only || !data) return null

  const signedMap = Object.fromEntries((data.signed || []).map(s => [s.section_key, s]))

  const canSign = (section) => {
    if (!user) return false
    if (section.signer === 'creator') {
      const creatorId = submission.created_by?.id ?? submission.created_by
      return Number(creatorId) === user.id
    }
    const uid = data.travel_endorsers?.[section.signer] || data.travel_endorsers?.[`${section.signer}_id`]
    if (uid && Number(uid) === user.id) return true
    if (section.signer === 'secretary' && ['psc_secretary', 'psc_admin'].includes(user.role)) return true
    if (section.signer === 'director' && user.role === 'head_of_agency') {
      const subDept = submission.department?.id ?? submission.department_id
      return subDept && user.department_id && Number(subDept) === Number(user.department_id)
    }
    if (section.signer === 'director' && user.role === 'dept_admin') return true
    if (section.signer === 'dg' && user.role === 'head_of_agency') return true
    return false
  }

  const handleSign = async (section) => {
    setSigning(section.key)
    try {
      const payload = { section_key: section.key, remarks }
      if (section.signer === 'secretary') payload.approved = secretaryApproved
      await api.post(`/submissions/${submissionId}/sign-travel-section/`, payload)
      toast.success(`Signed: ${section.label}`)
      setRemarks('')
      await load()
      onSigned?.()
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Could not sign this section.')
    } finally {
      setSigning(null)
    }
  }

  const isSecretary = user && ['psc_secretary', 'psc_admin', 'senior_admin_officer'].includes(user.role)
  const draftStage = submission.current_stage === 'draft' || submission.current_stage === 'returned_for_clarification'
  const secretaryStage = submission.current_stage === 'secretary_review'

  return (
    <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-sky-900 dark:text-sky-100">Travel endorsements</h3>
        <p className="text-xs text-sky-800/80 dark:text-sky-200/80 mt-0.5">
          Endorsements depend on who lodged the form (4.4: department head or DG only;
          4.5/4.6: department head and/or DG). Then ODU Manager review and Secretary decision.
          Forms 4.5 &amp; 4.6 receive an official letter after Secretary approval.
        </p>
      </div>
      <ul className="space-y-2">
        {data.sections.map(section => {
          const done = signedMap[section.key]
          const showSign = !done && canSign(section) && (
            (section.signer !== 'secretary' && draftStage) ||
            (section.signer === 'secretary' && secretaryStage && isSecretary)
          )
          return (
            <li key={section.key} className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{section.label}</p>
                {done ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                    <CheckCircle2 size={14} /> Signed by {done.signer_name} · {new Date(done.signed_at).toLocaleString()}
                    {done.approved === false && ' · Not approved'}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-0.5">Awaiting signature</p>
                )}
              </div>
              {showSign && (
                <div className="flex flex-col items-end gap-2">
                  {section.signer === 'secretary' && (
                    <label className="text-xs flex items-center gap-2">
                      <input type="checkbox" checked={secretaryApproved} onChange={e => setSecretaryApproved(e.target.checked)} />
                      Approve travel
                    </label>
                  )}
                  <input
                    className="input text-xs max-w-xs"
                    placeholder="Remarks (optional)"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={signing === section.key}
                    onClick={() => handleSign(section)}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    <PenLine size={13} /> Sign with my profile signature
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {submission.requires_travel_letter && submission.current_stage === 'approved' && (
        <TravelLetterDownload submissionId={submissionId} />
      )}
    </div>
  )
}

function TravelLetterDownload({ submissionId }) {
  const [letter, setLetter] = useState(null)
  useEffect(() => {
    api.get(`/submissions/${submissionId}/travel-approval-letter/`).then(r => setLetter(r.data)).catch(() => {})
  }, [submissionId])
  if (!letter) return null
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm">
      <p className="font-medium text-emerald-900 dark:text-emerald-100">Official approval letter issued</p>
      <p className="text-xs text-emerald-800 dark:text-emerald-200 mt-1">{letter.subject}</p>
      <pre className="mt-2 text-xs whitespace-pre-wrap font-serif text-slate-800 dark:text-slate-200 max-h-48 overflow-auto">{letter.body_text}</pre>
    </div>
  )
}

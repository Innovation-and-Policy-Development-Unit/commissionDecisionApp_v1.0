import { useState, useEffect, useCallback } from 'react'
import { Users, BrainCircuit } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import Modal from '../../components/shared/Modal'
import BaseInput from '../../components/shared/BaseInput'
import BaseButton from '../../components/shared/BaseButton'
import BaseBadge from '../../components/shared/BaseBadge'
import BaseSpinner from '../../components/shared/BaseSpinner'
import { useToast } from '../../context/ToastContext'

export default function WorkloadDashboard() {
  const toast = useToast()
  const [officers, setOfficers] = useState([])
  const [loading, setLoading] = useState(true)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [suggestionLoading, setSuggestionLoading] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const [submissionId, setSubmissionId] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.get('/workload/officers/')
      setOfficers(res.data.officers || [])
    } catch (e) {
      console.error('Workload error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSuggest = async () => {
    if (!submissionId) { toast.error('Enter a submission ID.'); return }
    setSuggestionLoading(true)
    setSuggestion(null)
    try {
      const res = await api.post('/workload/suggest-assignment/', { submission_id: parseInt(submissionId) })
      setSuggestion(res.data)
    } catch (e) {
      toast.error('AI suggestion failed: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setSuggestionLoading(false)
    }
  }

  const getLoadColor = (count) => (count >= 10 ? 'danger' : count >= 6 ? 'warning' : 'success')

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto pb-10">
      <PageHeader title="Workload Dashboard" subtitle="Monitor officer workload and get AI-powered assignment suggestions" />

      <div className="flex gap-3 justify-end">
        <BaseButton icon={<BrainCircuit size={15} />} variant="primary" onClick={() => setAssignDialogOpen(true)}>AI Smart Assignment</BaseButton>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <Users size={20} className="text-primary-500" />
          <span className="font-bold text-slate-800 dark:text-slate-100">PSC Officer Workload</span>
        </div>
        {loading ? (
          <div className="text-center p-10"><BaseSpinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Officer</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Active Submissions</th>
                  <th className="px-3 py-2">Load Level</th>
                </tr>
              </thead>
              <tbody>
                {officers.map(o => (
                  <tr key={o.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 text-slate-700 dark:text-slate-300">
                    <td className="px-3 py-2">
                      <span className="font-semibold block text-slate-800 dark:text-slate-100">{o.full_name}</span>
                      <span className="block text-[10px] text-slate-500">@{o.username}</span>
                    </td>
                    <td className="px-3 py-2">{o.role}</td>
                    <td className="px-3 py-2 font-bold text-base text-slate-800 dark:text-slate-100">{o.active_submission_count}</td>
                    <td className="px-3 py-2">
                      <BaseBadge color={getLoadColor(o.active_submission_count)} size="small">
                        {o.active_submission_count >= 10 ? 'Overloaded' : o.active_submission_count >= 6 ? 'Heavy' : 'Available'}
                      </BaseBadge>
                    </td>
                  </tr>
                ))}
                {officers.length === 0 && <tr><td colSpan={4} className="p-6 text-slate-500">No officers found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        title="AI Smart Assignment"
        footer={<BaseButton variant="secondary" onClick={() => setAssignDialogOpen(false)}>Close</BaseButton>}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Enter a submission ID to get an AI-powered assignment recommendation based on form type, ministry, and officer workload.
          </p>
          <BaseInput label="Submission ID" required type="number" value={submissionId}
            onChange={e => setSubmissionId(e.target.value)} placeholder="Enter submission ID" />
          <BaseButton
            icon={suggestionLoading ? <BaseSpinner size="sm" label="" /> : <BrainCircuit size={15} />}
            variant="primary" onClick={handleSuggest} disabled={suggestionLoading}>
            {suggestionLoading ? 'Analysing…' : 'Get Suggestion'}
          </BaseButton>
          {suggestion && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
              <span className="font-bold text-slate-800 dark:text-slate-100">Recommended Officer</span>
              <p className="mt-2 font-semibold text-slate-800 dark:text-slate-100">{suggestion.recommended_officer || suggestion.officer_username || '—'}</p>
              {suggestion.reasoning && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{suggestion.reasoning}</p>}
              {suggestion.confidence_score != null && <BaseBadge color="success" size="small" className="mt-2">{suggestion.confidence_score}% confidence</BaseBadge>}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

/**
 * CommissionerAssistant.jsx
 * The commissioner-facing AI block on a submission: the review card and the
 * per-paper chat side by side. A question picked on the card fills the chat box.
 */
import { useState, useCallback } from 'react'
import CommissionerReviewCard from './CommissionerReviewCard'
import CaseChatPanel from './CaseChatPanel'
import CaseChatLog from './CaseChatLog'

// Mirrors _CASE_ASSISTANT_ROLES in backend/tracker/views.py.
export const CASE_ASSISTANT_ROLES = [
  'psc_commissioner', 'chairperson', 'psc_admin', 'psc_secretary', 'psc_officer',
]

// Mirrors the role check in submission_case_chat_log (backend/tracker/views.py).
const LOG_ROLES = ['psc_secretary', 'psc_admin']

export default function CommissionerAssistant({ submissionId, role }) {
  const [draft, setDraft] = useState('')
  const clearDraft = useCallback(() => setDraft(''), [])
  return (
    <div className="flex flex-col gap-4">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: '16px' }}>
        <CommissionerReviewCard submissionId={submissionId} onAsk={setDraft} />
        <CaseChatPanel submissionId={submissionId} draft={draft} onDraftUsed={clearDraft} />
      </div>
      {LOG_ROLES.includes(role) && <CaseChatLog submissionId={submissionId} />}
    </div>
  )
}

import { useEffect, useState } from 'react'
import Modal from '../shared/Modal'
import BaseButton from '../shared/BaseButton'
import BaseMessageBar from '../shared/BaseMessageBar'

const todayIso = () => new Date().toISOString().slice(0, 10)

/**
 * HR attests that the Director-General has signed the paper (on paper, outside
 * SCDMS) before it goes to PSC. The name and date are saved on the submission
 * and in its audit trail; the DG is told by email that it went in under their name.
 */
export default function DgApprovalDialog({ open, initialName = '', busy = false, error = '', onConfirm, onCancel }) {
  const [name, setName] = useState(initialName)
  const [signedOn, setSignedOn] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (open) { setName(initialName); setSignedOn(''); setConfirmed(false) }
  }, [open, initialName])

  const ready = name.trim() && signedOn && confirmed

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onCancel}
      size="sm"
      title="Director-General approval"
      subtitle="Your DG signs the paper on paper; you upload the signed copy."
      footer={(
        <div className="flex justify-end gap-2">
          <BaseButton variant="outline" onClick={onCancel} disabled={busy}>Cancel</BaseButton>
          <BaseButton
            variant="primary"
            onClick={() => onConfirm({ dg_approval_name: name.trim(), dg_approval_date: signedOn })}
            disabled={!ready || busy}
            loading={busy}
            loadingLabel="Submitting"
          >
            Submit to PSC
          </BaseButton>
        </div>
      )}
    >
      <div className="space-y-4">
        {error && <BaseMessageBar intent="error">{error}</BaseMessageBar>}
        <div>
          <label htmlFor="dg-approval-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Director-General who signed *
          </label>
          <input
            id="dg-approval-name"
            className="input text-sm"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={255}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="dg-approval-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Date signed *
          </label>
          <input
            id="dg-approval-date"
            type="date"
            className="input text-sm"
            value={signedOn}
            max={todayIso()}
            onChange={e => setSignedOn(e.target.value)}
          />
        </div>
        <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="mt-0.5 w-4 h-4 rounded"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
          />
          <span>
            I confirm the Director-General has signed this paper and the signed copy is uploaded.
            The DG will be emailed that it was submitted under their approval.
          </span>
        </label>
      </div>
    </Modal>
  )
}

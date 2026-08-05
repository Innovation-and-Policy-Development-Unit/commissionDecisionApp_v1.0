import { useState } from 'react'
import {
  Send, CheckCircle2, RotateCcw, ClipboardCheck, ClipboardList,
  PlayCircle, ArrowRight, Clock, XCircle, Users, AlertTriangle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import BaseButton from '../shared/BaseButton'
import BaseTextarea from '../shared/BaseTextarea'
import BaseMessageBar from '../shared/BaseMessageBar'

/**
 * Stage-based action buttons that replace the generic "Move to Next Stage" dropdown.
 *
 * Buttons are determined solely by submission.current_stage so that
 * admin/superuser see the same actions as the role responsible at that stage.
 * Permission enforcement happens server-side; the `allowed` list and `canEndorse`
 * flag from the bootstrap payload gate which buttons actually appear.
 */

// ── Stage → action definitions ───────────────────────────────────────────────
// transitionTo: target stage code sent to the standard /transition/ endpoint
// endpoint: custom API path (e.g. 'endorse') — uses POST /submissions/{id}/{endpoint}/
// requiresNote: opens an inline textarea before executing
// variant: BaseButton variant
const STAGE_ACTIONS = {
  draft: [
    {
      id: 'submit_to_dg',
      label: 'Submit to DG',
      description: 'Send to Director-General for endorsement',
      icon: Send,
      variant: 'primary',
      transitionTo: 'pending_dg_endorsement',
      requiresNote: false,
    },
  ],

  // OPSC-internal submissions that follow the normal PSC route (e.g. CSU/ODU
  // appointing OPSC staff) have no Director-General in their workflow — a
  // draft goes straight to Submitted, same as a receptionist-lodged paper.
  draft_internal: [
    {
      id: 'submit',
      label: 'Submit',
      description: 'Submit for registration and routing to the responsible unit',
      icon: Send,
      variant: 'primary',
      transitionTo: 'submitted',
      requiresNote: false,
    },
  ],

  pending_dg_endorsement: [
    {
      id: 'endorse',
      label: 'Endorse',
      description: 'Approve and forward directly to PSC',
      icon: CheckCircle2,
      variant: 'primary',
      endpoint: 'endorse',
      requiresNote: false,
    },
    {
      id: 'return_to_hr',
      label: 'Return to HR',
      description: 'Request revisions from HR',
      icon: RotateCcw,
      variant: 'outline',
      transitionTo: 'draft',
      requiresNote: true,
      notePlaceholder: 'Describe what changes are needed before you can endorse this submission…',
      noteLabel: 'Feedback for HR',
    },
  ],

  // Fallback — shouldn't normally show with Option A (endorse auto-forwards to submitted)
  dg_approved: [
    {
      id: 'submit_to_psc',
      label: 'Submit to PSC',
      description: 'Forward the endorsed submission to PSC for processing',
      icon: Send,
      variant: 'primary',
      transitionTo: 'submitted',
      requiresNote: false,
    },
  ],

  returned_for_clarification: [
    {
      id: 'resubmit',
      label: 'Resubmit',
      description: 'Re-send to PSC after addressing the clarification',
      icon: Send,
      variant: 'primary',
      transitionTo: 'submitted',
      requiresNote: false,
    },
  ],

  deferred_back_to_hr: [
    {
      id: 'resubmit_to_dg',
      label: 'Re-submit to DG',
      description: 'Return to DG for re-endorsement after addressing feedback',
      icon: Send,
      variant: 'primary',
      transitionTo: 'pending_dg_endorsement',
      requiresNote: false,
    },
  ],

  submitted: [
    {
      id: 'receive',
      label: 'Receive & Register',
      description: 'Acknowledge receipt and begin PSC registration',
      icon: ClipboardCheck,
      variant: 'primary',
      transitionTo: 'received_by_psc',
      requiresNote: false,
    },
    {
      id: 'return_clarification',
      label: 'Return for Clarification',
      description: 'Send back to ministry with a clarification request',
      icon: RotateCcw,
      variant: 'outline',
      transitionTo: 'returned_for_clarification',
      requiresNote: true,
      notePlaceholder: 'Describe what clarification is needed from the ministry…',
      noteLabel: 'Clarification request',
    },
  ],

  received_by_psc: [
    {
      id: 'register_route',
      label: 'Register & Route',
      description: 'Register the submission and route it to the relevant PSC unit',
      icon: ClipboardList,
      variant: 'primary',
      transitionTo: 'registered_routed',
      requiresNote: false,
    },
    {
      id: 'return_clarification_intake',
      label: 'Return for Clarification',
      description: 'Request additional information from the ministry',
      icon: RotateCcw,
      variant: 'outline',
      transitionTo: 'returned_for_clarification',
      requiresNote: true,
      notePlaceholder: 'Describe what clarification is needed…',
      noteLabel: 'Clarification request',
    },
  ],

  registered_routed: [
    {
      id: 'begin_assessment',
      label: 'Begin Assessment',
      description: 'Move to assessment phase and start the SLA timer',
      icon: PlayCircle,
      variant: 'primary',
      transitionTo: 'under_assessment',
      requiresNote: false,
    },
  ],

  manager_checklist_review: [
    {
      id: 'approve_route',
      label: 'Approve & Route for Assessment',
      description: 'Checklist is satisfactory — forward for full assessment',
      icon: CheckCircle2,
      variant: 'primary',
      transitionTo: 'under_assessment',
      requiresNote: false,
    },
    {
      id: 'return_checklist',
      label: 'Return for Revision',
      description: 'Send back for additional documents or corrections',
      icon: RotateCcw,
      variant: 'outline',
      transitionTo: 'returned_for_clarification',
      requiresNote: true,
      notePlaceholder: 'Describe what needs to be corrected or added…',
      noteLabel: 'Revision request',
    },
  ],

  under_assessment: [
    {
      id: 'submit_to_secretary',
      label: 'Submit to Secretary',
      description: 'Assessment complete — submit to PSC Secretary for approval',
      icon: ArrowRight,
      variant: 'primary',
      transitionTo: 'pending_secretary_approval',
      requiresNote: false,
    },
    {
      id: 'defer',
      label: 'Defer',
      description: 'Hold pending further information or decision',
      icon: Clock,
      variant: 'outline',
      transitionTo: 'deferred',
      requiresNote: true,
      notePlaceholder: 'Reason for deferral…',
      noteLabel: 'Deferral reason',
    },
    {
      id: 'return_clarification_assess',
      label: 'Return for Clarification',
      description: 'Request additional information from the ministry',
      icon: RotateCcw,
      variant: 'outline',
      transitionTo: 'returned_for_clarification',
      requiresNote: true,
      notePlaceholder: 'Describe what clarification is needed…',
      noteLabel: 'Clarification request',
    },
  ],

  // Secretary reviews completed assessment before forwarding to Commission.
  // Only psc_secretary / psc_admin will have 'forwarded_to_commission' in their allowed list.
  pending_secretary_approval: [
    {
      id: 'forward_commission',
      label: 'Forward to Commission',
      description: 'Approve assessment — forward to Commission queue',
      icon: ArrowRight,
      variant: 'primary',
      transitionTo: 'forwarded_to_commission',
      requiresNote: false,
    },
    {
      id: 'return_to_assessment',
      label: 'Return to Assessment',
      description: 'Send back to OPSC unit for further review',
      icon: RotateCcw,
      variant: 'outline',
      transitionTo: 'under_assessment',
      requiresNote: true,
      notePlaceholder: 'Describe what needs to be addressed before forwarding…',
      noteLabel: 'Return reason',
    },
    {
      id: 'defer_sec',
      label: 'Defer',
      description: 'Hold pending further information or decision',
      icon: Clock,
      variant: 'outline',
      transitionTo: 'deferred',
      requiresNote: true,
      notePlaceholder: 'Reason for deferral…',
      noteLabel: 'Deferral reason',
    },
  ],

  forwarded_to_commission: [
    {
      id: 'commission_sitting',
      label: 'Add to Commission Sitting',
      description: 'Place on the agenda for the next Commission sitting',
      icon: Users,
      variant: 'primary',
      transitionTo: 'commission_sitting',
      requiresNote: false,
    },
  ],

  commission_sitting: [
    {
      id: 'approve',
      label: 'Approve',
      description: 'Commission resolves to approve this submission',
      icon: CheckCircle2,
      variant: 'primary',
      transitionTo: 'approved',
      requiresNote: false,
    },
    {
      id: 'noted',
      label: 'Noted',
      description: 'Commission notes the matter — recorded, no further action',
      icon: ClipboardCheck,
      variant: 'outline',
      transitionTo: 'noted',
      requiresNote: false,
    },
    {
      id: 'not_approved',
      label: 'Not Approved',
      description: 'Commission declines the request (not a formal rejection)',
      icon: XCircle,
      variant: 'outline',
      transitionTo: 'not_approved',
      requiresNote: true,
      notePlaceholder: 'Record the Commission reason for not approving…',
      noteLabel: 'Reason',
    },
    {
      id: 'reject',
      label: 'Reject',
      description: 'Commission resolves to reject this submission',
      icon: XCircle,
      variant: 'danger',
      transitionTo: 'rejected',
      requiresNote: true,
      notePlaceholder: 'Record the Commission reason for rejection…',
      noteLabel: 'Rejection reason',
    },
    {
      id: 'defer_back_to_unit',
      label: 'Deferred Back to Unit',
      description: 'Send back to the responsible OPSC unit for further work',
      icon: RotateCcw,
      variant: 'outline',
      transitionTo: 'deferred_back_to_unit',
      requiresNote: true,
      notePlaceholder: 'Describe what the unit needs to address…',
      noteLabel: 'Instruction to unit',
    },
    {
      id: 'defer_next_meeting',
      label: 'Defer to Next Meeting',
      description: 'Carry to the next sitting — appears under Matters Arising',
      icon: Clock,
      variant: 'outline',
      transitionTo: 'matters_arising',
      requiresNote: true,
      notePlaceholder: 'Reason for deferring to the next meeting…',
      noteLabel: 'Deferral reason',
    },
    {
      id: 'return_ministry',
      label: 'Return to Ministry',
      description: 'Return with feedback for the submitting ministry',
      icon: RotateCcw,
      variant: 'outline',
      transitionTo: 'returned',
      requiresNote: true,
      notePlaceholder: 'Record the Commission reason for returning this matter…',
      noteLabel: 'Return reason',
    },
  ],
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function WorkflowActionsPanel({
  submission,
  allowed = [],        // array of target stage strings from backend
  canEndorse = false,  // explicit flag from backend for the DG endorse action
  onTransition,        // async fn(targetStage, remarks, acknowledgeGaps?)
  onEndorse,           // async fn() — calls /submissions/{id}/endorse/
  busy = false,
  error,
  setError,
}) {
  const { t } = useTranslation()
  const [activeAction, setActiveAction] = useState(null) // action requiring a note
  const [note, setNote] = useState('')
  const [localBusy, setLocalBusy] = useState(false)

  const stage = submission?.current_stage
  const isNormalRouteInternal = !!(submission?.is_internal && submission?.follows_normal_route)
  const stageActions = (stage === 'draft' && isNormalRouteInternal)
    ? STAGE_ACTIONS.draft_internal
    : (STAGE_ACTIONS[stage] ?? [])

  // Filter to only actions the current user is allowed to perform
  const visibleActions = stageActions
    .filter(action => {
      if (action.endpoint === 'endorse') return canEndorse
      return allowed.includes(action.transitionTo)
    })
    .map(action => ({ ...action, Icon: action.icon }))

  if (visibleActions.length === 0) return null

  const executing = busy || localBusy

  const execute = async (action, remarks = '') => {
    setLocalBusy(true)
    setError?.('')
    try {
      if (action.endpoint === 'endorse') {
        await onEndorse()
      } else {
        await onTransition(action.transitionTo, remarks)
      }
      setActiveAction(null)
      setNote('')
    } catch (err) {
      // onTransition / onEndorse already set error via setError
    } finally {
      setLocalBusy(false)
    }
  }

  const handleClick = (action) => {
    if (action.requiresNote) {
      setActiveAction(action)
      setNote('')
      setError?.('')
    } else {
      execute(action)
    }
  }

  const handleConfirm = () => {
    if (!note.trim()) {
      setError?.(`${activeAction.noteLabel || 'Note'} is required.`)
      return
    }
    execute(activeAction, note)
  }

  return (
    <div className="card card-compact space-y-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        {t('workflow.actions_title', { defaultValue: 'Actions' })}
      </h3>

      {error && (
        <BaseMessageBar intent="error">{error}</BaseMessageBar>
      )}

      {/* Action buttons — hidden while a note-required action is active */}
      {!activeAction && (
        <div className="flex flex-col gap-2">
          {visibleActions.map(action => (
            <div key={action.id}>
              <BaseButton
                variant={action.variant}
                className="w-full justify-start"
                icon={<action.Icon size={15} />}
                onClick={() => handleClick(action)}
                disabled={executing}
                loading={executing && !activeAction}
                loadingLabel="Saving"
              >
                {action.label}
              </BaseButton>
              {action.description && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 ml-1">
                  {action.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inline note form for actions that require a reason */}
      {activeAction && (() => {
        const ActiveIcon = activeAction.icon
        return (
        <div className="space-y-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {activeAction.label}
            </p>
          </div>
          <BaseTextarea
            label={activeAction.noteLabel || 'Note'}
            required
            rows={3}
            placeholder={activeAction.notePlaceholder}
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <BaseButton
              variant="primary"
              onClick={handleConfirm}
              loading={executing}
              loadingLabel="Saving"
              disabled={!note.trim()}
              icon={!executing ? <ActiveIcon size={14} /> : undefined}
            >
              Confirm: {activeAction.label}
            </BaseButton>
            <BaseButton
              variant="ghost"
              onClick={() => { setActiveAction(null); setNote(''); setError?.('') }}
              disabled={executing}
            >
              Cancel
            </BaseButton>
          </div>
        </div>
        )
      })()}
    </div>
  )
}

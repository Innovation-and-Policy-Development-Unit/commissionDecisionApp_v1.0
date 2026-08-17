import { useState } from 'react'
import {
  Send, CheckCircle2, RotateCcw, ClipboardCheck, ClipboardList,
  PlayCircle, ArrowRight, Clock, XCircle, Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import BaseButton from '../shared/BaseButton'
import BaseMessageBar from '../shared/BaseMessageBar'
import RichNoteModal from '../shared/RichNoteModal'

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
    // Internal (OPSC-unit) drafts that route through a manager-approval step
    // before the Secretary — e.g. Compliance Principal/Senior, VIPAM Principal.
    {
      id: 'submit_for_manager_approval',
      label: 'Submit for Manager Approval',
      description: 'Send to your unit manager for review before it goes to the Secretary',
      icon: Send,
      variant: 'primary',
      transitionTo: 'pending_manager_approval',
      requiresNote: false,
    },
    // Internal (OPSC-unit) drafts that route straight to the Secretary —
    // e.g. Compliance Manager's own draft, secretary-only travel forms.
    {
      id: 'submit_internal',
      label: 'Submit',
      description: 'Send directly to the Secretary for review',
      icon: Send,
      variant: 'primary',
      transitionTo: 'submitted',
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

  // Manager-approval gate for internal (OPSC-unit) submissions — e.g.
  // Compliance Manager reviewing a Principal/Senior-created submission.
  pending_manager_approval: [
    {
      id: 'approve_to_secretary',
      label: 'Approve & Send to Secretary',
      description: 'Approve and forward to the Secretary for review',
      icon: CheckCircle2,
      variant: 'primary',
      transitionTo: 'submitted',
      requiresNote: false,
    },
    {
      id: 'return_for_changes',
      label: 'Return for Changes',
      description: 'Send back to the drafter for changes',
      icon: RotateCcw,
      variant: 'outline',
      transitionTo: 'draft',
      requiresNote: true,
      notePlaceholder: 'Describe what changes are needed…',
      noteLabel: 'Feedback',
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
      id: 'submit_to_secretary',
      label: 'Submit to Secretary',
      description: 'Checklist is satisfactory — forward to the Secretary',
      icon: Send,
      variant: 'primary',
      transitionTo: 'pending_secretary_approval',
      requiresNote: false,
      requiresChecklistComplete: true,
    },
    {
      id: 'return_checklist',
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
      label: 'Mark as Sitting for Commission Decision',
      description: 'Requires this submission to already be scheduled on a meeting’s agenda via Sitting Workspace',
      icon: Users,
      variant: 'primary',
      transitionTo: 'commission_sitting',
      requiresNote: false,
      requiresAgendaPlacement: true,
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

// ── Status strip tone → color classes (used above the action buttons) ──────
const STATUS_TONE_CLASSES = {
  waiting: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  ready: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  pending: 'bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300',
}

// Travel submissions (secretary_only) skip the Secretary Approval Gate and go
// straight from Manager Checklist Review into Secretary Review — where
// TravelEndorsementPanel handles the actual sign-off — instead of the normal
// workflow's pending_secretary_approval. Same buttons, different target stage.
const SECRETARY_ONLY_MANAGER_CHECKLIST_ACTIONS = STAGE_ACTIONS.manager_checklist_review.map(
  action => action.id === 'submit_to_secretary'
    ? { ...action, transitionTo: 'secretary_review' }
    : action
)

// ── Component ─────────────────────────────────────────────────────────────────
export default function WorkflowActionsPanel({
  submission,
  allowed = [],        // array of target stage strings from backend
  canEndorse = false,  // explicit flag from backend for the DG endorse action
  checklist = [],       // current submission's checklist items — gates "Submit to Secretary"
  onTransition,        // async fn(targetStage, remarks, acknowledgeGaps?)
  onEndorse,           // async fn() — calls /submissions/{id}/endorse/
  busy = false,
  error,
  setError,
}) {
  const { t } = useTranslation()
  const [activeAction, setActiveAction] = useState(null) // action requiring a note
  const [localBusy, setLocalBusy] = useState(false)

  const stage = submission?.current_stage
  const isNormalRouteInternal = !!(submission?.is_internal && submission?.follows_normal_route)
  const stageActions = (stage === 'draft' && isNormalRouteInternal)
    ? STAGE_ACTIONS.draft_internal
    : (stage === 'manager_checklist_review' && submission?.secretary_only)
    ? SECRETARY_ONLY_MANAGER_CHECKLIST_ACTIONS
    : (STAGE_ACTIONS[stage] ?? [])

  // Every required checklist item (mandatory_for_stage set — i.e. not one of
  // the informational-only items) must be marked present before "Submit to
  // Secretary" is clickable. Matches the backend's own re-verification gate
  // for this transition (see the Manager Checklist Review gate in views.py).
  const checklistComplete = (checklist || [])
    .filter(item => !!item.mandatory_for_stage)
    .every(item => item.is_present)

  // If the manager has allocated this submission to a principal/senior
  // officer, the manager's own stage-advancing actions don't make sense until
  // that assignee has finished their work and handed it back via "Submit to
  // Manager" (sets ready_for_manager_at). Matches the backend gate in
  // views.py's transition() action.
  const awaitingAssignedReview = (
    (stage === 'manager_checklist_review' || stage === 'under_assessment')
    && !!submission?.assigned_to
    && !submission?.ready_for_manager_at
  )

  // ── At-a-glance status strip ────────────────────────────────────────────
  // Same "who's turn is it" + "how much is done" summary for every role —
  // General Manager, OPSC Unit Manager, Secretary, etc. — instead of making
  // each one infer status from a disabled button's tooltip.
  const assignedName = submission?.assigned_to_name || 'the assigned principal'
  const isHandoffStage = stage === 'manager_checklist_review' || stage === 'under_assessment'
  const mandatoryChecklistItems = (checklist || []).filter(item => !!item.mandatory_for_stage)
  const checklistDoneCount = mandatoryChecklistItems.filter(item => item.is_present).length
  const checklistTotalCount = mandatoryChecklistItems.length

  const statusItems = []
  if (isHandoffStage && submission?.assigned_to) {
    if (!submission?.ready_for_manager_at) {
      statusItems.push({
        Icon: Clock,
        tone: 'waiting',
        text: `Waiting on ${assignedName} to complete their review`,
      })
    } else {
      const handedBackDate = new Date(submission.ready_for_manager_at).toLocaleDateString('en-VU', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
      statusItems.push({
        Icon: CheckCircle2,
        tone: 'ready',
        text: `${assignedName} submitted this back on ${handedBackDate} — ready for your review`,
      })
    }
  }
  if (checklistTotalCount > 0) {
    statusItems.push({
      Icon: ClipboardList,
      tone: checklistDoneCount === checklistTotalCount ? 'ready' : 'pending',
      text: `${checklistDoneCount} of ${checklistTotalCount} required documents complete`,
    })
  }

  // Filter to only actions the current user is allowed to perform
  const visibleActions = stageActions
    .filter(action => {
      if (action.endpoint === 'endorse') return canEndorse
      return allowed.includes(action.transitionTo)
    })
    .map(action => ({
      ...action,
      Icon: action.icon,
      disabledReason: awaitingAssignedReview
        ? 'Waiting for the assigned principal to complete their review and submit it back to you.'
        : (action.requiresChecklistComplete && !checklistComplete)
        ? 'Complete the checklist — mark every required document present — before submitting to the Secretary.'
        : (action.requiresAgendaPlacement && !submission?.on_commission_agenda)
        ? 'Not yet scheduled — use Meetings → Sitting Workspace to place this submission on a meeting’s agenda first.'
        : null,
    }))

  if (visibleActions.length === 0) return null

  const executing = busy || localBusy

  const execute = async (action, remarksHtml = '') => {
    setLocalBusy(true)
    setError?.('')
    try {
      if (action.endpoint === 'endorse') {
        await onEndorse()
      } else {
        await onTransition(action.transitionTo, remarksHtml)
      }
      setActiveAction(null)
    } catch (err) {
      // onTransition / onEndorse already set error via setError
    } finally {
      setLocalBusy(false)
    }
  }

  const handleClick = (action) => {
    if (action.requiresNote) {
      setActiveAction(action)
      setError?.('')
    } else {
      execute(action)
    }
  }

  return (
    <div className="card card-compact space-y-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        {t('workflow.actions_title', { defaultValue: 'Actions' })}
      </h3>

      {statusItems.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {statusItems.map((item, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium ${STATUS_TONE_CLASSES[item.tone]}`}
            >
              <item.Icon size={13} className="shrink-0" />
              {item.text}
            </div>
          ))}
        </div>
      )}

      {error && (
        <BaseMessageBar intent="error">{error}</BaseMessageBar>
      )}

      <div className="flex flex-col gap-2">
        {visibleActions.map(action => (
          <div key={action.id} title={action.disabledReason || undefined}>
            <BaseButton
              variant={action.variant}
              className="w-full justify-start"
              icon={<action.Icon size={15} />}
              onClick={() => handleClick(action)}
              disabled={executing || !!action.disabledReason}
              loading={executing && activeAction?.id === action.id}
              loadingLabel="Saving"
            >
              {action.label}
            </BaseButton>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 ml-1">
              {action.disabledReason || action.description}
            </p>
          </div>
        ))}
      </div>

      <RichNoteModal
        open={!!activeAction}
        submissionId={submission?.id}
        action={activeAction}
        busy={executing}
        error={error}
        onConfirm={(html) => execute(activeAction, html)}
        onCancel={() => { setActiveAction(null); setError?.('') }}
      />
    </div>
  )
}

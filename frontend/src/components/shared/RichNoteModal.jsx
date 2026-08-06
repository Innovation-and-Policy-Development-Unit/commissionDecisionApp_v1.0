import { useRef, useState } from 'react'
import Modal from './Modal'
import BaseButton from './BaseButton'
import BaseMessageBar from './BaseMessageBar'
import RichNoteEditor from './RichNoteEditor'

/**
 * Popup rich-text editor for workflow-transition remarks (Return for
 * Clarification, Defer, Reject, etc.) — replaces the inline plain textarea
 * so a manager can write a long paragraph and paste screenshots inline.
 * See RichNoteEditor for the editor/upload implementation.
 */
export default function RichNoteModal({
  open,
  submissionId,
  action,
  busy = false,
  error,
  onConfirm,
  onCancel,
}) {
  const [hasText, setHasText] = useState(false)
  const editorRef = useRef(null)

  if (!action) return null
  const ActionIcon = action.icon

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="lg"
      title={action.label}
      subtitle={action.noteLabel || 'Note'}
      footer={
        <>
          <BaseButton variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </BaseButton>
          <BaseButton
            variant="primary"
            onClick={() => onConfirm(editorRef.current?.getHTML() || '')}
            loading={busy}
            loadingLabel="Saving"
            disabled={!hasText}
            icon={!busy && ActionIcon ? <ActionIcon size={14} /> : undefined}
          >
            Confirm: {action.label}
          </BaseButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <BaseMessageBar intent="error">{error}</BaseMessageBar>}
        <RichNoteEditor
          ref={editorRef}
          submissionId={submissionId}
          placeholder={action.notePlaceholder}
          resetKey={open ? action.id : null}
          onHasTextChange={setHasText}
        />
      </div>
    </Modal>
  )
}

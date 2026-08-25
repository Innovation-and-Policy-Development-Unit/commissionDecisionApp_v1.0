import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../shared/Modal'
import BaseSelect from '../shared/BaseSelect'
import RichNoteEditor from '../shared/RichNoteEditor'
import { stageLabel, stageMeta } from '../../constants/stages'
import { ArrowRight } from 'lucide-react'

export default function SubmissionKanbanTransitionDialog({
  open,
  onClose,
  submission,
  targetStage: initialTarget,
  stageOptions,
  onConfirm,
  busy,
  error,
}) {
  const { t } = useTranslation()
  const [targetStage, setTargetStage] = useState(initialTarget || '')
  const editorRef = useRef(null)

  useEffect(() => {
    if (open) {
      setTargetStage(initialTarget || stageOptions[0] || '')
    }
  }, [open, initialTarget, stageOptions])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!targetStage) return
    onConfirm({ targetStage, remarksHtml: editorRef.current?.getHTML() || '' })
  }

  const showStagePicker = stageOptions.length > 1

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('submission.kanban.transition_title')}
      subtitle={
        submission
          ? `${submission.reference_number} — ${submission.title}`
          : undefined
      }
      footer={null}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {showStagePicker && (
          <BaseSelect
            label={t('submission.kanban.target_stage')}
            value={targetStage}
            onChange={(_e, v) => setTargetStage(v)}
            options={stageOptions.map((s) => ({
              value: s,
              label: stageLabel(s, t),
            }))}
            hint={targetStage ? stageMeta(targetStage).category : undefined}
          />
        )}
        {!showStagePicker && targetStage && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t('submission.kanban.moving_to')}{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {stageLabel(targetStage, t)}
            </span>
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('submission.kanban.remarks')}
          </label>
          <RichNoteEditor
            ref={editorRef}
            submissionId={submission?.id}
            placeholder={t('submission.kanban.remarks_placeholder')}
            resetKey={open}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('submission.kanban.remarks_hint')}
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn-outline text-sm"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={busy || !targetStage}
            className="btn-primary text-sm inline-flex items-center gap-2"
          >
            <ArrowRight size={14} />
            {busy ? t('submission.kanban.applying') : t('submission.kanban.apply')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

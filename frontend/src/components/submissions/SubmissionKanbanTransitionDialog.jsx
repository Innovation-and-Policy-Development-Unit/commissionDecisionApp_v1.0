import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../shared/Modal'
import BaseSelect from '../shared/BaseSelect'
import BaseTextarea from '../shared/BaseTextarea'
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
  const [remarks, setRemarks] = useState('')

  useEffect(() => {
    if (open) {
      setTargetStage(initialTarget || stageOptions[0] || '')
      setRemarks('')
    }
  }, [open, initialTarget, stageOptions])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!targetStage) return
    onConfirm({ targetStage, remarks })
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
        <BaseTextarea
          label={t('submission.kanban.remarks')}
          hint={t('submission.kanban.remarks_hint')}
          placeholder={t('submission.kanban.remarks_placeholder')}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
        />
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

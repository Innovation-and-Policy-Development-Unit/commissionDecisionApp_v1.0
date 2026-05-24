import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { Delete24Regular, Warning24Regular } from '@fluentui/react-icons'
import Modal from '../components/shared/Modal'
import BaseButton from '../components/shared/BaseButton'

const ConfirmContext = createContext(null)

function ConfirmDialog({ dialog, onResolve }) {
  if (!dialog) return null
  const {
    title,
    message,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    variant = 'danger',
  } = dialog

  const isDanger = variant === 'danger'

  return (
    <Modal
      open
      onClose={() => onResolve(false)}
      size="sm"
      title={title}
      footer={(
        <>
          <BaseButton variant="secondary" onClick={() => onResolve(false)}>
            {cancelLabel}
          </BaseButton>
          <BaseButton
            variant={isDanger ? 'danger' : 'primary'}
            onClick={() => onResolve(true)}
          >
            {confirmLabel}
          </BaseButton>
        </>
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isDanger
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
          }`}
          aria-hidden
        >
          {isDanger ? <Delete24Regular /> : <Warning24Regular />}
        </span>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
          {message}
        </p>
      </div>
    </Modal>
  )
}

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolverRef = useRef(null)

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setDialog(
        typeof options === 'string'
          ? { title: 'Are you sure?', message: options }
          : options,
      )
    })
  }, [])

  const handleResolve = useCallback((value) => {
    setDialog(null)
    resolverRef.current?.(value)
    resolverRef.current = null
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog dialog={dialog} onResolve={handleResolve} />
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx
}

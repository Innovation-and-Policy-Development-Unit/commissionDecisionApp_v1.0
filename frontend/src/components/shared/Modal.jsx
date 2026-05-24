import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogActions,
  Button,
} from '@fluentui/react-components'
import { Dismiss24Regular } from '@fluentui/react-icons'

const SIZES = {
  sm: '24rem',
  md: '32rem',
  lg: '42rem',
  xl: '56rem',
  full: '64rem',
}

/**
 * Accessible modal — Fluent UI Dialog (focus trap, Escape, ARIA).
 */
export default function Modal({
  open,
  onClose,
  size = 'md',
  title,
  subtitle,
  children,
  footer,
  panelClassName = '',
  closeLabel = 'Close dialog',
}) {
  const showHeader = Boolean(title || subtitle)

  return (
    <Dialog
      open={!!open}
      onOpenChange={(_event, data) => {
        if (!data.open) onClose()
      }}
    >
      <DialogSurface
        className={panelClassName}
        style={{ maxWidth: SIZES[size] || SIZES.md, maxHeight: '90vh' }}
      >
        <DialogBody>
          {showHeader && (
            <div className="flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0 pe-2 flex-1">
                {title && <DialogTitle>{title}</DialogTitle>}
                {subtitle && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
                )}
              </div>
              <Button
                appearance="subtle"
                icon={<Dismiss24Regular />}
                aria-label={closeLabel}
                onClick={onClose}
              />
            </div>
          )}
          <DialogContent className="overflow-y-auto flex-1">{children}</DialogContent>
                {footer && (
                  <DialogActions className="flex gap-2 justify-end flex-wrap">
                    {footer}
                  </DialogActions>
                )}
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

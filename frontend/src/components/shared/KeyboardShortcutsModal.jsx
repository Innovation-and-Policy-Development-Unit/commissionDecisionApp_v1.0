import { Keyboard } from 'lucide-react'
import { SHORTCUT_DEFS } from '../../hooks/useGlobalShortcuts'
import Modal from './Modal'

function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono text-[11px] font-semibold shadow-[0_1px_0_1px_rgba(0,0,0,.08)] dark:shadow-none">
      {children}
    </kbd>
  )
}

export default function KeyboardShortcutsModal({ open, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Keyboard shortcuts"
      closeLabel="Close keyboard shortcuts"
      panelClassName="max-w-md"
      footer={(
        <p className="text-[11px] text-slate-400 text-center">
          Press <Kbd>?</Kbd> at any time to toggle this panel
        </p>
      )}
    >
      <ul className="divide-y divide-slate-50 dark:divide-slate-700/50 -mx-1">
        {SHORTCUT_DEFS.map((def, i) => (
          <li
            key={i}
            className="flex items-center justify-between px-1 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
          >
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {def.description}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {def.keys.map((k, ki) => (
                <span key={ki} className="flex items-center gap-1">
                  {ki > 0 && (
                    <span className="text-slate-300 dark:text-slate-600 text-[10px]">then</span>
                  )}
                  <Kbd>{k}</Kbd>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

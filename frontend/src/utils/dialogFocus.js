/**
 * Focus management for modal dialogs (WCAG 2.4.3 / 2.1.2).
 *
 * `attachDialog` is a stable ref callback, so it can be dropped onto any
 * hand-rolled overlay — including ones rendered inside a conditional where a
 * hook can't be called. On mount it remembers the trigger, moves focus into the
 * dialog and traps Tab; on unmount it hands focus back to the trigger. Escape
 * activates the dialog's `[data-dialog-backdrop]` (or its "Close" button), so
 * it runs whatever close handler the overlay already has.
 */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

const stack = []

function focusables(node) {
  return [...node.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement)
}

function onKeyDown(e) {
  const node = e.currentTarget
  if (e.key === 'Escape') {
    const closer = (node.matches('[data-dialog-backdrop]') ? node : node.querySelector('[data-dialog-backdrop]')) || node.querySelector('[aria-label="Close"],[aria-label="Close dialog"]')
    if (closer) {
      e.stopPropagation()
      closer.click()
    }
    return
  }
  if (e.key !== 'Tab') return
  const items = focusables(node)
  if (!items.length) { e.preventDefault(); node.focus(); return }
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
    e.preventDefault(); last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus()
  }
}

export function attachDialog(node) {
  if (node) {
    stack.push({ node, trigger: document.activeElement })
    node.setAttribute('role', node.getAttribute('role') || 'dialog')
    node.setAttribute('aria-modal', 'true')
    if (!node.hasAttribute('tabindex')) node.tabIndex = -1
    node.style.outline = 'none'
    node.addEventListener('keydown', onKeyDown)
    if (!node.contains(document.activeElement)) {
      const target = node.querySelector('[autofocus],[data-autofocus]') || focusables(node).find(el => !el.matches('[aria-label="Close"],[aria-label="Close dialog"]')) || node
      target.focus({ preventScroll: true })
    }
  } else {
    const entry = stack.pop()
    if (entry) {
      entry.node.removeEventListener('keydown', onKeyDown)
      if (entry.trigger && document.contains(entry.trigger)) entry.trigger.focus({ preventScroll: true })
    }
  }
}

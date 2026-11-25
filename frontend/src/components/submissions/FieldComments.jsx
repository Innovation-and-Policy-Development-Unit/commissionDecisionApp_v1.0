import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageSquare, CheckCircle2, RotateCcw, Send } from 'lucide-react'
import {
  listFieldComments, createComment, resolveComment, reopenComment,
} from '../../api/comments'
import { useToast } from '../../context/ToastContext'
import BaseButton from '../shared/BaseButton'

/**
 * Field-level review comments on a digitized form.
 *
 * A reviewer (e.g. a Compliance Principal) comments on one field; the drafting
 * officer sees the comment under that field, replies, and the reviewer resolves
 * it. `useFieldComments` loads and mutates the threads; `FieldCommentBox` is the
 * control rendered under each field (via the form renderers' `renderFieldExtra`).
 */
export function useFieldComments(submissionId, { enabled, canStart, canReply }) {
  const toast = useToast()
  const target = `submission:${submissionId}`
  const [comments, setComments] = useState([])

  const refresh = useCallback(async () => {
    if (!enabled || !submissionId) return
    try {
      setComments(await listFieldComments(target))
    } catch {
      /* the form still works without comments */
    }
  }, [enabled, submissionId, target])

  useEffect(() => { refresh() }, [refresh])

  const byField = useMemo(() => {
    const map = {}
    for (const c of comments) {
      if (!c.field_key) continue
      ;(map[c.field_key] ||= []).push(c)
    }
    return map
  }, [comments])

  const openRoots = useMemo(
    () => comments.filter(c => !c.parent && !c.is_deleted && !c.resolved_at),
    [comments],
  )
  const docOpenCount = openRoots.filter(c => c.field_key.startsWith('document:')).length
  const openCount = openRoots.length - docOpenCount

  const run = async (fn, failMsg) => {
    try {
      await fn()
      await refresh()
      return true
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.response?.data?.body || failMsg)
      return false
    }
  }

  return {
    enabled, canStart, canReply, byField, openCount, docOpenCount,
    add: (fieldKey, body, parent = null) =>
      run(() => createComment({ target, body, fieldKey, parent }), 'Could not post the comment.'),
    resolve: id => run(() => resolveComment(id), 'Could not resolve the comment.'),
    reopen: id => run(() => reopenComment(id), 'Could not reopen the comment.'),
  }
}

function when(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-VU', { day: '2-digit', month: 'short' }) : ''
}

export function FieldCommentBox({ field, ctrl }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  if (!ctrl?.enabled) return null
  const all = ctrl.byField[field.field_key] || []
  const roots = all.filter(c => !c.parent && !c.is_deleted)
  if (roots.length === 0 && !ctrl.canStart) return null

  const openRoots = roots.filter(c => !c.resolved_at).length
  const canWrite = roots.length === 0 ? ctrl.canStart : ctrl.canReply

  const submit = async (parentId = null) => {
    const body = draft.trim()
    if (!body) return
    setBusy(true)
    const ok = await ctrl.add(field.field_key, body, parentId)
    setBusy(false)
    if (ok) setDraft('')
  }

  const label = roots.length === 0
    ? 'Add review comment'
    : openRoots > 0
      ? `${openRoots} open comment${openRoots > 1 ? 's' : ''}`
      : 'Comment resolved'

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
          openRoots > 0
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
            : roots.length > 0
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
        }`}
      >
        {roots.length > 0 && openRoots === 0
          ? <CheckCircle2 size={12} />
          : <MessageSquare size={12} />}
        {label}
      </button>

      {open && (
        <div className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-sm dark:border-amber-800/60 dark:bg-amber-950/20">
          {roots.map(root => {
            const replies = all.filter(c => c.parent === root.id && !c.is_deleted)
            return (
              <div key={root.id} className="mb-2.5 last:mb-0">
                {[root, ...replies].map(c => (
                  <div key={c.id} className={c.parent ? 'ml-4 mt-1.5' : ''}>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{c.author_name}</span>
                      {c.author_role_label ? ` · ${c.author_role_label}` : ''} · {when(c.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-100">{c.body}</p>
                  </div>
                ))}
                {root.resolved_at ? (
                  <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                    Resolved by {root.resolved_by_name} · {when(root.resolved_at)}
                    {root.is_author && (
                      <button type="button" className="ml-2 inline-flex items-center gap-0.5 underline" onClick={() => ctrl.reopen(root.id)}>
                        <RotateCcw size={10} /> Reopen
                      </button>
                    )}
                  </p>
                ) : root.is_author ? (
                  <button
                    type="button"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-700 underline dark:text-emerald-300"
                    onClick={() => ctrl.resolve(root.id)}
                  >
                    <CheckCircle2 size={11} /> Mark resolved
                  </button>
                ) : null}
                {canWrite && !root.resolved_at && (
                  <div className="mt-1.5 flex items-end gap-1.5">
                    <textarea
                      rows={2}
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      placeholder="Reply…"
                      aria-label={`Reply about ${field.label}`}
                      className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                    />
                    <BaseButton size="sm" variant="primary" loading={busy} icon={<Send size={12} />} onClick={() => submit(root.id)}>
                      Reply
                    </BaseButton>
                  </div>
                )}
              </div>
            )
          })}

          {roots.length === 0 && canWrite && (
            <div className="flex items-end gap-1.5">
              <textarea
                rows={2}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={`Comment on “${field.label}”…`}
                aria-label={`Comment on ${field.label}`}
                className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <BaseButton size="sm" variant="primary" loading={busy} icon={<Send size={12} />} onClick={() => submit(null)}>
                Post
              </BaseButton>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

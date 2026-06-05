import { useEffect, useMemo, useState, useCallback } from 'react'
import { MessageSquare, Lock, Pencil, Trash2, CornerDownRight, Send, X } from 'lucide-react'
import { listComments, createComment, updateComment, deleteComment } from '../../api/comments'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import BaseButton from '../shared/BaseButton'
import MentionInput from '../shared/MentionInput'
import MentionText from '../shared/MentionText'

// Ministry-side roles cannot post PSC-only (internal) notes.
const MINISTRY_SIDE_ROLES = ['ministry_hr', 'head_of_agency', 'traveller', 'dept_admin']

function initials(name) {
  return (name || '?').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
}

function timeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const secs = Math.round((Date.now() - then) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Avatar({ name, picture }) {
  return (
    <div className="w-8 h-8 shrink-0 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200 flex items-center justify-center text-[11px] font-semibold overflow-hidden">
      {picture ? <img src={picture} alt="" className="w-full h-full object-cover" /> : initials(name)}
    </div>
  )
}

function CommentItem({ comment, target, onEdit, onDelete, onReply, isReply = false }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [busy, setBusy] = useState(false)

  if (comment.is_deleted) {
    return (
      <div className={`flex gap-3 ${isReply ? 'ml-11' : ''}`}>
        <div className="w-8 h-8 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800" />
        <p className="text-xs italic text-slate-400 dark:text-slate-500 py-2">This comment was deleted.</p>
      </div>
    )
  }

  const saveEdit = async () => {
    const body = draft.trim()
    if (!body) return
    setBusy(true)
    try {
      await onEdit(comment.id, body)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`flex gap-3 ${isReply ? 'ml-11' : ''}`}>
      <Avatar name={comment.author_name} picture={comment.author_picture} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{comment.author_name || comment.author_username}</span>
          {comment.author_role_label && (
            <span className="text-[11px] text-slate-400">{comment.author_role_label}</span>
          )}
          {comment.is_internal && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Lock size={9} /> Internal
            </span>
          )}
          <span className="text-[11px] text-slate-400">· {timeAgo(comment.created_at)}</span>
          {comment.edit_count > 0 && <span className="text-[11px] text-slate-400">· edited</span>}
        </div>

        {editing ? (
          <div className="mt-1.5 space-y-2">
            <MentionInput value={draft} onChange={setDraft} target={target} onSubmit={saveEdit} rows={3} autoFocus />
            <div className="flex items-center gap-2">
              <BaseButton size="sm" variant="primary" loading={busy} onClick={saveEdit}>Save</BaseButton>
              <BaseButton size="sm" variant="ghost" icon={<X size={13} />} onClick={() => { setEditing(false); setDraft(comment.body) }}>Cancel</BaseButton>
            </div>
          </div>
        ) : (
          <MentionText body={comment.body} className="mt-0.5 text-sm text-slate-700 dark:text-slate-300" />
        )}

        {!editing && (
          <div className="mt-1 flex items-center gap-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {!isReply && (
              <button onClick={() => onReply(comment)} className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-primary-500">
                <CornerDownRight size={11} /> Reply
              </button>
            )}
            {comment.is_author && (
              <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-primary-500">
                <Pencil size={11} /> Edit
              </button>
            )}
            {comment.can_moderate && (
              <button onClick={() => onDelete(comment)} className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500">
                <Trash2 size={11} /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SubmissionComments({ submissionId }) {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const target = `submission:${submissionId}`

  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [posting, setPosting] = useState(false)

  const canPostInternal = !MINISTRY_SIDE_ROLES.includes(user?.role)

  const load = useCallback(async () => {
    if (!submissionId) return
    try {
      setComments(await listComments(target))
    } catch {
      /* non-critical */
    } finally {
      setLoading(false)
    }
  }, [submissionId, target])

  useEffect(() => { load() }, [load])

  // Group flat list into top-level threads with their replies.
  const threads = useMemo(() => {
    const tops = comments.filter((c) => !c.parent)
    const byParent = {}
    for (const c of comments) {
      if (c.parent) (byParent[c.parent] ||= []).push(c)
    }
    return tops.map((t) => ({ ...t, replies: byParent[t.id] || [] }))
  }, [comments])

  const submit = async () => {
    const text = body.trim()
    if (!text) return
    setPosting(true)
    try {
      await createComment({ target, body: text, isInternal, parent: replyTo?.id || null })
      setBody('')
      setIsInternal(false)
      setReplyTo(null)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.body?.[0] || 'Failed to post comment.')
    } finally {
      setPosting(false)
    }
  }

  const handleEdit = async (id, text) => {
    try {
      await updateComment(id, text)
      await load()
      toast.success('Comment updated.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update.')
    }
  }

  const handleDelete = async (comment) => {
    const ok = await confirm({
      title: 'Delete comment?',
      message: 'The comment will be removed from the discussion (the record is retained).',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await deleteComment(comment.id)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete.')
    }
  }

  const liveCount = comments.filter((c) => !c.is_deleted).length

  return (
    <div className="card card-compact">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
        <MessageSquare size={14} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Discussion</h3>
        {liveCount > 0 && (
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{liveCount}</span>
        )}
      </div>

      {/* Composer */}
      <div className="mb-5">
        {replyTo && (
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5 px-1">
            <span className="inline-flex items-center gap-1"><CornerDownRight size={11} /> Replying to {replyTo.author_name || replyTo.author_username}</span>
            <button onClick={() => setReplyTo(null)} className="hover:text-slate-700 dark:hover:text-slate-200"><X size={13} /></button>
          </div>
        )}
        <MentionInput
          value={body}
          onChange={setBody}
          target={target}
          onSubmit={submit}
          placeholder="Add a comment… type @ to mention someone"
        />
        <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
          {canPostInternal ? (
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input type="checkbox" className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
              <Lock size={11} /> Internal note (PSC only)
            </label>
          ) : <span />}
          <BaseButton size="sm" variant="primary" icon={<Send size={13} />} loading={posting} disabled={!body.trim()} onClick={submit}>
            {replyTo ? 'Reply' : 'Comment'}
          </BaseButton>
        </div>
      </div>

      {/* Thread */}
      {loading ? (
        <p className="text-sm text-slate-400 py-4 text-center">Loading discussion…</p>
      ) : threads.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">No comments yet. Start the discussion.</p>
      ) : (
        <div className="space-y-5">
          {threads.map((thread) => (
            <div key={thread.id} className="group space-y-3">
              <CommentItem comment={thread} target={target} onEdit={handleEdit} onDelete={handleDelete} onReply={setReplyTo} />
              {thread.replies.map((reply) => (
                <div key={reply.id} className="group">
                  <CommentItem comment={reply} target={target} onEdit={handleEdit} onDelete={handleDelete} onReply={setReplyTo} isReply />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

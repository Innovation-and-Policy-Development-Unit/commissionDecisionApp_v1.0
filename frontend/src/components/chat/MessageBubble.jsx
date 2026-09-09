import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CornerUpLeft, FileText, Pencil, Smile, Trash2 } from 'lucide-react'
import MentionText from '../shared/MentionText'

const QUICK_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🙏']

function messageTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function AttachmentPreview({ attachment }) {
  const isImage = (attachment.content_type || '').startsWith('image/')
  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block mt-1">
        <img
          src={attachment.url}
          alt={attachment.original_name}
          className="max-w-full max-h-48 rounded-lg border border-black/5 object-cover"
        />
      </a>
    )
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="mt-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-xs hover:bg-black/10 dark:hover:bg-white/20"
    >
      <FileText size={14} className="shrink-0" />
      <span className="truncate">{attachment.original_name}</span>
    </a>
  )
}

export default function MessageBubble({ message, isOwn, onReply, onEdit, onDelete, onReact, compact = false }) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(message.body)

  if (message.is_deleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm italic text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700">
          {t('chat.deleted_message')}
        </div>
      </div>
    )
  }

  const reactionGroups = (message.reactions || []).reduce((acc, r) => {
    (acc[r.emoji] ||= []).push(r.user)
    return acc
  }, {})

  const submitEdit = (e) => {
    e.preventDefault()
    const body = editDraft.trim()
    if (body && body !== message.body) onEdit(message.id, body)
    setEditing(false)
  }

  return (
    <div className={`group flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {message.reply_to_preview && (
          <div className="mb-0.5 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-[11px] text-slate-500 dark:text-slate-400 max-w-full truncate">
            <span className="font-medium">{message.reply_to_preview.sender_name}: </span>
            {message.reply_to_preview.is_deleted ? t('chat.deleted_message') : message.reply_to_preview.body}
          </div>
        )}

        <div className="flex items-center gap-1">
          {/* Hover toolbar — appears before the bubble on own messages, after on others */}
          {isOwn && (
            <div className="hidden group-hover:flex items-center gap-0.5 text-slate-400">
              {!message.pending && (
                <>
                  <button type="button" onClick={() => setEditing((v) => !v)} aria-label={t('chat.edit')} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"><Pencil size={12} /></button>
                  <button type="button" onClick={() => { if (window.confirm(t('chat.confirm_delete'))) onDelete(message.id) }} aria-label={t('chat.delete')} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"><Trash2 size={12} /></button>
                </>
              )}
            </div>
          )}

          <div className={`rounded-2xl px-3.5 py-2 text-sm relative ${
            isOwn ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-sm'
          } ${message.pending ? 'opacity-60' : ''}`}
          >
            {editing ? (
              <form onSubmit={submitEdit} className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
                  className="text-sm rounded px-2 py-1 text-slate-800 min-w-[10rem]"
                />
                <button type="submit" className="text-xs underline shrink-0">{t('chat.save')}</button>
              </form>
            ) : (
              <>
                {message.body && <MentionText body={message.body} />}
                {(message.attachments || []).map((a) => <AttachmentPreview key={a.id} attachment={a} />)}
              </>
            )}
            <p className={`mt-0.5 text-[10px] flex items-center gap-1 ${isOwn ? 'text-primary-100' : 'text-slate-400'}`}>
              {messageTime(message.created_at)}
              {message.edited_at && <span>· {t('chat.edited')}</span>}
            </p>
          </div>

          <div className="hidden group-hover:flex items-center gap-0.5 text-slate-400 relative">
            <button type="button" onClick={() => setPickerOpen((v) => !v)} aria-label={t('chat.react')} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"><Smile size={12} /></button>
            <button type="button" onClick={() => onReply(message)} aria-label={t('chat.reply')} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"><CornerUpLeft size={12} /></button>
            {pickerOpen && (
              <div className="absolute bottom-full mb-1 flex gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-1.5 py-1 shadow-lg z-10">
                {QUICK_EMOJI.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { onReact(message.id, e); setPickerOpen(false) }}
                    className="hover:scale-125 transition-transform text-base leading-none p-0.5"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {Object.keys(reactionGroups).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {Object.entries(reactionGroups).map(([emoji, users]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(message.id, emoji)}
                className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                {emoji} {users.length}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

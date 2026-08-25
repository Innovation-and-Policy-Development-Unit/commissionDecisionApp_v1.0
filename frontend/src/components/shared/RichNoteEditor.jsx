import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Image as ImageIcon } from 'lucide-react'
import BaseButton from './BaseButton'
import BaseMessageBar from './BaseMessageBar'
import api from '../../api/client'

// Extends the stock Image node with the bookkeeping attributes needed while
// a pasted/dropped screenshot is mid-upload: a client-side temp id so we can
// find-and-replace the node once the server responds, and the eventual
// server-assigned RemarksImage id the backend links to the WorkflowEvent
// (see extract_remarks_image_ids() in backend/tracker/rich_text.py).
const RemarksImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-temp-id': {
        default: null,
        parseHTML: (el) => el.getAttribute('data-temp-id'),
        renderHTML: (attrs) => (attrs['data-temp-id'] ? { 'data-temp-id': attrs['data-temp-id'] } : {}),
      },
      'data-remarks-image-id': {
        default: null,
        parseHTML: (el) => el.getAttribute('data-remarks-image-id'),
        renderHTML: (attrs) =>
          attrs['data-remarks-image-id'] ? { 'data-remarks-image-id': attrs['data-remarks-image-id'] } : {},
      },
      'data-uploading': {
        default: null,
        parseHTML: (el) => el.getAttribute('data-uploading'),
        renderHTML: (attrs) => (attrs['data-uploading'] ? { 'data-uploading': attrs['data-uploading'] } : {}),
      },
    }
  },
})

function replaceImageNode(editor, tempId, newAttrs) {
  let targetPos = null
  editor.state.doc.descendants((node, pos) => {
    if (targetPos !== null) return false
    if (node.type.name === 'image' && node.attrs['data-temp-id'] === tempId) {
      targetPos = pos
      return false
    }
    return true
  })
  if (targetPos === null) return
  if (newAttrs === null) {
    editor.chain().command(({ tr }) => {
      tr.delete(targetPos, targetPos + 1)
      return true
    }).run()
    return
  }
  editor.chain().command(({ tr }) => {
    const node = tr.doc.nodeAt(targetPos)
    if (node) tr.setNodeMarkup(targetPos, undefined, { ...node.attrs, ...newAttrs })
    return true
  }).run()
}

/**
 * TipTap editor + toolbar for workflow-transition remarks (Return for
 * Clarification, Defer, Reject, the kanban quick-transition dialog, etc.).
 * Screenshots upload immediately on paste/drop (POST
 * /submissions/{id}/remarks-images/) and are referenced by URL, not embedded
 * as base64 — keeps the decision-proof hash payload (which reads the
 * plain-text `remarks` derived server-side from this HTML) unaffected.
 *
 * Exposes `getHTML()` / `getText()` via ref for the parent's submit handler.
 * `resetKey` — pass a value that changes each time the editor should start
 * fresh (e.g. the id of the action being composed, or a dialog-open counter).
 */
const RichNoteEditor = forwardRef(function RichNoteEditor(
  { submissionId, placeholder, resetKey, onHasTextChange },
  ref,
) {
  const [uploadError, setUploadError] = useState('')
  const editorRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      RemarksImage.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder || 'Add a note…' }),
    ],
    editorProps: {
      attributes: { class: 'rich-note-prose min-h-[10rem] max-h-[45vh] overflow-y-auto focus:outline-none' },
      handlePaste: (_view, event) => {
        const item = Array.from(event.clipboardData?.items || []).find((i) => i.type.startsWith('image/'))
        if (!item) return false
        const file = item.getAsFile()
        if (!file) return false
        event.preventDefault()
        uploadAndInsertImage(file)
        return true
      },
      handleDrop: (_view, event) => {
        const file = Array.from(event.dataTransfer?.files || []).find((f) => f.type.startsWith('image/'))
        if (!file) return false
        event.preventDefault()
        uploadAndInsertImage(file)
        return true
      },
    },
    onUpdate: ({ editor: ed }) => onHasTextChange?.(!!ed.getText().trim()),
  })

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  useEffect(() => {
    if (editor) {
      editor.commands.clearContent(true)
      onHasTextChange?.(false)
      setUploadError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, resetKey])

  useImperativeHandle(ref, () => ({
    getHTML: () => editorRef.current?.getHTML() || '',
    getText: () => editorRef.current?.getText() || '',
  }), [])

  async function uploadAndInsertImage(file) {
    const ed = editorRef.current
    if (!ed) return
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const objectUrl = URL.createObjectURL(file)
    ed.chain().focus().setImage({ src: objectUrl, 'data-temp-id': tempId, 'data-uploading': 'true' }).run()
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post(`/submissions/${submissionId}/remarks-images/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      replaceImageNode(ed, tempId, {
        src: data.url,
        'data-remarks-image-id': String(data.id),
        'data-uploading': null,
      })
    } catch {
      replaceImageNode(ed, tempId, null)
      setUploadError('That screenshot failed to upload. Please try again.')
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  return (
    <div className="space-y-3">
      {uploadError && <BaseMessageBar intent="warning">{uploadError}</BaseMessageBar>}

      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 pb-2">
        <BaseButton
          variant="ghost"
          size="icon"
          aria-label="Bold"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={editor?.isActive('bold') ? 'bg-slate-100 dark:bg-slate-700' : ''}
        >
          <Bold size={15} />
        </BaseButton>
        <BaseButton
          variant="ghost"
          size="icon"
          aria-label="Italic"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={editor?.isActive('italic') ? 'bg-slate-100 dark:bg-slate-700' : ''}
        >
          <Italic size={15} />
        </BaseButton>
        <BaseButton
          variant="ghost"
          size="icon"
          aria-label="Bullet list"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={editor?.isActive('bulletList') ? 'bg-slate-100 dark:bg-slate-700' : ''}
        >
          <List size={15} />
        </BaseButton>
        <BaseButton
          variant="ghost"
          size="icon"
          aria-label="Numbered list"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={editor?.isActive('orderedList') ? 'bg-slate-100 dark:bg-slate-700' : ''}
        >
          <ListOrdered size={15} />
        </BaseButton>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          <ImageIcon size={13} /> Paste or drop a screenshot to attach it inline
        </span>
      </div>

      <div className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 bg-white dark:bg-slate-900">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
})

export default RichNoteEditor

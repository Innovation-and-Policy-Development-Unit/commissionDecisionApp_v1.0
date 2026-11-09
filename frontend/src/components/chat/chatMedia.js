/** Chat attachments sit behind the login token, which an <img> or <a> cannot send. These helpers
 * fetch them with the app's API client and hand back a temporary local URL. */
import { useEffect, useState } from 'react'
import api from '../../api/client'

/** "http://host/api/chat/attachments/5/" -> "/chat/attachments/5/" (the client adds /api). */
export function apiPath(url) {
  try {
    return new URL(url, window.location.origin).pathname.replace(/^\/api/, '')
  } catch {
    return url
  }
}

const cache = new Map() // path -> object URL, so scrolling back does not refetch

export async function fetchBlobUrl(path) {
  if (cache.has(path)) return cache.get(path)
  const res = await api.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  cache.set(path, url)
  return url
}

/** The temporary URL of an attachment (or its small thumbnail); null while loading or on failure. */
export function useAttachmentUrl(attachment, { thumb = false } = {}) {
  const [state, setState] = useState({ url: null, failed: false })
  const path = apiPath(attachment.url) + (thumb ? '?thumb=1' : '')
  useEffect(() => {
    let live = true
    setState({ url: null, failed: false })
    fetchBlobUrl(path)
      .then((url) => { if (live) setState({ url, failed: false }) })
      .catch(() => { if (live) setState({ url: null, failed: true }) })
    return () => { live = false }
  }, [path])
  return state
}

export async function downloadAttachment(attachment) {
  const res = await api.get(`${apiPath(attachment.url)}?download=1`, { responseType: 'blob' })
  const href = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = href
  a.download = attachment.original_name || 'file'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 10000)
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024
export const MAX_FILES = 10
export const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,.zip'
const OK_TYPES = /^(image\/(png|jpeg|gif|webp)|application\/pdf)$/
const OK_EXT = /\.(png|jpe?g|gif|webp|pdf|docx?|xlsx?|zip)$/i

/** Plain-language reason a file cannot be sent, or '' when it is fine. */
export function fileProblem(file) {
  if (file.size > MAX_FILE_BYTES) return `"${file.name}" is over the 25 MB limit.`
  if (!OK_TYPES.test(file.type) && !OK_EXT.test(file.name)) return `"${file.name}" is not a file type chat accepts.`
  return ''
}

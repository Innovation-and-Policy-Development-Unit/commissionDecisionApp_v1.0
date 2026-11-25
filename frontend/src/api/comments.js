import api from './client'

// A7 Collaboration (P1) — polymorphic discussion comments.
// target is a string like "submission:123".

export async function listComments(target, extraParams = {}) {
  const res = await api.get('/comments/', { params: { target, ...extraParams } })
  // tolerate paginated or bare-array responses
  return res.data?.results ?? res.data ?? []
}

export async function createComment({ target, body, isInternal = false, parent = null, fieldKey = '' }) {
  const res = await api.post('/comments/', {
    target,
    body,
    is_internal: isInternal,
    parent,
    ...(fieldKey ? { field_key: fieldKey } : {}),
  })
  return res.data
}

export async function updateComment(id, body) {
  const res = await api.patch(`/comments/${id}/`, { body })
  return res.data
}

export async function deleteComment(id) {
  const res = await api.delete(`/comments/${id}/`)
  return res.data
}

export async function suggestMentions(target, q = '') {
  const res = await api.get('/mentions/suggest/', { params: { target, q } })
  return res.data ?? []
}

// Field-level review comments: one thread per field of the digitized form.
export async function listFieldComments(target) {
  return listComments(target, { field_only: 1 })
}

export async function resolveComment(id) {
  const res = await api.post(`/comments/${id}/resolve/`)
  return res.data
}

export async function reopenComment(id) {
  const res = await api.post(`/comments/${id}/reopen/`)
  return res.data
}

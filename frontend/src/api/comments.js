import api from './client'

// A7 Collaboration (P1) — polymorphic discussion comments.
// target is a string like "submission:123".

export async function listComments(target) {
  const res = await api.get('/comments/', { params: { target } })
  // tolerate paginated or bare-array responses
  return res.data?.results ?? res.data ?? []
}

export async function createComment({ target, body, isInternal = false, parent = null }) {
  const res = await api.post('/comments/', {
    target,
    body,
    is_internal: isInternal,
    parent,
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

import api from './client'

// A7 P3 — unified activity timeline for an object (e.g. "submission:123").
// kind: 'all' | 'discussion' | 'activity'
export async function getActivity(target, kind = 'all', { limit = 50, offset = 0 } = {}) {
  const res = await api.get('/activity/', { params: { target, kind, limit, offset } })
  return res.data ?? { count: 0, results: [] }
}

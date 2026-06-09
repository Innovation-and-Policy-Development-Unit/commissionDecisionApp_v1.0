import api from './client'

/** SCDMS Intelligence (interactive explorer) API client. */
export const intelligenceApi = {
  datasets: () => api.get('/intelligence/datasets/').then(r => r.data),

  query: (dataset, query_spec) =>
    api.post('/intelligence/query/', { dataset, query_spec }).then(r => r.data),

  interpret: (dataset, prompt) =>
    api.post('/intelligence/interpret/', { dataset, prompt }).then(r => r.data),

  // ── Saved explorations ──────────────────────────────────────────────────
  explorations: () => api.get('/intelligence/explorations/').then(r => r.data),

  saveExploration: (payload) =>
    api.post('/intelligence/explorations/', payload).then(r => r.data),

  updateExploration: (id, payload) =>
    api.patch(`/intelligence/explorations/${id}/`, payload).then(r => r.data),

  deleteExploration: (id) =>
    api.delete(`/intelligence/explorations/${id}/`),
}

export default intelligenceApi

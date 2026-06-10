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

  // ── Dashboards (composed boards of chart tiles) ─────────────────────────
  dashboards: () => api.get('/intelligence/dashboards/').then(r => r.data),

  dashboard: (id) => api.get(`/intelligence/dashboards/${id}/`).then(r => r.data),

  createDashboard: (payload) =>
    api.post('/intelligence/dashboards/', payload).then(r => r.data),

  updateDashboard: (id, payload) =>
    api.patch(`/intelligence/dashboards/${id}/`, payload).then(r => r.data),

  deleteDashboard: (id) =>
    api.delete(`/intelligence/dashboards/${id}/`),

  // ── Scheduled reports & alerts ──────────────────────────────────────────
  reports: () => api.get('/intelligence/reports/').then(r => r.data),

  createReport: (payload) =>
    api.post('/intelligence/reports/', payload).then(r => r.data),

  updateReport: (id, payload) =>
    api.patch(`/intelligence/reports/${id}/`, payload).then(r => r.data),

  deleteReport: (id) =>
    api.delete(`/intelligence/reports/${id}/`),

  runReport: (id) =>
    api.post(`/intelligence/reports/${id}/run/`).then(r => r.data),
}

export default intelligenceApi

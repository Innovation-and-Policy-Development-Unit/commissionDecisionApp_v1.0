import api from './client'

/** Report template (Reports product) API client. */
export const reportTemplatesApi = {
  /** Templates visible to the current user (active only). */
  list: () => api.get('/report-templates/').then(r => r.data),

  /** All templates (managers only). */
  listManage: () => api.get('/report-templates/', { params: { manage: 1 } }).then(r => r.data),

  get: (slug) => api.get(`/report-templates/${slug}/`).then(r => r.data),

  create: (payload) => api.post('/report-templates/', payload).then(r => r.data),

  update: (slug, payload) => api.patch(`/report-templates/${slug}/`, payload).then(r => r.data),

  remove: (slug) => api.delete(`/report-templates/${slug}/`),

  /** Allowed building blocks for the guided builder. */
  vocabulary: () => api.get('/report-templates/vocabulary/').then(r => r.data),
}

export default reportTemplatesApi

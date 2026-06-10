import api from './client'

/** Act (Automation) engine API client. */
export const automationApi = {
  list: () => api.get('/automations/').then(r => r.data),
  fields: (entity = 'submission') => api.get('/automations/fields/', { params: { entity } }).then(r => r.data),
  create: (payload) => api.post('/automations/', payload).then(r => r.data),
  update: (id, payload) => api.patch(`/automations/${id}/`, payload).then(r => r.data),
  remove: (id) => api.delete(`/automations/${id}/`),
  test: (entity, conditions, match) => api.post('/automations/test/', { entity, conditions, match }).then(r => r.data),
  runNow: (id) => api.post(`/automations/${id}/run/`).then(r => r.data),
  runs: (automation) => api.get('/automations/runs/', { params: automation ? { automation } : {} }).then(r => r.data),
  exportRuns: (automation) => api.get('/automations/runs/export/', { params: automation ? { automation } : {}, responseType: 'blob' }).then(r => r.data),
}

export default automationApi

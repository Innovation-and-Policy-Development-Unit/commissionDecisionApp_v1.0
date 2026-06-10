import api from './client'

/** Rule Engine & Flag Monitor API client. */
export const rulesApi = {
  // Flag Monitor (RBAC-scoped)
  flags: (params = {}) => api.get('/flags/', { params }).then(r => r.data),
  acknowledgeFlag: (id) => api.post(`/flags/${id}/acknowledge/`).then(r => r.data),
  clearFlag: (id) => api.post(`/flags/${id}/clear/`),
  exportFlags: (params = {}) => api.get('/flags/export/', { params, responseType: 'blob' }).then(r => r.data),

  // Rules (admin)
  rules: () => api.get('/rules/').then(r => r.data),
  ruleFields: (entity = 'submission') => api.get('/rules/fields/', { params: { entity } }).then(r => r.data),
  createRule: (payload) => api.post('/rules/', payload).then(r => r.data),
  updateRule: (id, payload) => api.patch(`/rules/${id}/`, payload).then(r => r.data),
  deleteRule: (id) => api.delete(`/rules/${id}/`),
  testRule: (conditions, match, entity = 'submission') => api.post('/rules/test/', { conditions, match, entity }).then(r => r.data),
  runRules: () => api.post('/rules/run/').then(r => r.data),
}

export default rulesApi

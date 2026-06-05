import api from './client'

/** Smart Report (Enterprise Reporting Engine) API client. */
export const smartReportsApi = {
  list: (mine = true) =>
    api.get('/smart-reports/', { params: mine ? { mine: 1 } : {} }).then(r => r.data),

  create: (payload) => api.post('/smart-reports/', payload).then(r => r.data),

  get: (id) => api.get(`/smart-reports/${id}/`).then(r => r.data),

  rerun: (id) => api.post(`/smart-reports/${id}/rerun/`).then(r => r.data),

  remove: (id) => api.delete(`/smart-reports/${id}/`),

  /** Self-contained HTML (string) for inline <iframe srcDoc> rendering. */
  fetchHtml: (id) =>
    api
      .get(`/smart-reports/${id}/download/`, {
        params: { fmt: 'html', inline: 1 },
        responseType: 'text',
      })
      .then(r => r.data),

  /** Trigger an authenticated browser download of the report HTML. */
  downloadHtml: async (id, filename) => {
    const res = await api.get(`/smart-reports/${id}/download/`, {
      params: { fmt: 'html' },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `smart-report-${id}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}

export default smartReportsApi

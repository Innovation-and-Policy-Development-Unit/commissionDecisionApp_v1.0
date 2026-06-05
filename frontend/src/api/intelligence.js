import api from './client'

/** SCDMS Intelligence (interactive explorer) API client. */
export const intelligenceApi = {
  datasets: () => api.get('/intelligence/datasets/').then(r => r.data),

  query: (dataset, query_spec) =>
    api.post('/intelligence/query/', { dataset, query_spec }).then(r => r.data),

  interpret: (dataset, prompt) =>
    api.post('/intelligence/interpret/', { dataset, prompt }).then(r => r.data),
}

export default intelligenceApi

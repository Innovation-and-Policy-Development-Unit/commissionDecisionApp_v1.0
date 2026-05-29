import api from '../api/client'

/** Load every page from a paginated DRF list endpoint (default page size is 50). */
export async function fetchAllPaginated(path, params = {}) {
  const all = []
  let page = 1
  while (true) {
    const { data } = await api.get(path, { params: { ...params, page, page_size: 100 } })
    if (Array.isArray(data)) return data
    all.push(...(data.results || []))
    if (!data.next) break
    page += 1
  }
  return all
}

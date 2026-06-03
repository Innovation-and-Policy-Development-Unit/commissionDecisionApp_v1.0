/**
 * Submission detail bootstrap cache + route/API prefetch.
 * Reduces perceived load time when opening a submission from the log.
 *
 * Caching is delegated to the shared React Query client so the detail cache,
 * the list cache, and invalidations all live in one place (and survive
 * back-navigation via React Query's gcTime).
 */
import api from '../api/client'
import { queryClient } from '../api/queryClient'

// How long a cached bootstrap is treated as "fresh" for the synchronous
// cache-hit path used by SubmissionDetail. Matches the previous TTL behaviour.
const STALE_TTL_MS = 90_000

const bootstrapKey = (id) => ['submission-bootstrap', String(id)]
const bootstrapFetcher = (id) => api.get(`/submissions/${id}/bootstrap/`).then(res => res.data)

let detailChunkPromise = null

export function prefetchSubmissionDetailChunk() {
  if (!detailChunkPromise) {
    detailChunkPromise = import('../pages/psc/SubmissionDetail')
  }
  return detailChunkPromise
}

/** Synchronous cache read — returns data only while still within the TTL. */
export function getCachedSubmissionBootstrap(id) {
  const state = queryClient.getQueryState(bootstrapKey(id))
  if (!state || state.data === undefined) return null
  if (Date.now() - state.dataUpdatedAt > STALE_TTL_MS) return null
  return state.data
}

export function setCachedSubmissionBootstrap(id, data) {
  queryClient.setQueryData(bootstrapKey(id), data)
}

export function invalidateSubmissionBootstrap(id) {
  queryClient.invalidateQueries({ queryKey: bootstrapKey(id) })
}

/** Warm the lazy route chunk and (optionally) prefetch the bootstrap JSON. */
export function prefetchSubmissionDetail(id, { fetchBootstrap = true } = {}) {
  if (!id) return
  prefetchSubmissionDetailChunk()
  if (!fetchBootstrap) return
  queryClient.prefetchQuery({
    queryKey: bootstrapKey(id),
    queryFn: () => bootstrapFetcher(id),
    staleTime: STALE_TTL_MS,
  })
}

export async function fetchSubmissionBootstrap(id, { useCache = true } = {}) {
  return queryClient.fetchQuery({
    queryKey: bootstrapKey(id),
    queryFn: () => bootstrapFetcher(id),
    // useCache:false (e.g. an explicit reload) forces a fresh network round-trip.
    staleTime: useCache ? STALE_TTL_MS : 0,
  })
}

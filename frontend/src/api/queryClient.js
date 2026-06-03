import { QueryClient } from '@tanstack/react-query'

/**
 * Shared React Query client. Exported as a singleton so non-component code
 * (e.g. submission detail prefetch in utils/submissionBootstrap.js) can warm
 * and invalidate the same cache the components read from.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // treat data fresh for 30s → stale-while-revalidate
      gcTime: 5 * 60_000,         // keep unused cache 5min for instant back-navigation
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

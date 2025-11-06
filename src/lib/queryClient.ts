import { QueryClient } from '@tanstack/react-query'

/**
 * Configured QueryClient with optimized defaults for performance:
 * - staleTime: 5 minutes - data is considered fresh for 5 minutes, reducing unnecessary refetches
 * - cacheTime: 10 minutes - cached data is kept for 10 minutes after last use
 * - refetchOnWindowFocus: false - prevents refetching when user switches tabs (better UX)
 * - refetchOnReconnect: true - refetches when network reconnects
 * - retry: 1 - only retry once on failure to avoid long loading times
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false, // Don't refetch on window focus for better performance
      refetchOnReconnect: true, // Refetch when network reconnects
      retry: 1, // Only retry once to avoid long loading times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: 1,
    },
  },
})


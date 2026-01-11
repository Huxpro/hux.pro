import type { LocationMode } from "@/systems/ambient/lib/location";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";

// =============================================================================
// React Query Configuration
// =============================================================================
// This file sets up the QueryClient with defaults optimized for the ambient
// system (location + weather), and configures localStorage persistence.
//
// Key design decisions:
// - 24h gcTime: Keep unused data in cache for a full day
// - Retry once: Don't hammer APIs on failure
// - Persistence: Survives page refresh via localStorage
// =============================================================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // How long before data is considered stale (triggers background refetch)
      staleTime: 5 * 60 * 1000, // 5 minutes default
      // How long to keep unused data in cache (was cacheTime in v4)
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      // Retry once on failure
      retry: 1,
      // Don't refetch on window focus for ambient data (it's slow-changing)
      refetchOnWindowFocus: false,
    },
  },
});

declare global {
  interface Window {
    __TANSTACK_QUERY_CLIENT__?: import("@tanstack/react-query").QueryClient;
  }
}

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  window.__TANSTACK_QUERY_CLIENT__ = queryClient;
}

// =============================================================================
// Cache Persistence
// =============================================================================
// Persists the React Query cache to localStorage so cached location/weather
// data survives page refreshes. This replaces the manual TTL caching that
// was previously in lib/ambient/storage.ts.
// =============================================================================

export const queryPersister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "hux_query_cache",
  // Only persist successful queries
  serialize: (data) => JSON.stringify(data),
  deserialize: (data) => JSON.parse(data),
});

// =============================================================================
// Query Keys Factory
// =============================================================================
// Type-safe query keys for cache invalidation and lookup.
// Using a factory pattern ensures consistency across the app.
// =============================================================================

export const queryKeys = {
  /** Location query key - includes mode to ensure refetch on mode change */
  location: (mode: LocationMode) => ["location", mode] as const,

  /** Weather query key - rounded coords for cache deduplication */
  weather: (lat: number, lon: number) =>
    ["weather", lat.toFixed(2), lon.toFixed(2)] as const,
} as const;

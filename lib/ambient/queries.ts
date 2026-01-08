"use client";

import { queryKeys } from "@/lib/query";
import { useQuery } from "@tanstack/react-query";
import {
  type LocationMode,
  type ResolvedLocation,
  fetchIpLocation,
  requestAccurateLocation,
} from "./location";
import { type NormalizedWeather, fetchCurrentWeather } from "./weather";

// =============================================================================
// Location Query
// =============================================================================
// Fetches location based on the current mode (IP or Accurate/GPS).
// The query key includes the mode, so changing modes triggers a new fetch.
//
// Stale time: 24 hours (location doesn't change often)
// =============================================================================

const LOCATION_STALE_TIME = 24 * 60 * 60 * 1000; // 24 hours

export function useLocationQuery(mode: LocationMode) {
  return useQuery<ResolvedLocation, Error>({
    queryKey: queryKeys.location(mode),
    queryFn: async () => {
      if (mode === "accurate") {
        // This will prompt for permission if not already granted
        return requestAccurateLocation();
      }
      return fetchIpLocation();
    },
    staleTime: LOCATION_STALE_TIME,
    // Keep previous data while fetching new location (stale-while-revalidate)
    placeholderData: (previousData) => previousData,
  });
}

// =============================================================================
// Weather Query
// =============================================================================
// Fetches weather for the given location coordinates.
// Only enabled when location is available.
//
// The query key uses rounded coordinates (~1km resolution) to avoid
// cache fragmentation from tiny GPS variations.
//
// Stale time: 45 minutes (weather changes more frequently than location)
// =============================================================================

const WEATHER_STALE_TIME = 45 * 60 * 1000; // 45 minutes

export function useWeatherQuery(location: ResolvedLocation | null | undefined) {
  return useQuery<NormalizedWeather, Error>({
    queryKey: location
      ? queryKeys.weather(location.lat, location.lon)
      : ["weather", "disabled"],
    queryFn: async () => {
      if (!location) {
        throw new Error("Location required for weather query");
      }
      return fetchCurrentWeather(location.lat, location.lon);
    },
    // Only fetch when we have a location
    enabled: !!location,
    staleTime: WEATHER_STALE_TIME,
    // Keep previous weather while fetching new (stale-while-revalidate)
    placeholderData: (previousData) => previousData,
  });
}

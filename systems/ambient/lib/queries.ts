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

// -----------------------------------------------------------------------------
// Freshness
//
// The provider is mounted once and lives as long as the tab, and the cache is
// persisted, so staleTime alone refreshes nothing: something has to *ask*.
// What asks is the world changing — the tab coming back (React Query's focus
// manager listens to visibilitychange), the network coming back, and for the
// weather, the model's next interval landing. The global default turns focus
// refetching off; these two queries turn it back on, and staleTime keeps that
// to at most one request per window.
// -----------------------------------------------------------------------------

// An IP location moves when the network does — a new Wi-Fi, a phone leaving
// it — so it is worth asking again after half an hour, not a day. A day was
// long enough for a misplaced answer to stick through every reload.
const IP_LOCATION_STALE_TIME = 30 * 60 * 1000;
// A GPS fix is re-taken on the same half-hour, but only on mount: asking on
// focus could put the permission prompt in front of someone who just switched
// tabs.
const ACCURATE_LOCATION_STALE_TIME = 30 * 60 * 1000;

export function useLocationQuery(mode: LocationMode) {
  return useQuery<ResolvedLocation, Error>({
    queryKey: queryKeys.location(mode),
    queryFn: async () => {
      if (mode === "accurate") {
        return requestAccurateLocation();
      }
      return fetchIpLocation();
    },
    staleTime:
      mode === "accurate" ? ACCURATE_LOCATION_STALE_TIME : IP_LOCATION_STALE_TIME,
    refetchOnWindowFocus: mode === "ip",
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData,
  });
}

// Open-Meteo's `current` block is a 15-minute model interval where it has
// 15-minutely data (hourly elsewhere). Asking more often than that returns the
// same numbers.
const WEATHER_STALE_TIME = 15 * 60 * 1000;
const WEATHER_MIN_POLL = 5 * 60 * 1000;
const WEATHER_MAX_POLL = 60 * 60 * 1000;
// The next interval is published a little after it starts.
const WEATHER_PUBLISH_LAG = 2 * 60 * 1000;

/**
 * How long until the forecast has something new: the end of the interval the
 * data describes, plus a publishing lag. Without an interval to go on, the
 * stale time. Only runs while the tab is visible (React Query's default).
 */
export function nextWeatherPollMs(
  weather: NormalizedWeather | undefined,
  nowMs: number = Date.now()
): number {
  if (!weather?.observedAtMs || !weather.intervalS) return WEATHER_STALE_TIME;
  const due =
    weather.observedAtMs + weather.intervalS * 1000 + WEATHER_PUBLISH_LAG;
  return Math.min(WEATHER_MAX_POLL, Math.max(WEATHER_MIN_POLL, due - nowMs));
}

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
    enabled: !!location,
    staleTime: WEATHER_STALE_TIME,
    refetchInterval: (query) => nextWeatherPollMs(query.state.data),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData,
  });
}

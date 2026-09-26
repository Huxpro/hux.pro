"use client";

import { queryKeys } from "@/lib/query";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  type GeolocationPermission,
  type LocationMode,
  type ResolvedLocation,
  classifyGeolocationError,
  fetchIpLocation,
  requestAccurateLocation,
  subscribeGeolocationPermission,
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
// A GPS fix is re-taken on the same half-hour — on focus too, but only while
// the permission is known to be granted, so a refetch can never be what raises
// the prompt.
const ACCURATE_LOCATION_STALE_TIME = 30 * 60 * 1000;

/**
 * The live geolocation permission; null until the browser has answered. A
 * grant or a revocation made in the site settings arrives here too, without a
 * reload. `onChange` hears only changes *during* the visit — never the first
 * answer — with the answer before it.
 */
export function useGeolocationPermission(
  onChange?: (next: GeolocationPermission, previous: GeolocationPermission) => void
): GeolocationPermission | null {
  const [permission, setPermission] = useState<GeolocationPermission | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    let previous: GeolocationPermission | null = null;
    return subscribeGeolocationPermission((next) => {
      if (previous !== null && previous !== next) {
        onChangeRef.current?.(next, previous);
      }
      previous = next;
      setPermission(next);
    });
  }, []);
  return permission;
}

/**
 * How long an explicit yes to the prompt counts as a grant when the
 * Permissions API still reads "prompt". Safari remembers an Allow for about a
 * day under its default "Ask" setting, and never reports it as "granted".
 */
export const GRANT_MEMORY_MS = 24 * 60 * 60 * 1000;

/**
 * May a fix be taken now without it being what raises the prompt?
 *
 * "granted" — yes. "unknown" (no Permissions API) — yes, the old behaviour.
 * "denied" or not answered yet — no. "prompt" — only within a day of the
 * visitor saying yes to it here: that is iOS Safari, whose default "Ask" site
 * setting keeps reading "prompt" after an Allow, and without this the switch to
 * Accurate never took. (A visitor who sets Safari's site setting to Allow reads
 * "granted" and needs none of it.)
 */
export function canTakeFix(
  permission: GeolocationPermission | null,
  grantedAtMs: number,
  nowMs: number
): boolean {
  if (permission === "granted" || permission === "unknown") return true;
  if (permission !== "prompt") return false;
  return grantedAtMs > 0 && nowMs - grantedAtMs < GRANT_MEMORY_MS;
}

/**
 * The visitor's location. In "accurate" mode a GPS fix is taken only when
 * `canTakeFix` allows it; otherwise the query *is* the IP one, same key and
 * same cache, so a revoked or reset permission degrades to the network's guess
 * instead of a prompt on page load or no weather at all. A fix that fails for
 * any reason falls back to the IP too, and a refusal (the visitor answered a
 * prompt Safari raised anyway) is reported through `onDenied` so it is not
 * asked again.
 */
export function useLocationQuery(
  mode: LocationMode,
  permission: GeolocationPermission | null,
  grant: { grantedAtMs: number; nowMs: number; onDenied: () => void }
) {
  const wantsGps = mode === "accurate";
  const gps = wantsGps && canTakeFix(permission, grant.grantedAtMs, grant.nowMs);
  const onDeniedRef = useRef(grant.onDenied);
  useEffect(() => {
    onDeniedRef.current = grant.onDenied;
  });
  return useQuery<ResolvedLocation, Error>({
    queryKey: queryKeys.location(gps ? "accurate" : "ip"),
    queryFn: async () => {
      if (!gps) return fetchIpLocation();
      try {
        return await requestAccurateLocation();
      } catch (err) {
        if (classifyGeolocationError(err) === "denied") onDeniedRef.current();
        return fetchIpLocation();
      }
    },
    // Wait for the permission before choosing, or an accurate visitor would
    // pay for an IP lookup on every load.
    enabled: !wantsGps || permission !== null,
    staleTime: gps ? ACCURATE_LOCATION_STALE_TIME : IP_LOCATION_STALE_TIME,
    // On focus only when the browser itself says granted: a remembered Safari
    // grant is taken on load, not every time the tab comes back.
    refetchOnWindowFocus: !gps || permission === "granted",
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

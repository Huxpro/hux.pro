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

const LOCATION_STALE_TIME = 24 * 60 * 60 * 1000; // 24 hours

export function useLocationQuery(mode: LocationMode) {
  return useQuery<ResolvedLocation, Error>({
    queryKey: queryKeys.location(mode),
    queryFn: async () => {
      if (mode === "accurate") {
        return requestAccurateLocation();
      }
      return fetchIpLocation();
    },
    staleTime: LOCATION_STALE_TIME,
    placeholderData: (previousData) => previousData,
  });
}

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
    enabled: !!location,
    staleTime: WEATHER_STALE_TIME,
    placeholderData: (previousData) => previousData,
  });
}

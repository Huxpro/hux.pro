"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSunEventGradient, getWeatherGradient } from "./lib/gradient";
import type { LocationMode, ResolvedLocation } from "./lib/location";
import { requestAccurateLocation as requestAccurateLocationFn } from "./lib/location";
import { useLocationQuery, useWeatherQuery } from "./lib/queries";
import { type FormFactor, matchRoutePattern } from "./lib/route-config";
import {
  type AmbientSettings,
  getAmbientSettings,
  isGradientEnabledForPath as checkGradientEnabled,
  setAmbientSettings,
} from "./lib/settings";
import type { NormalizedWeather, WeatherCondition } from "./lib/weather";
import type { AmbientPhase } from "./lib/phase";
import { deriveAmbientPhase } from "./lib/phase";
import { queryClient } from "@/lib/query";
import { useDevtool } from "@/systems/devtool";

function formatGeolocationError(err: unknown): string {
  if (err instanceof Error) return err.message || "Unknown error";
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const maybe = err as { name?: unknown; message?: unknown; code?: unknown };
    const name = typeof maybe.name === "string" ? maybe.name : null;
    const message = typeof maybe.message === "string" ? maybe.message : null;
    const code = typeof maybe.code === "number" ? maybe.code : null;
    const parts: string[] = [];
    if (name) parts.push(name);
    if (code !== null) parts.push(`code=${code}`);
    if (message) parts.push(message);
    return parts.join(" ") || "Unknown error";
  }
  return "Unknown error";
}

// =============================================================================
// Location Context
// =============================================================================

interface LocationContextType {
  locationMode: LocationMode;
  location: ResolvedLocation | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  setLocationMode: (mode: LocationMode) => void;
  requestAccurateLocation: () => Promise<boolean>;
  refresh: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) throw new Error("useLocation must be used within AmbientProvider");
  return context;
}

// =============================================================================
// Ambient Time Context
// =============================================================================

interface AmbientTimeContextType {
  nowMs: number;
  derivedPhase: AmbientPhase;
  phase: AmbientPhase;
  isOverrideEnabled: boolean;
  setOverrideEnabled: (enabled: boolean) => void;
  overridePhase: AmbientPhase;
  setOverridePhase: (phase: AmbientPhase) => void;
}

const AmbientTimeContext = createContext<AmbientTimeContextType | undefined>(undefined);

export function useAmbientTime() {
  const context = useContext(AmbientTimeContext);
  if (!context) throw new Error("useAmbientTime must be used within AmbientProvider");
  return context;
}

// =============================================================================
// Weather Context
// =============================================================================

interface WeatherDebugOverride {
  condition: WeatherCondition;
  isDay: boolean;
}

interface WeatherContextType {
  weather: NormalizedWeather | null;
  gradient: string;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  isOverrideEnabled: boolean;
  setOverrideEnabled: (enabled: boolean) => void;
  debugOverride: WeatherDebugOverride | null;
  setDebugOverride: (override: WeatherDebugOverride | null) => void;
  refresh: () => void;
  isGradientEnabledForPath: (pathname: string, formFactor?: FormFactor) => boolean;
  getRoutePattern: (pathname: string) => string;
  routeGradientPreferences: Record<string, boolean>;
  setRouteGradientPreference: (pattern: string, enabled: boolean) => void;
  clearRouteGradientPreference: (pattern: string) => void;
  clearAllRouteGradientPreferences: () => void;
}

const WeatherContext = createContext<WeatherContextType | undefined>(undefined);

export function useWeather() {
  const context = useContext(WeatherContext);
  if (!context) throw new Error("useWeather must be used within AmbientProvider");
  return context;
}

// =============================================================================
// AmbientProvider
// =============================================================================

interface AmbientProviderProps {
  children: React.ReactNode;
  theme: "light" | "dark";
}

export function AmbientProvider({ children, theme }: AmbientProviderProps) {
  const { isEnabled: isDevtoolEnabled } = useDevtool();
  
  // Ambient Settings
  const [settings, setSettingsState] = useState<AmbientSettings>(getAmbientSettings);

  const updateSettings = useCallback((partial: Partial<AmbientSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...partial };
      setAmbientSettings(next);
      return next;
    });
  }, []);

  // Debug override state (for weather and time)
  const [debugOverride, setDebugOverride] = useState<WeatherDebugOverride | null>(null);
  const [isOverrideEnabled, setIsOverrideEnabled] = useState(false);
  const [timeOverridePhase, setTimeOverridePhase] = useState<AmbientPhase>("morning");
  const [isTimeOverrideEnabled, setIsTimeOverrideEnabled] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Location (React Query)
  const locationQuery = useLocationQuery(settings.locationMode);

  const setLocationMode = useCallback(
    (mode: LocationMode) => {
      if (mode === settings.locationMode) return;
      updateSettings({ locationMode: mode });
    },
    [settings.locationMode, updateSettings]
  );

  const requestAccurateLocationAction = useCallback(async (): Promise<boolean> => {
    try {
      await requestAccurateLocationFn();
      updateSettings({ locationMode: "accurate" });
      return true;
    } catch (err) {
      const reason = formatGeolocationError(err);
      console.error(
        `[ambient] Failed to switch Geolocation to Accurate; falling back to IP. Reason: ${reason}`,
        err
      );
      updateSettings({ locationMode: "ip" });
      return false;
    }
  }, [updateSettings]);

  const refreshLocation = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["location"] });
  }, []);

  // Weather (React Query)
  const weatherQuery = useWeatherQuery(locationQuery.data);

  const refreshWeather = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["location"] });
    queryClient.invalidateQueries({ queryKey: ["weather"] });
  }, []);

  // Update "now" every minute
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const derivedPhase = useMemo(() => {
    const w = weatherQuery.data;
    return deriveAmbientPhase({
      nowMs,
      sunriseMs: w?.sunriseMs,
      sunsetMs: w?.sunsetMs,
    });
  }, [nowMs, weatherQuery.data]);

  const effectivePhase: AmbientPhase =
    isDevtoolEnabled && isTimeOverrideEnabled ? timeOverridePhase : derivedPhase;

  // Compute gradient
  const computedGradient = useMemo(() => {
    if (effectivePhase === "sunrise" || effectivePhase === "sunset") {
      return getSunEventGradient({ event: effectivePhase, theme }).backgroundImage;
    }

    if (isDevtoolEnabled && isOverrideEnabled && debugOverride) {
      return getWeatherGradient({
        condition: debugOverride.condition,
        isDay: debugOverride.isDay,
        theme,
      }).backgroundImage;
    }

    const weather = weatherQuery.data;
    if (weather) {
      return getWeatherGradient({
        condition: weather.condition,
        isDay: weather.isDay,
        theme,
      }).backgroundImage;
    }

    return "";
  }, [isDevtoolEnabled, isOverrideEnabled, debugOverride, weatherQuery.data, effectivePhase, theme]);

  // Route Gradient Preferences
  const checkGradientEnabledForPath = useCallback(
    (pathname: string, formFactor: FormFactor = "desktop") =>
      checkGradientEnabled(pathname, settings, formFactor),
    [settings]
  );

  const getRoutePattern = useCallback((pathname: string) => {
    return matchRoutePattern(pathname);
  }, []);

  const setRouteGradientPreference = useCallback(
    (pattern: string, enabled: boolean) => {
      updateSettings({
        routeGradientPreferences: {
          ...settings.routeGradientPreferences,
          [pattern]: enabled,
        },
      });
    },
    [settings.routeGradientPreferences, updateSettings]
  );

  const clearRouteGradientPreference = useCallback(
    (pattern: string) => {
      const { [pattern]: _, ...rest } = settings.routeGradientPreferences;
      updateSettings({ routeGradientPreferences: rest });
    },
    [settings.routeGradientPreferences, updateSettings]
  );

  const clearAllRouteGradientPreferences = useCallback(() => {
    updateSettings({ routeGradientPreferences: {} });
  }, [updateSettings]);

  return (
    <LocationContext.Provider
      value={{
        locationMode: settings.locationMode,
        location: locationQuery.data ?? null,
        isLoading: locationQuery.isLoading,
        isFetching: locationQuery.isFetching,
        error: locationQuery.error?.message ?? null,
        setLocationMode,
        requestAccurateLocation: requestAccurateLocationAction,
        refresh: refreshLocation,
      }}
    >
      <WeatherContext.Provider
        value={{
          weather: weatherQuery.data ?? null,
          gradient: computedGradient,
          isLoading: weatherQuery.isLoading,
          isFetching: weatherQuery.isFetching,
          error: weatherQuery.error?.message ?? null,
          isOverrideEnabled,
          setOverrideEnabled: setIsOverrideEnabled,
          debugOverride,
          setDebugOverride,
          refresh: refreshWeather,
          isGradientEnabledForPath: checkGradientEnabledForPath,
          getRoutePattern,
          routeGradientPreferences: settings.routeGradientPreferences,
          setRouteGradientPreference,
          clearRouteGradientPreference,
          clearAllRouteGradientPreferences,
        }}
      >
        <AmbientTimeContext.Provider
          value={{
            nowMs,
            derivedPhase,
            phase: effectivePhase,
            isOverrideEnabled: isTimeOverrideEnabled,
            setOverrideEnabled: setIsTimeOverrideEnabled,
            overridePhase: timeOverridePhase,
            setOverridePhase: setTimeOverridePhase,
          }}
        >
          {children}
        </AmbientTimeContext.Provider>
      </WeatherContext.Provider>
    </LocationContext.Provider>
  );
}

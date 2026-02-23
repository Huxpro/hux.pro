"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSunEventGradient, getWeatherGradient } from "./lib/gradient";
import type { LocationMode, ResolvedLocation } from "./lib/location";
import { requestAccurateLocation as requestAccurateLocationFn } from "./lib/location";
import { useLocationQuery, useWeatherQuery } from "./lib/queries";
import {
  type AmbientSettings,
  type WeatherGradientMode,
  getAmbientSettings,
  getDefaultSettings,
  setAmbientSettings,
} from "./lib/settings";
import { isIOSBrowser } from "./lib/platform";
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

/** DevTool-level overrides for the 3 rendering flags (ephemeral, not persisted). */
export interface DevtoolGradientOverrides {
  full?: boolean;
  widget?: boolean;
  softEdging?: boolean;
}

interface WeatherContextType {
  weather: NormalizedWeather | null;
  gradient: string;
  displayedGradient: string;
  isGradientTransitioning: boolean;
  gradientMode: WeatherGradientMode;
  // 3 resolved rendering flags
  fullGradientEnabled: boolean;
  widgetGradientEnabled: boolean;
  softEdgingEnabled: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  isOverrideEnabled: boolean;
  setOverrideEnabled: (enabled: boolean) => void;
  debugOverride: WeatherDebugOverride | null;
  setDebugOverride: (override: WeatherDebugOverride | null) => void;
  refresh: () => void;
  setGradientMode: (mode: WeatherGradientMode) => void;
  cycleGradientMode: () => void;
  devtoolGradientOverrides: DevtoolGradientOverrides;
  setDevtoolGradientOverrides: (overrides: DevtoolGradientOverrides) => void;
}

const WeatherContext = createContext<WeatherContextType | undefined>(undefined);
const GRADIENT_MODE_CYCLE: WeatherGradientMode[] = ["full", "widget", "off"];

export function useWeather() {
  const context = useContext(WeatherContext);
  if (!context) throw new Error("useWeather must be used within AmbientProvider");
  return context;
}

export function useOptionalWeather() {
  return useContext(WeatherContext);
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

  // Ambient Settings — initialize with defaults to match SSR, hydrate from
  // localStorage in an effect to avoid hydration mismatches.
  const [settings, setSettingsState] = useState<AmbientSettings>(getDefaultSettings);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: localStorage read
    setSettingsState(getAmbientSettings({ isIOS: isIOSBrowser() }));
  }, []);

  const updateSettings = useCallback((partial: Partial<AmbientSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...partial };
      setAmbientSettings(next);
      return next;
    });
  }, []);

  const setGradientMode = useCallback(
    (mode: WeatherGradientMode) => {
      if (mode === settings.weatherGradientMode) return;
      updateSettings({ weatherGradientMode: mode });
    },
    [settings.weatherGradientMode, updateSettings]
  );

  // DevTool gradient overrides (ephemeral, not persisted)
  const [devtoolGradientOverrides, setDevtoolGradientOverrides] =
    useState<DevtoolGradientOverrides>({});

  const cycleGradientMode = useCallback(() => {
    // Clear devtool full/widget overrides so mode change is visible
    setDevtoolGradientOverrides((prev) => ({
      ...prev,
      full: undefined,
      widget: undefined,
    }));
    const currentIndex = GRADIENT_MODE_CYCLE.indexOf(settings.weatherGradientMode);
    const nextIndex =
      currentIndex < 0 ? 0 : (currentIndex + 1) % GRADIENT_MODE_CYCLE.length;
    updateSettings({ weatherGradientMode: GRADIENT_MODE_CYCLE[nextIndex] });
  }, [settings.weatherGradientMode, updateSettings]);

  // 3 resolved rendering flags.
  // DevTool overrides bypass all natural derivation.
  const isIOS = useMemo(() => isIOSBrowser(), []);

  const fullGradientEnabled =
    isDevtoolEnabled && devtoolGradientOverrides.full !== undefined
      ? devtoolGradientOverrides.full
      : settings.weatherGradientMode === "full";

  const widgetGradientEnabled =
    isDevtoolEnabled && devtoolGradientOverrides.widget !== undefined
      ? devtoolGradientOverrides.widget
      : settings.weatherGradientMode === "widget";

  const softEdgingEnabled =
    isDevtoolEnabled && devtoolGradientOverrides.softEdging !== undefined
      ? devtoolGradientOverrides.softEdging
      : isIOS;

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

  // Gradient transition: crossfade when gradient value changes.
  // Centralized here so every consumer (full-page background, widget overlays)
  // shares one transition instead of running independent state machines.
  const [displayedGradient, setDisplayedGradient] = useState("");
  const [isGradientTransitioning, setIsGradientTransitioning] = useState(false);

  useEffect(() => {
    if (weatherQuery.isFetching) return;
    if (computedGradient === displayedGradient) return;
    if (!computedGradient) return;

    if (!displayedGradient) {
      setDisplayedGradient(computedGradient);
      return;
    }

    setIsGradientTransitioning(true);

    const timeout = setTimeout(() => {
      setDisplayedGradient(computedGradient);
      requestAnimationFrame(() => {
        setIsGradientTransitioning(false);
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [computedGradient, displayedGradient, weatherQuery.isFetching]);

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
          displayedGradient,
          isGradientTransitioning,
          gradientMode: settings.weatherGradientMode,
          fullGradientEnabled,
          widgetGradientEnabled,
          softEdgingEnabled,
          isLoading: weatherQuery.isLoading,
          isFetching: weatherQuery.isFetching,
          error: weatherQuery.error?.message ?? null,
          isOverrideEnabled,
          setOverrideEnabled: setIsOverrideEnabled,
          debugOverride,
          setDebugOverride,
          refresh: refreshWeather,
          setGradientMode,
          cycleGradientMode,
          devtoolGradientOverrides,
          setDevtoolGradientOverrides,
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

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  buildWallpaperScene,
  type WallpaperScene,
} from "./lib/atmosphere";
import { getAmbientGradient } from "./lib/gradient";
import { GRADIENT_CROSSFADE_MS, type GradientLayerData } from "./lib/gradient";
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
import {
  EDGE_FADE_MASK,
  EDGE_FADE_MASK_HIGH_CONTRAST,
  isIOSBrowser,
} from "./lib/platform";
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
  /** Crossfade stack: [...settled, newest]. Render via <GradientStack />. */
  gradientLayers: GradientLayerData[];
  /** Living wallpaper scene for the full-page WebGL + particle renderer. */
  wallpaperScene: WallpaperScene | null;
  gradientMode: WeatherGradientMode;
  // 3 resolved rendering flags
  fullGradientEnabled: boolean;
  widgetGradientEnabled: boolean;
  softEdgingEnabled: boolean;
  /** Resolved CSS mask-image value, or null when soft-edging is off. */
  edgeFadeMask: string | null;
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

  // Tick often enough that the sun crawls across the sky instead of jumping.
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  // Refetch weather when the local day rolls over. Open-Meteo returns a single
  // forecast day, so a page left open overnight would otherwise keep yesterday's
  // sunrise/sunset — staling everything derived from them (phase, gradient,
  // greeting, and the phase notification). The minute tick above makes this fire
  // within ~60s of midnight.
  const lastDayRef = useRef(new Date().toDateString());
  useEffect(() => {
    const today = new Date(nowMs).toDateString();
    if (lastDayRef.current === today) return;
    lastDayRef.current = today;
    queryClient.invalidateQueries({ queryKey: ["weather"] });
  }, [nowMs]);

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

  // Resolve which edge-fade mask to use.
  // Special case: dark-mode sunrise/sunset has high gradient-vs-background
  // contrast, so we use a more aggressive (wider) fade to soften the edge.
  const edgeFadeMask: string | null = softEdgingEnabled
    ? theme === "dark" &&
      (effectivePhase === "sunrise" || effectivePhase === "sunset")
      ? EDGE_FADE_MASK_HIGH_CONTRAST
      : EDGE_FADE_MASK
    : null;

  const overrideActive =
    isDevtoolEnabled && isOverrideEnabled && !!debugOverride;
  const effectiveCondition: WeatherCondition | undefined = overrideActive
    ? debugOverride!.condition
    : weatherQuery.data?.condition;
  const effectiveIsDay: boolean | undefined = overrideActive
    ? debugOverride!.isDay
    : weatherQuery.data?.isDay;

  const computedGradient = useMemo(() => {
    return getAmbientGradient({
      condition: effectiveCondition,
      isDay: effectiveIsDay,
      theme,
      phase: effectivePhase,
    });
  }, [effectiveCondition, effectiveIsDay, effectivePhase, theme]);

  const wallpaperScene = useMemo(() => {
    const hasSunEvent =
      effectivePhase === "sunrise" || effectivePhase === "sunset";
    if (!effectiveCondition && !hasSunEvent) return null;

    const weather = weatherQuery.data;
    return buildWallpaperScene({
      condition: effectiveCondition ?? "clear",
      intensity: overrideActive ? "moderate" : weather?.intensity,
      cloudCover: overrideActive ? undefined : weather?.cloudCover,
      precipitationMm: overrideActive ? undefined : weather?.precipitationMm,
      windSpeedKmh: overrideActive ? undefined : weather?.windSpeedKmh,
      theme,
      phase: effectivePhase,
      nowMs,
      sunriseMs: weather?.sunriseMs,
      sunsetMs: weather?.sunsetMs,
      isDay: effectiveIsDay,
      lockSunToPhase: isDevtoolEnabled && isTimeOverrideEnabled,
    });
  }, [
    effectiveCondition,
    effectiveIsDay,
    effectivePhase,
    isDevtoolEnabled,
    isTimeOverrideEnabled,
    nowMs,
    overrideActive,
    theme,
    weatherQuery.data,
  ]);

  // Gradient transition: a true crossfade between layers (no dip-to-background).
  // Centralized here so every consumer (full-page background, widget overlays)
  // shares one stack instead of running independent state machines. When the
  // gradient changes we push a new layer; <GradientStack /> fades it in over the
  // settled one, then we prune back to the latest once the crossfade completes.
  const [gradientLayers, setGradientLayers] = useState<GradientLayerData[]>([]);
  const layerIdRef = useRef(0);

  useEffect(() => {
    // Hold the current gradient while refetching (stale-while-revalidate).
    if (weatherQuery.isFetching) return;
    if (!computedGradient) return;

    setGradientLayers((prev) => {
      const top = prev[prev.length - 1];
      if (top && top.gradient === computedGradient) return prev;
      layerIdRef.current += 1;
      return [...prev, { id: layerIdRef.current, gradient: computedGradient }];
    });
  }, [computedGradient, weatherQuery.isFetching]);

  // Prune to the newest layer once the crossfade settles.
  useEffect(() => {
    if (gradientLayers.length <= 1) return;
    const timeout = setTimeout(() => {
      setGradientLayers((prev) => (prev.length <= 1 ? prev : prev.slice(-1)));
    }, GRADIENT_CROSSFADE_MS + 50);
    return () => clearTimeout(timeout);
  }, [gradientLayers]);

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
          gradientLayers,
          wallpaperScene,
          gradientMode: settings.weatherGradientMode,
          fullGradientEnabled,
          widgetGradientEnabled,
          softEdgingEnabled,
          edgeFadeMask,
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

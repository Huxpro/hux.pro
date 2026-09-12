"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSunEventGradient, getWeatherGradient } from "./lib/gradient";
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
  BUILT_IN_WALLPAPERS,
  getWallpaperBackground,
  getWallpaperOrDefault,
  resolveAppearance,
  WALLPAPER_OPACITY,
  type Wallpaper,
  type WallpaperAppearance,
  type WallpaperSource,
} from "./lib/wallpaper";
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
// Wallpaper Context
//
// The background is one stack fed by exactly one source (see lib/wallpaper.ts),
// so "weather" and "picture" are mutually exclusive by construction — there is
// no state in which both can paint. Everything here persists to the same
// localStorage blob as the rest of the ambient settings.
// =============================================================================

interface WallpaperContextType {
  /** Which source currently feeds the background stack. */
  source: WallpaperSource;
  setSource: (source: WallpaperSource) => void;
  /** Selected built-in (meaningful when source === "picture"). */
  wallpaper: Wallpaper;
  wallpapers: Wallpaper[];
  /** Selects a picture wallpaper AND switches the source to it. */
  selectWallpaper: (id: string) => void;
  appearance: WallpaperAppearance;
  setAppearance: (appearance: WallpaperAppearance) => void;
  /** Which half of the pair "auto" lands on right now. */
  resolvedAppearance: "light" | "dark";
  /**
   * Opacity the background should render at, already resolved for the active
   * source, medium and theme. Weather gradients and vector wallpapers sit
   * higher than photographs, which carry far more contrast; a pair pinned
   * against the theme is pulled right back so text keeps its contrast.
   */
  opacity: number;
  /** Secondary window — the wallpaper picker. */
  isPickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
}

const WallpaperContext = createContext<WallpaperContextType | undefined>(undefined);

export function useWallpaper() {
  const context = useContext(WallpaperContext);
  if (!context) throw new Error("useWallpaper must be used within AmbientProvider");
  return context;
}

export function useOptionalWallpaper() {
  return useContext(WallpaperContext);
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

  // --- Wallpaper -----------------------------------------------------------
  // Switching the source swaps what feeds the background stack; the stack
  // itself crossfades, so weather → picture reads as a dissolve rather than a
  // cut. Picking a wallpaper from the picker implies switching to it, which is
  // what makes "one background at a time" feel like a single choice.
  const setWallpaperSource = useCallback(
    (source: WallpaperSource) => {
      if (source === settings.wallpaperSource) return;
      updateSettings({ wallpaperSource: source });
    },
    [settings.wallpaperSource, updateSettings]
  );

  const selectWallpaper = useCallback(
    (id: string) => {
      updateSettings({ wallpaperId: id, wallpaperSource: "picture" });
    },
    [updateSettings]
  );

  const setWallpaperAppearance = useCallback(
    (appearance: WallpaperAppearance) => {
      if (appearance === settings.wallpaperAppearance) return;
      updateSettings({ wallpaperAppearance: appearance });
    },
    [settings.wallpaperAppearance, updateSettings]
  );

  // Secondary window (the picker sheet). Ephemeral — never persisted.
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const openPicker = useCallback(() => setIsPickerOpen(true), []);
  const closePicker = useCallback(() => setIsPickerOpen(false), []);

  const activeWallpaper = useMemo(
    () => getWallpaperOrDefault(settings.wallpaperId),
    [settings.wallpaperId]
  );
  const isPictureSource = settings.wallpaperSource === "picture";
  const resolvedAppearance = resolveAppearance(settings.wallpaperAppearance, theme);

  // Weather gradients are vector artwork by nature, so they share the artwork
  // weighting. Pinning a pair against the app theme puts light artwork under
  // light text; the pin is the user's call so we keep it, but pulled right back
  // to a tint with the themed page background carrying the contrast.
  const wallpaperOpacity = useMemo(() => {
    if (!isPictureSource) return WALLPAPER_OPACITY.artwork[theme];
    if (resolvedAppearance !== theme) return theme === "dark" ? 0.3 : 0.25;
    return WALLPAPER_OPACITY[activeWallpaper.medium][theme];
  }, [isPictureSource, activeWallpaper, resolvedAppearance, theme]);

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

  // Compute the background. Exactly one source wins — a picture wallpaper
  // replaces the weather gradient outright rather than stacking over it. The
  // sun-event Live Activity is unaffected either way: it renders in the Dock
  // from weather + phase and never reads this.
  const computedGradient = useMemo(() => {
    if (isPictureSource) {
      return getWallpaperBackground({
        wallpaper: activeWallpaper,
        appearance: settings.wallpaperAppearance,
        theme,
      }).backgroundImage;
    }

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
  }, [
    isPictureSource,
    activeWallpaper,
    settings.wallpaperAppearance,
    isDevtoolEnabled,
    isOverrideEnabled,
    debugOverride,
    weatherQuery.data,
    effectivePhase,
    theme,
  ]);

  /** Picture wallpapers may be real image files, which must cover the frame. */
  const computedCover = useMemo(
    () =>
      isPictureSource &&
      getWallpaperBackground({
        wallpaper: activeWallpaper,
        appearance: settings.wallpaperAppearance,
        theme,
      }).cover,
    [isPictureSource, activeWallpaper, settings.wallpaperAppearance, theme]
  );

  // Gradient transition: a true crossfade between layers (no dip-to-background).
  // Centralized here so every consumer (full-page background, widget overlays)
  // shares one stack instead of running independent state machines. When the
  // gradient changes we push a new layer; <GradientStack /> fades it in over the
  // settled one, then we prune back to the latest once the crossfade completes.
  const [gradientLayers, setGradientLayers] = useState<GradientLayerData[]>([]);
  const layerIdRef = useRef(0);

  useEffect(() => {
    // Hold the current gradient while refetching (stale-while-revalidate).
    // A picture wallpaper needs no network, so it never waits on weather.
    if (!isPictureSource && weatherQuery.isFetching) return;
    if (!computedGradient) return;

    setGradientLayers((prev) => {
      const top = prev[prev.length - 1];
      if (top && top.gradient === computedGradient) return prev;
      layerIdRef.current += 1;
      return [
        ...prev,
        { id: layerIdRef.current, gradient: computedGradient, cover: computedCover },
      ];
    });
  }, [computedGradient, computedCover, isPictureSource, weatherQuery.isFetching]);

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
          <WallpaperContext.Provider
            value={{
              source: settings.wallpaperSource,
              setSource: setWallpaperSource,
              wallpaper: activeWallpaper,
              wallpapers: BUILT_IN_WALLPAPERS,
              selectWallpaper,
              appearance: settings.wallpaperAppearance,
              setAppearance: setWallpaperAppearance,
              resolvedAppearance,
              opacity: wallpaperOpacity,
              isPickerOpen,
              openPicker,
              closePicker,
            }}
          >
            {children}
          </WallpaperContext.Provider>
        </AmbientTimeContext.Provider>
      </WeatherContext.Provider>
    </LocationContext.Provider>
  );
}

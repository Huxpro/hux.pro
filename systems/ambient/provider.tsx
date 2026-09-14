"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSunEventGradient, getWeatherGradient } from "./lib/gradient";
import { GRADIENT_CROSSFADE_MS, type GradientLayerData } from "./lib/gradient";
import type { LocationMode, ResolvedLocation } from "./lib/location";
import { requestAccurateLocation as requestAccurateLocationFn } from "./lib/location";
import { useLocationQuery, useWeatherQuery } from "./lib/queries";
import {
  type AmbientSettings,
  type WallpaperPlacement,
  getAmbientSettings,
  getDefaultSettings,
  setAmbientSettings,
} from "./lib/settings";
import {
  BUILT_IN_WALLPAPERS,
  getWallpaperBackground,
  getWallpaperOrDefault,
  WALLPAPER_OPACITY,
  WALLPAPER_READING_VEIL,
  type Wallpaper,
  type WallpaperKind,
} from "./lib/wallpaper";
import {
  EDGE_FADE_MASK,
  EDGE_FADE_MASK_HIGH_CONTRAST,
  isIOSBrowser,
} from "./lib/platform";
import type { NormalizedWeather, WeatherCondition } from "./lib/weather";
import type { AmbientPhase } from "./lib/phase";
import { deriveAmbientPhase } from "./lib/phase";
import { usePathname } from "next/navigation";
import { isReadingSurface } from "./lib/reading-surface";
import { queryClient } from "@/lib/query";
import { useDevtool } from "@/systems/devtool";

/** The page ground as Safari's chrome tint — `--background` in both themes. */
const THEME_COLOR = { light: "#ffffff", dark: "#1a1a1a" } as const;
/** The letterbox frame — `--letterbox` in globals.css, the dark ground. */
const LETTERBOX_COLOR = THEME_COLOR.dark;

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
// The background is one stack fed by exactly one kind (see lib/wallpaper.ts),
// so "weather" and "image" are mutually exclusive by construction — there is
// no state in which both can paint. Everything here persists to the same
// localStorage blob as the rest of the ambient settings.
// =============================================================================

/**
 * DevTool-level overrides for the three resolved placement flags (ephemeral).
 * The persisted setting can only be one of them; the panel exists to see the
 * combinations it cannot express.
 */
export interface DevtoolPlacementOverrides {
  full?: boolean;
  widget?: boolean;
  softEdging?: boolean;
}

interface WallpaperContextType {
  /** Which kind currently feeds the background stack. */
  kind: WallpaperKind;
  setKind: (kind: WallpaperKind) => void;
  /** Selected built-in pair (meaningful when kind === "image"). */
  wallpaper: Wallpaper;
  wallpapers: Wallpaper[];
  /** Selects a pair AND switches the background kind to it. */
  selectWallpaper: (id: string) => void;
  /** Which half of the pair is showing — always the app theme. */
  variant: "light" | "dark";
  /** Where the active wallpaper paints. */
  placement: WallpaperPlacement;
  setPlacement: (placement: WallpaperPlacement) => void;
  /** Resolved from `placement`, or from a devtool override when one is set. */
  fullEnabled: boolean;
  widgetEnabled: boolean;
  softEdgeEnabled: boolean;
  /** Crossfade stack: [...settled, newest]. Render via <GradientStack />. */
  layers: GradientLayerData[];
  /** Resolved CSS mask-image value, or null when soft-edging is off. */
  edgeMask: string | null;
  /** Ephemeral devtool overrides for the three resolved flags. */
  devtoolOverrides: DevtoolPlacementOverrides;
  setDevtoolOverrides: (overrides: DevtoolPlacementOverrides) => void;
  /**
   * Opacity the wallpaper layer paints at. Images paint at full strength; the
   * weather gradient is a wash and sits below it.
   */
  opacity: number;
  /**
   * Alpha of the veil drawn OVER the wallpaper, or 0 for none. Non-zero only
   * on a reading page under an image wallpaper.
   */
  veil: number;
  /** Whether the wallpaper should be defocused right now. */
  blurred: boolean;
  /**
   * Letterbox — resolved. True paints everything outside the safe area black
   * and keeps the wallpaper inside it; see the effect in the provider.
   */
  letterbox: boolean;
  /** The stored choice: `null` is auto (on for iOS). */
  letterboxSetting: boolean | null;
  setLetterbox: (value: boolean | null) => void;
  /** Corner radius of the page inside the frame, px. */
  letterboxRadius: number;
  setLetterboxRadius: (px: number) => void;
  /** The reading treatment flags, for the devtool. */
  readingBlur: boolean;
  setReadingBlur: (value: boolean) => void;
  readingDim: boolean;
  setReadingDim: (value: boolean) => void;
  /** The file currently painting, for the devtool readout. */
  src: string | null;
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

interface WeatherContextType {
  weather: NormalizedWeather | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  isOverrideEnabled: boolean;
  setOverrideEnabled: (enabled: boolean) => void;
  debugOverride: WeatherDebugOverride | null;
  setDebugOverride: (override: WeatherDebugOverride | null) => void;
  refresh: () => void;
}

const WeatherContext = createContext<WeatherContextType | undefined>(undefined);

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
    setSettingsState(getAmbientSettings());
  }, []);

  const updateSettings = useCallback((partial: Partial<AmbientSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...partial };
      setAmbientSettings(next);
      return next;
    });
  }, []);

  const setPlacement = useCallback(
    (placement: WallpaperPlacement) => {
      if (placement === settings.wallpaperPlacement) return;
      updateSettings({ wallpaperPlacement: placement });
    },
    [settings.wallpaperPlacement, updateSettings]
  );

  // --- Wallpaper -----------------------------------------------------------
  // Switching the kind swaps what feeds the background stack; the stack itself
  // crossfades, so weather → image reads as a dissolve rather than a cut.
  // Picking a wallpaper from the picker implies switching to it, which is what
  // makes "one background at a time" feel like a single choice.
  const setWallpaperKind = useCallback(
    (kind: WallpaperKind) => {
      if (kind === settings.wallpaperKind) return;
      updateSettings({ wallpaperKind: kind });
    },
    [settings.wallpaperKind, updateSettings]
  );

  const selectWallpaper = useCallback(
    (id: string) => {
      updateSettings({ wallpaperId: id, wallpaperKind: "image" });
    },
    [updateSettings]
  );


  // Secondary window (the picker sheet). Ephemeral — never persisted.
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const openPicker = useCallback(() => setIsPickerOpen(true), []);
  const closePicker = useCallback(() => setIsPickerOpen(false), []);

  const activeWallpaper = useMemo(
    () => getWallpaperOrDefault(settings.wallpaperId),
    [settings.wallpaperId]
  );
  const isImageKind = settings.wallpaperKind === "image";

  const wallpaperOpacity = isImageKind
    ? WALLPAPER_OPACITY.image[theme]
    : WALLPAPER_OPACITY.weather[theme];

  const setLetterbox = useCallback(
    (value: boolean | null) => updateSettings({ wallpaperLetterbox: value }),
    [updateSettings]
  );
  const setLetterboxRadius = useCallback(
    (px: number) => updateSettings({ wallpaperLetterboxRadius: px }),
    [updateSettings]
  );
  const setReadingBlur = useCallback(
    (value: boolean) => updateSettings({ wallpaperReadingBlur: value }),
    [updateSettings]
  );
  const setReadingDim = useCallback(
    (value: boolean) => updateSettings({ wallpaperReadingDim: value }),
    [updateSettings]
  );

  // Home is the desktop: the picture stays sharp and untinted, because that is
  // the whole point of choosing one. Reading pages recede it instead — a veil
  // plus a defocus over the top, which costs far less of the image than dimming
  // the layer itself on every route alike.
  const pathname = usePathname();
  const reading = isReadingSurface({ kind: settings.wallpaperKind, pathname });
  const isBlurred = reading && settings.wallpaperReadingBlur;
  const veilAlpha =
    reading && settings.wallpaperReadingDim ? WALLPAPER_READING_VEIL[theme] : 0;

  // DevTool gradient overrides (ephemeral, not persisted)
  const [devtoolOverrides, setDevtoolOverrides] =
    useState<DevtoolPlacementOverrides>({});

  // 3 resolved rendering flags.
  // DevTool overrides bypass all natural derivation.
  // Hydration-safe: false on the server and the first client render, then the
  // real answer. It now decides rendered structure (the letterbox frame), so a
  // render-time read would disagree with the server HTML.
  // `null` until then: the boot script in app/layout.tsx has already put the
  // letterbox class on <html> for a phone, and the effect below must not take
  // it off for the one frame before the platform is known.
  const [isIOS, setIsIOS] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: platform read
    setIsIOS(isIOSBrowser());
  }, []);

  const fullEnabled =
    isDevtoolEnabled && devtoolOverrides.full !== undefined
      ? devtoolOverrides.full
      : settings.wallpaperPlacement === "full";

  const widgetEnabled =
    isDevtoolEnabled && devtoolOverrides.widget !== undefined
      ? devtoolOverrides.widget
      : settings.wallpaperPlacement === "widget";

  /**
   * Letterbox — the ryOS answer to a full-bleed background on a phone.
   *
   * iOS Safari is where the soft edge has always been fragile: the fixed
   * background resizes as the toolbar collapses, the mask's bottom stop rides
   * `safe-area-inset-bottom`, and whatever the page paints under the notch
   * and the home indicator is what shows through. ryOS (os.ryo.lu) does not
   * fight any of that. It paints `<html>` in one flat frame colour, sets
   * `theme-color` to match so Safari's own chrome is the same, and keeps the
   * desktop inside the safe area. The wallpaper then ends on a hard line
   * against the frame, and the frame is what surrounds it on every side — the
   * status bar, the toolbar, the overscroll — so there is no seam left for a
   * fade to soften. Our frame colour is the dark ground in both themes
   * (globals.css says why it is not black).
   *
   * Auto is iOS. The setting is persisted so a phone can be checked across a
   * reload; the devtool row toggles it.
   */
  const letterbox = settings.wallpaperLetterbox ?? isIOS === true;

  useEffect(() => {
    if (isIOS === null) return;
    const root = document.documentElement;
    root.classList.toggle("letterbox", letterbox);
    // The boot script's inline background (there before the stylesheet); the
    // class carries it from here on, so this only has to clear it on off.
    root.style.backgroundColor = letterbox ? LETTERBOX_COLOR : "";
  }, [letterbox, isIOS]);

  // iOS 18 Safari tints its status bar with theme-color, so this is what keeps
  // the letterbox continuous with it there. (iOS 26 ignores theme-color and
  // samples the page's own edge pixels — the bands do that job; this stays for
  // the older generation and for the Home Screen web app.) The element is
  // ours, not React's — created before first paint by the inline script in
  // app/layout.tsx and only updated here. Next streams its own metadata in
  // after this effect has run, so a React-owned meta mutated here would be a
  // hydration mismatch; and one created only here arrived too late for
  // Safari to tint from on a phone.
  useEffect(() => {
    let meta = document.head.querySelector<HTMLMetaElement>("#hux-theme-color");
    if (!meta) {
      meta = document.createElement("meta");
      meta.id = "hux-theme-color";
      meta.name = "theme-color";
      document.head.append(meta);
    }
    // Letterboxed, the frame colour (`--letterbox`, the dark ground) in both
    // themes — Safari refused a black tint on a phone and kept its own grey,
    // and #1a1a1a it honours. Otherwise the theme's page ground.
    meta.content = letterbox
      ? LETTERBOX_COLOR
      : theme === "dark"
        ? THEME_COLOR.dark
        : THEME_COLOR.light;
  }, [letterbox, theme]);

  // Soft edging fades the background out at the top and bottom of the viewport.
  // It exists for phones: a full-bleed background running under the notch and
  // the home indicator ends in a hard line otherwise. Same switch, same masks,
  // for both wallpaper kinds — an image layer is just another layer in the
  // stack, so it gets exactly what the weather gradient gets. Letterbox makes
  // it redundant: the edge it hides is then a clean line against black.
  const softEdgeEnabled =
    isDevtoolEnabled && devtoolOverrides.softEdging !== undefined
      ? devtoolOverrides.softEdging
      : isIOS === true && !letterbox;

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
  const edgeMask: string | null = softEdgeEnabled
    ? theme === "dark" &&
      (effectivePhase === "sunrise" || effectivePhase === "sunset")
      ? EDGE_FADE_MASK_HIGH_CONTRAST
      : EDGE_FADE_MASK
    : null;

  /**
   * The active pair resolved for the current theme, or null on weather.
   *
   * A blurred reading page resolves to the THUMB. The layer there is scaled to
   * 110% under a 40px blur, which destroys every pixel of detail the full-size
   * file was carrying — measured over the whole viewport, the 480px rendition
   * differs from the 2560px one by 0.15/255 on average and 2/255 at worst, in
   * both themes, for a tenth of the bytes (46KB → 4KB).
   *
   * Only when blurred. In `widget` placement, and on the home screen, the photo
   * paints SHARP inside a card or across the page, and there the thumb is a
   * visibly soft upscale rather than a free win.
   */
  const resolvedImage = useMemo(
    () =>
      isImageKind
        ? getWallpaperBackground({
            wallpaper: activeWallpaper,
            theme,
            preview: isBlurred,
          })
        : null,
    [isImageKind, activeWallpaper, theme, isBlurred]
  );

  // Compute the background. Exactly one kind wins — an image wallpaper replaces
  // the weather gradient outright rather than stacking over it. The sun-event
  // Live Activity is unaffected either way: it renders in the Dock from weather
  // + phase and never reads this.
  const computedGradient = useMemo(() => {
    if (resolvedImage) return resolvedImage.backgroundImage;

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
    resolvedImage,
    isDevtoolEnabled,
    isOverrideEnabled,
    debugOverride,
    weatherQuery.data,
    effectivePhase,
    theme,
  ]);

  /** Images must cover the frame; the weather gradient already fills it. */
  const computedCover = resolvedImage?.cover ?? false;
  const wallpaperSrc = resolvedImage?.src ?? null;

  // Gradient transition: a true crossfade between layers (no dip-to-background).
  // Centralized here so every consumer (full-page background, widget overlays)
  // shares one stack instead of running independent state machines. When the
  // gradient changes we push a new layer; <GradientStack /> fades it in over the
  // settled one, then we prune back to the latest once the crossfade completes.
  const [layers, setGradientLayers] = useState<GradientLayerData[]>([]);
  const layerIdRef = useRef(0);

  useEffect(() => {
    // Hold the current gradient while refetching (stale-while-revalidate).
    // A image wallpaper needs no network, so it never waits on weather.
    if (!isImageKind && weatherQuery.isFetching) return;
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
  }, [computedGradient, computedCover, isImageKind, weatherQuery.isFetching]);

  // Prune to the newest layer once the crossfade settles.
  useEffect(() => {
    if (layers.length <= 1) return;
    const timeout = setTimeout(() => {
      setGradientLayers((prev) => (prev.length <= 1 ? prev : prev.slice(-1)));
    }, GRADIENT_CROSSFADE_MS + 50);
    return () => clearTimeout(timeout);
  }, [layers]);

  // Memoised, because this provider re-renders often — the 60s clock tick, every
  // React Query transition, every crossfade push and prune, and (since the
  // reading surface moved in here) every navigation. A fresh object literal on
  // any of those would re-render every consumer app-wide: the background, every
  // widget card, the palette, the dock, the devtool. The setters are already
  // useCallback-stable, so the memo actually holds.
  const locationValue = useMemo(
    () => ({
      locationMode: settings.locationMode,
      location: locationQuery.data ?? null,
      isLoading: locationQuery.isLoading,
      isFetching: locationQuery.isFetching,
      error: locationQuery.error?.message ?? null,
      setLocationMode,
      requestAccurateLocation: requestAccurateLocationAction,
      refresh: refreshLocation,
    }),
    [
      settings.locationMode,
      locationQuery.data,
      locationQuery.isLoading,
      locationQuery.isFetching,
      locationQuery.error,
      setLocationMode,
      requestAccurateLocationAction,
      refreshLocation,
    ]
  );

  const weatherValue = useMemo(
    () => ({
      weather: weatherQuery.data ?? null,
      isLoading: weatherQuery.isLoading,
      isFetching: weatherQuery.isFetching,
      error: weatherQuery.error?.message ?? null,
      isOverrideEnabled,
      setOverrideEnabled: setIsOverrideEnabled,
      debugOverride,
      setDebugOverride,
      refresh: refreshWeather,
    }),
    [
      weatherQuery.data,
      weatherQuery.isLoading,
      weatherQuery.isFetching,
      weatherQuery.error,
      isOverrideEnabled,
      debugOverride,
      refreshWeather,
    ]
  );

  const timeValue = useMemo(
    () => ({
      nowMs,
      derivedPhase,
      phase: effectivePhase,
      isOverrideEnabled: isTimeOverrideEnabled,
      setOverrideEnabled: setIsTimeOverrideEnabled,
      overridePhase: timeOverridePhase,
      setOverridePhase: setTimeOverridePhase,
    }),
    [nowMs, derivedPhase, effectivePhase, isTimeOverrideEnabled, timeOverridePhase]
  );

  const wallpaperValue = useMemo(
    () => ({
      kind: settings.wallpaperKind,
      setKind: setWallpaperKind,
      wallpaper: activeWallpaper,
      wallpapers: BUILT_IN_WALLPAPERS,
      selectWallpaper,
      variant: theme,
      placement: settings.wallpaperPlacement,
      setPlacement,
      fullEnabled,
      widgetEnabled,
      softEdgeEnabled,
      layers,
      edgeMask,
      devtoolOverrides,
      setDevtoolOverrides,
      opacity: wallpaperOpacity,
      veil: veilAlpha,
      blurred: isBlurred,
      letterbox,
      letterboxSetting: settings.wallpaperLetterbox,
      setLetterbox,
      letterboxRadius: settings.wallpaperLetterboxRadius,
      setLetterboxRadius,
      readingBlur: settings.wallpaperReadingBlur,
      setReadingBlur,
      readingDim: settings.wallpaperReadingDim,
      setReadingDim,
      src: wallpaperSrc,
      isPickerOpen,
      openPicker,
      closePicker,
    }),
    [
      settings.wallpaperKind,
      settings.wallpaperPlacement,
      settings.wallpaperLetterbox,
      settings.wallpaperLetterboxRadius,
      settings.wallpaperReadingBlur,
      settings.wallpaperReadingDim,
      setWallpaperKind,
      activeWallpaper,
      selectWallpaper,
      theme,
      setPlacement,
      fullEnabled,
      widgetEnabled,
      softEdgeEnabled,
      layers,
      edgeMask,
      devtoolOverrides,
      wallpaperOpacity,
      veilAlpha,
      isBlurred,
      letterbox,
      setLetterbox,
      setLetterboxRadius,
      setReadingBlur,
      setReadingDim,
      wallpaperSrc,
      isPickerOpen,
      openPicker,
      closePicker,
    ]
  );

  return (
    <LocationContext.Provider value={locationValue}>
      <WeatherContext.Provider value={weatherValue}>
        <AmbientTimeContext.Provider value={timeValue}>
          <WallpaperContext.Provider value={wallpaperValue}>
            {children}
          </WallpaperContext.Provider>
        </AmbientTimeContext.Provider>
      </WeatherContext.Provider>
    </LocationContext.Provider>
  );
}

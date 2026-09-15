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
  PAGE_GROUND,
  resolveBezelTint,
  WALLPAPER_KIND_EDGES,
  type BezelTint,
} from "./lib/bezel";
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
  DEFAULT_BEZEL_BAND,
  DEFAULT_BEZEL_RADIUS,
  type BezelScroll,
} from "@hux/bezel";
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
  /** Bezel on or off, for this session. */
  bezel?: boolean;
  /** Where the page scrolls, for this session, instead of the platform's choice. */
  scroll?: BezelScroll;
  /**
   * Which kind switch `softEdging` and `bezel` were set after. They describe
   * the edge of the kind showing at the time, so any kind switch ends them —
   * switching to weather turns the bezel off even if it was forced on, and
   * switching back does not bring the override back. Stamped by the provider;
   * callers never set it.
   */
  edgeEpoch?: number;
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
  /** Whether this page recedes the wallpaper — see `isReadingSurface`. */
  reading: boolean;
  /** Whether the bezel is drawn. Live. */
  bezel: boolean;
  /** `bezel`, but `null` until settings and platform are known. For <Bezel>. */
  bezelState: boolean | null;
  /** Where the page scrolls: in the bezel's container while the bezel is on, on iOS. */
  bezelScroll: BezelScroll;
  /** The bezel colour, resolved from the tint. */
  bezelColor: string;
  bezelTint: BezelTint;
  setBezelTint: (tint: BezelTint) => void;
  /** Band thickness, px, and the saved value (`null` is the default). */
  bezelBand: number;
  bezelBandSetting: number | null;
  setBezelBand: (px: number | null) => void;
  /** Inner corner radius, px, and the saved value (`null` is the default). */
  bezelRadius: number;
  bezelRadiusSetting: number | null;
  setBezelRadius: (px: number | null) => void;
  /** The page's ground in the current theme: the chrome colour while the bezel is off. */
  ground: string;
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
  /** Whether `settings` is the stored one yet, rather than the SSR defaults. */
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: localStorage read
    setSettingsState(getAmbientSettings());
    setSettingsLoaded(true);
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
  // Counts kind switches, so edge overrides from before one stop applying.
  const [edgeEpoch, setEdgeEpoch] = useState(0);

  const setWallpaperKind = useCallback(
    (kind: WallpaperKind) => {
      if (kind === settings.wallpaperKind) return;
      setEdgeEpoch((epoch) => epoch + 1);
      updateSettings({ wallpaperKind: kind });
    },
    [settings.wallpaperKind, updateSettings]
  );

  const selectWallpaper = useCallback(
    (id: string) => {
      if (settings.wallpaperKind !== "image") setEdgeEpoch((epoch) => epoch + 1);
      updateSettings({ wallpaperId: id, wallpaperKind: "image" });
    },
    [settings.wallpaperKind, updateSettings]
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

  const wallpaperOpacity = WALLPAPER_OPACITY[settings.wallpaperKind][theme];

  const setBezelRadius = useCallback(
    (px: number | null) => updateSettings({ bezelRadius: px }),
    [updateSettings]
  );
  const setBezelTint = useCallback(
    (tint: BezelTint) => updateSettings({ bezelTint: tint }),
    [updateSettings]
  );
  const setBezelBand = useCallback(
    (px: number | null) => updateSettings({ bezelBand: px }),
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
  const [storedOverrides, setStoredOverrides] =
    useState<DevtoolPlacementOverrides>({});
  // Edge overrides stamped with the kind switch they were set after…
  const setDevtoolOverrides = useCallback(
    (next: DevtoolPlacementOverrides) => setStoredOverrides({ ...next, edgeEpoch }),
    [edgeEpoch]
  );
  // …and dropped once the kind has switched since.
  const devtoolOverrides = useMemo<DevtoolPlacementOverrides>(() => {
    if (storedOverrides.edgeEpoch === edgeEpoch) return storedOverrides;
    return {
      full: storedOverrides.full,
      widget: storedOverrides.widget,
      scroll: storedOverrides.scroll,
    };
  }, [storedOverrides, edgeEpoch]);

  // 3 resolved rendering flags.
  // DevTool overrides bypass all natural derivation.
  // Hydration-safe: false on the server and the first client render, then the
  // real answer. It decides rendered structure (the bezel), so a render-time
  // read would disagree with the server HTML. `null` until then: the boot
  // script has already put the bezel on <html> for a phone, and it must not
  // come off for the one frame before the platform is known.
  const [isIOS, setIsIOS] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: platform read
    setIsIOS(isIOSBrowser());
  }, []);

  const overridden = (
    key: "full" | "widget" | "softEdging" | "bezel",
    natural: boolean
  ): boolean => (isDevtoolEnabled ? devtoolOverrides[key] : undefined) ?? natural;

  const fullEnabled = overridden("full", settings.wallpaperPlacement === "full");
  const widgetEnabled = overridden(
    "widget",
    settings.wallpaperPlacement === "widget"
  );

  /**
   * The bezel — @hux/bezel, configured in ./lib/bezel. Live.
   *
   * The wallpaper kind decides whether it is on (`WALLPAPER_KIND_EDGES`), on
   * iOS only; a devtool override for this session wins over the kind until the
   * kind changes. Band, radius and tint are saved settings, the same for every
   * kind. `null` until the stored settings and the platform are both known: a
   * `false` before then would take off the bezel the boot script painted.
   */
  const edges = WALLPAPER_KIND_EDGES[settings.wallpaperKind];
  const bezelState: boolean | null =
    !settingsLoaded || isIOS === null ? null : overridden("bezel", isIOS && edges.bezel);
  const bezel = bezelState === true;
  // Container scroll on an iPhone with the bezel on: it is what lets a band
  // thinner than CHROME_SAMPLE_PX keep the chrome in the bezel colour, and
  // what stops the toolbar collapsing. The devtool can pick either.
  const bezelScroll: BezelScroll =
    (isDevtoolEnabled ? devtoolOverrides.scroll : undefined) ??
    (bezel && isIOS === true ? "container" : "window");
  const bezelColor = resolveBezelTint(settings.bezelTint, theme);
  const bezelBand = settings.bezelBand ?? DEFAULT_BEZEL_BAND;
  const bezelRadius = settings.bezelRadius ?? DEFAULT_BEZEL_RADIUS;
  const ground = PAGE_GROUND[theme];

  // Soft edging fades the background out at the top and bottom of the viewport.
  // It exists for phones: a full-bleed background running under the notch and
  // the home indicator ends in a hard line otherwise. Same switch, same masks,
  // for both wallpaper kinds. The kind decides whether it is on by default, and
  // only while the bezel is off: the edge it hides is then a clean line against
  // the bezel.
  const softEdgeEnabled = overridden(
    "softEdging",
    isIOS === true && edges.softEdge && !bezel
  );

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

  /** Images must cover the layer; the weather gradient already fills it. */
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
      reading,
      bezel,
      bezelState,
      bezelScroll,
      bezelColor,
      bezelTint: settings.bezelTint,
      setBezelTint,
      bezelBand,
      bezelBandSetting: settings.bezelBand,
      setBezelBand,
      bezelRadius,
      bezelRadiusSetting: settings.bezelRadius,
      setBezelRadius,
      ground,
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
      settings.bezelTint,
      settings.bezelBand,
      settings.bezelRadius,
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
      reading,
      setDevtoolOverrides,
      bezel,
      bezelState,
      bezelScroll,
      bezelColor,
      setBezelTint,
      bezelBand,
      setBezelBand,
      bezelRadius,
      setBezelRadius,
      ground,
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

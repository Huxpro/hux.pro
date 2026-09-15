"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getWeatherStyleGradient } from "./lib/gradient";
import { GRADIENT_CROSSFADE_MS, type GradientLayerData } from "./lib/gradient";
import type { LocationMode, ResolvedLocation } from "./lib/location";
import { requestAccurateLocation as requestAccurateLocationFn } from "./lib/location";
import { useLocationQuery, useWeatherQuery } from "./lib/queries";
import {
  deriveWeatherScene,
  toSceneWeather,
  type SceneOverrides,
  type SceneWeatherInput,
  type WeatherScene,
} from "./lib/scene";
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
  WALLPAPER_FAMILY_EDGES,
  type BezelTint,
} from "./lib/bezel";
import {
  BUILT_IN_WALLPAPERS,
  getWallpaperBackground,
  getWallpaperLook,
  getWallpaperOrDefault,
  readWeatherStyle,
  resolveWeatherStyle,
  WALLPAPER_LOOK_FAMILY,
  WALLPAPER_OPACITY,
  WALLPAPER_READING_VEIL,
  WEATHER_STYLE_ENGINE,
  type Wallpaper,
  type WallpaperEngine,
  type WallpaperFamily,
  type WallpaperKind,
  type WeatherStyle,
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
import type { WallpaperStats } from "./lib/wallpaper/renderer";
import { supportsWebGL2 } from "./lib/wallpaper/support";
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
//
// One clock. Everything time-shaped — the sun and moon, the sky, the phase,
// the greeting, the sun-event notice — reads `nowMs` from here, so devtool
// time travel moves all of it together and nothing can disagree.
// =============================================================================

interface AmbientTimeContextType {
  /** Effective "now" — real time, or the devtool time-travel clock. */
  nowMs: number;
  /** Real wall-clock time, untouched by time travel (the devtool's "now" mark). */
  realNowMs: number;
  /** Derived from `nowMs` and the sun times; there is no phase override. */
  phase: AmbientPhase;
  /** Sunrise / sunset for the effective day (shifted with `dayOffset`). */
  sunriseMs?: number;
  sunsetMs?: number;
  /**
   * Devtool time travel. `timeScrubMinutes` pins the clock to minutes since
   * local midnight (null = real time of day); `dayOffset` moves the calendar
   * day by whole days (0 = today), which is what changes the moon's phase.
   */
  timeScrubMinutes: number | null;
  setTimeScrubMinutes: (minutes: number | null) => void;
  dayOffset: number;
  setDayOffset: (days: number) => void;
  isTimeTravelActive: boolean;
  resetTimeTravel: () => void;
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
// no state in which both can paint. Under "weather", `weatherStyle` picks one
// of three: the Sky (shader), the Gradient (CSS, live) or the Classic palettes
// (CSS, stepped). Everything here persists to the same localStorage blob as
// the rest of the ambient settings.
// =============================================================================

/**
 * DevTool-level overrides (ephemeral). The three placement flags exist because
 * the persisted setting can only be one of them; the panel exists to see the
 * combinations it cannot express. `noWebGL` pretends WebGL2 is missing, so the
 * Sky's fallback can be seen on a machine that has it.
 */
export interface DevtoolWallpaperOverrides {
  full?: boolean;
  widget?: boolean;
  softEdging?: boolean;
  /** Bezel on or off, for this session. */
  bezel?: boolean;
  /** Where the page scrolls, for this session, instead of the platform's choice. */
  scroll?: BezelScroll;
  /** Pretend WebGL2 is missing: the Sky paints its Gradient fallback. */
  noWebGL?: boolean;
  /**
   * The wallpaper family `softEdging` and `bezel` were set under. They
   * describe the edge of what was showing at the time, so once the family
   * changes (picture ↔ wash: a kind switch, or Sky ↔ a CSS style) they no
   * longer apply — switching to the gradient turns the bezel off even if it
   * was forced on, and switching back does not bring the override back.
   * Stamped by the provider; callers never set it.
   */
  edgeFamily?: WallpaperFamily;
}

interface WallpaperContextType {
  /** Which kind currently feeds the background stack. */
  kind: WallpaperKind;
  setKind: (kind: WallpaperKind) => void;
  /** Which weather wallpaper is wanted (meaningful when kind === "weather"). */
  weatherStyle: WeatherStyle;
  /** Selects a weather style AND switches the background kind to weather. */
  selectWeather: (style: WeatherStyle) => void;
  /** The style actually painting: the wanted one, unless the Sky fell back. */
  effectiveStyle: WeatherStyle;
  /** Which engine paints the full-page weather layer right now. */
  renderer: WallpaperEngine;
  /** WebGL2 available in this browser (false → the gradient paints). */
  shaderSupported: boolean;
  /** The shader hit an unrecoverable WebGL problem; fall back to CSS. */
  reportShaderFallback: (reason: string) => void;
  /** A getter for live renderer stats, set by <WeatherWallpaper /> (devtool readout). */
  statsRef: React.MutableRefObject<(() => WallpaperStats) | null>;
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
  /** Ephemeral devtool overrides. */
  devtoolOverrides: DevtoolWallpaperOverrides;
  setDevtoolOverrides: (overrides: DevtoolWallpaperOverrides) => void;
  /**
   * Opacity the wallpaper layer paints at. Images and the CG sky paint at full
   * strength; the weather gradient is a wash and sits below it.
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

/**
 * Devtool weather override: the condition only. Day/night is never a choice —
 * it follows the clock (real or time-travelled), so a forced condition can't
 * put a moon in a daytime sky. Null means the real weather.
 */
export interface WeatherDebugOverride {
  condition: WeatherCondition;
}

interface WeatherContextType {
  weather: NormalizedWeather | null;
  /** The renderer-agnostic wallpaper description (see lib/scene.ts). */
  scene: WeatherScene;
  /**
   * The weather as the scene sees it — real measurements, or the override's
   * profile — for anything that wants to derive a scene at another time.
   */
  sceneWeather: SceneWeatherInput | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  /** Non-null while the devtool forces a condition. */
  debugOverride: WeatherDebugOverride | null;
  setDebugOverride: (override: WeatherDebugOverride | null) => void;
  /** Devtool scene tweaks (cloud cover, precipitation, wind, veil). */
  sceneOverrides: SceneOverrides;
  setSceneOverrides: (overrides: SceneOverrides) => void;
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

/** The reference day at `minutes` past local midnight. */
function scrubToMs(minutes: number, referenceMs: number): number {
  const d = new Date(referenceMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + minutes * 60_000;
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
  // Picking anything from the picker implies switching to it, which is what
  // makes "one background at a time" feel like a single choice.
  const setWallpaperKind = useCallback(
    (kind: WallpaperKind) => {
      if (kind === settings.wallpaperKind) return;
      updateSettings({ wallpaperKind: kind });
    },
    [settings.wallpaperKind, updateSettings]
  );

  const selectWallpaper = useCallback(
    (id: string) => updateSettings({ wallpaperId: id, wallpaperKind: "image" }),
    [updateSettings]
  );

  const selectWeather = useCallback(
    (style: WeatherStyle) =>
      updateSettings({ weatherStyle: readWeatherStyle(style), wallpaperKind: "weather" }),
    [updateSettings]
  );

  // The look the settings ask for, before WebGL support is known — what the
  // edge of the page is resolved from, so the boot script and the provider
  // agree on the first frame, and a Sky that falls back keeps its frame.
  const edgeFamily =
    WALLPAPER_LOOK_FAMILY[getWallpaperLook(settings.wallpaperKind, settings.weatherStyle)];

  // Secondary window (the picker sheet). Ephemeral — never persisted.
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const openPicker = useCallback(() => setIsPickerOpen(true), []);
  const closePicker = useCallback(() => setIsPickerOpen(false), []);

  const activeWallpaper = useMemo(
    () => getWallpaperOrDefault(settings.wallpaperId),
    [settings.wallpaperId]
  );
  const isImageKind = settings.wallpaperKind === "image";

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

  // DevTool overrides (ephemeral, not persisted)
  const [storedOverrides, setStoredOverrides] =
    useState<DevtoolWallpaperOverrides>({});
  // Edge overrides stamped with the family they were set under…
  const setDevtoolOverrides = useCallback(
    (next: DevtoolWallpaperOverrides) => setStoredOverrides({ ...next, edgeFamily }),
    [edgeFamily]
  );
  // …and dropped once the family has changed since.
  const devtoolOverrides = useMemo<DevtoolWallpaperOverrides>(() => {
    if (storedOverrides.edgeFamily === edgeFamily) return storedOverrides;
    return {
      full: storedOverrides.full,
      widget: storedOverrides.widget,
      scroll: storedOverrides.scroll,
      noWebGL: storedOverrides.noWebGL,
    };
  }, [storedOverrides, edgeFamily]);

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
   * The wallpaper's family decides whether it is on (`WALLPAPER_FAMILY_EDGES`:
   * a picture — the Sky or an image — is framed, a wash fades), on iOS only;
   * a devtool override for this session wins until the family changes. Band,
   * radius and tint are saved settings, the same for every kind. `null` until
   * the stored settings and the platform are both known: a `false` before
   * then would take off the bezel the boot script painted.
   */
  const edges = WALLPAPER_FAMILY_EDGES[edgeFamily];
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
  // for every wallpaper. The edge look decides whether it is on by default, and
  // only while the bezel is off: the edge it hides is then a clean line against
  // the bezel.
  const softEdgeEnabled = overridden(
    "softEdging",
    isIOS === true && edges.softEdge && !bezel
  );

  // --- Weather engine ------------------------------------------------------
  // WebGL support is probed after mount so the SSR tree (no canvas) matches the
  // first client render. A failure at any later point flips the session to CSS.
  const [shaderSupported, setShaderSupported] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only WebGL probe after mount
    setShaderSupported(supportsWebGL2());
  }, []);
  const reportShaderFallback = useCallback((reason: string) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[ambient] the Sky fell back to the Gradient: ${reason}`);
    }
    setShaderSupported(false);
  }, []);
  const statsRef = useRef<(() => WallpaperStats) | null>(null);

  // The style that paints: the Sky needs WebGL2 (real, or not pretended away
  // by the devtool) and otherwise becomes the Gradient. Nothing else falls back.
  const effectiveStyle = resolveWeatherStyle({
    weatherStyle: settings.weatherStyle,
    shaderSupported:
      shaderSupported && !(isDevtoolEnabled && devtoolOverrides.noWebGL === true),
  });
  const renderer: WallpaperEngine = WEATHER_STYLE_ENGINE[effectiveStyle];
  // Opacity follows what is painting, not what was asked for: a Sky that fell
  // back to the Gradient is a wash.
  const wallpaperOpacity =
    WALLPAPER_OPACITY[
      WALLPAPER_LOOK_FAMILY[getWallpaperLook(settings.wallpaperKind, effectiveStyle)]
    ][theme];

  // --- Debug state (weather + time) -----------------------------------------
  const [debugOverride, setDebugOverride] = useState<WeatherDebugOverride | null>(null);
  const [sceneOverrides, setSceneOverrides] = useState<SceneOverrides>({});
  const [timeScrubMinutes, setTimeScrubMinutes] = useState<number | null>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const [realNowMs, setRealNowMs] = useState(() => Date.now());
  const resetTimeTravel = useCallback(() => {
    setTimeScrubMinutes(null);
    setDayOffset(0);
  }, []);

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

  // Update "now" every minute. The sky's sun arc and palette derive from this,
  // so dawn and dusk progress continuously.
  useEffect(() => {
    const id = window.setInterval(() => setRealNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Refetch weather when the local day rolls over. Open-Meteo returns a single
  // forecast day, so a page left open overnight would otherwise keep yesterday's
  // sunrise/sunset — staling everything derived from them (phase, sky,
  // greeting, and the phase notification). The minute tick above makes this fire
  // within ~60s of midnight.
  const lastDayRef = useRef(new Date().toDateString());
  useEffect(() => {
    const today = new Date(realNowMs).toDateString();
    if (lastDayRef.current === today) return;
    lastDayRef.current = today;
    queryClient.invalidateQueries({ queryKey: ["weather"] });
  }, [realNowMs]);

  // --- The effective clock --------------------------------------------------
  const isTimeTravelActive =
    isDevtoolEnabled && (timeScrubMinutes !== null || dayOffset !== 0);
  const dayShiftMs = isDevtoolEnabled ? dayOffset * 86_400_000 : 0;
  const baseNowMs = realNowMs + dayShiftMs;
  const nowMs =
    isDevtoolEnabled && timeScrubMinutes !== null
      ? scrubToMs(timeScrubMinutes, baseNowMs)
      : baseNowMs;

  // Open-Meteo gives today's sunrise/sunset; a shifted day reuses them at the
  // same clock time (a few minutes of seasonal drift is irrelevant here).
  const sunriseMs =
    typeof weatherQuery.data?.sunriseMs === "number"
      ? weatherQuery.data.sunriseMs + dayShiftMs
      : undefined;
  const sunsetMs =
    typeof weatherQuery.data?.sunsetMs === "number"
      ? weatherQuery.data.sunsetMs + dayShiftMs
      : undefined;

  const phase = useMemo(
    () => deriveAmbientPhase({ nowMs, sunriseMs, sunsetMs }),
    [nowMs, sunriseMs, sunsetMs]
  );

  // Resolve which edge-fade mask to use.
  // Special case: dark-mode sunrise/sunset has high gradient-vs-background
  // contrast, so we use a more aggressive (wider) fade to soften the edge.
  const edgeMask: string | null = softEdgeEnabled
    ? theme === "dark" && (phase === "sunrise" || phase === "sunset")
      ? EDGE_FADE_MASK_HIGH_CONTRAST
      : EDGE_FADE_MASK
    : null;

  // ---------------------------------------------------------------------------
  // Scene — the single source of truth for both weather engines.
  // ---------------------------------------------------------------------------

  // Stable per-session seed so cloud layouts don't re-roll on every render.
  const [sceneSeed] = useState(() => Math.floor(Math.random() * 1000) / 10);

  const activeOverride = isDevtoolEnabled ? debugOverride : null;

  // The effective day's sun times go in, so time travel shifts them too.
  const sceneWeather = useMemo<SceneWeatherInput | null>(
    () => toSceneWeather(weatherQuery.data ?? null, activeOverride, { sunriseMs, sunsetMs }),
    [weatherQuery.data, activeOverride, sunriseMs, sunsetMs]
  );

  const scene = useMemo<WeatherScene>(() => {
    const location = locationQuery.data ?? null;
    // No geometry overrides: the sun and moon always come from the real
    // ephemeris at the effective clock. A forced *condition* only changes the
    // weather; to preview it at night, move the clock.
    return deriveWeatherScene({
      nowMs,
      lat: location?.lat,
      lon: location?.lon,
      weather: sceneWeather,
      theme,
      overrides: isDevtoolEnabled ? sceneOverrides : undefined,
      seed: sceneSeed,
    });
  }, [
    locationQuery.data,
    nowMs,
    sceneWeather,
    theme,
    isDevtoolEnabled,
    sceneOverrides,
    sceneSeed,
  ]);

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

  // Compute the CSS background. Exactly one kind wins — an image wallpaper
  // replaces the weather sky outright rather than stacking over it. Under
  // weather it is the Classic palette when that style is chosen, otherwise the
  // gradient rendering of the scene: the full-page layer under Gradient (or a
  // Sky fallback), and what widget cards paint under the Sky. The sun-event
  // Live Activity is unaffected either way: it renders in the Dock from the
  // clock and never reads this.
  const computedGradient = useMemo(
    () =>
      resolvedImage
        ? resolvedImage.backgroundImage
        : getWeatherStyleGradient(effectiveStyle, scene, phase),
    [resolvedImage, effectiveStyle, scene, phase]
  );

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

  // Under the Sky, full page, nothing paints the CSS stack: skip the push, or
  // every minute's new gradient would re-render every widget card twice (push,
  // prune) for a layer nobody shows. It catches up as soon as something does.
  const stackPainted = renderer === "css" || widgetEnabled;

  useEffect(() => {
    if (!stackPainted) return;
    // Hold the current gradient while refetching (stale-while-revalidate).
    // An image wallpaper needs no network, so it never waits on weather.
    if (!isImageKind && weatherQuery.isFetching && layerIdRef.current > 0) return;
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
  }, [stackPainted, computedGradient, computedCover, isImageKind, weatherQuery.isFetching]);

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
      scene,
      sceneWeather,
      isLoading: weatherQuery.isLoading,
      isFetching: weatherQuery.isFetching,
      error: weatherQuery.error?.message ?? null,
      debugOverride,
      setDebugOverride,
      sceneOverrides,
      setSceneOverrides,
      refresh: refreshWeather,
    }),
    [
      weatherQuery.data,
      weatherQuery.isLoading,
      weatherQuery.isFetching,
      weatherQuery.error,
      scene,
      sceneWeather,
      debugOverride,
      sceneOverrides,
      refreshWeather,
    ]
  );

  const timeValue = useMemo(
    () => ({
      nowMs,
      realNowMs,
      phase,
      sunriseMs,
      sunsetMs,
      timeScrubMinutes,
      setTimeScrubMinutes,
      dayOffset,
      setDayOffset,
      isTimeTravelActive,
      resetTimeTravel,
    }),
    [
      nowMs,
      realNowMs,
      phase,
      sunriseMs,
      sunsetMs,
      timeScrubMinutes,
      dayOffset,
      isTimeTravelActive,
      resetTimeTravel,
    ]
  );

  const wallpaperValue = useMemo(
    () => ({
      kind: settings.wallpaperKind,
      setKind: setWallpaperKind,
      weatherStyle: settings.weatherStyle,
      selectWeather,
      effectiveStyle,
      renderer,
      shaderSupported,
      reportShaderFallback,
      statsRef,
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
      settings.weatherStyle,
      settings.wallpaperPlacement,
      settings.bezelTint,
      settings.bezelBand,
      settings.bezelRadius,
      settings.wallpaperReadingBlur,
      settings.wallpaperReadingDim,
      setWallpaperKind,
      selectWeather,
      effectiveStyle,
      renderer,
      shaderSupported,
      reportShaderFallback,
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

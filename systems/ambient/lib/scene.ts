// =============================================================================
// Weather scene derivation
//
// One pure function turns (weather × sun × theme) into a `WeatherScene`: the
// complete, renderer-agnostic description of the wallpaper — sky palette, sun
// and moon placement, cloud cover/density/lighting, precipitation, wind, fog,
// lightning, stars and the theme veil.
//
// Both renderers consume it: the WebGL shader (the iOS-like animated
// wallpaper) and the CSS gradient fallback (widget mode / no WebGL / reduced
// motion). Keeping the palette here means both always agree, and the devtool
// can preview any state without a canvas.
// =============================================================================

import type { SolarPosition } from "./solar";
import {
  clamp01,
  DAY_ELEVATION_DEG,
  daylightFactor,
  estimateSolarPosition,
  getLunarPosition,
  getMoonIllumination,
  getMoonPhase,
  getSolarPosition,
  smoothstep,
  startOfLocalDay,
  DAY_MINUTES,
  sunTimesOrDefault,
} from "./solar";
import type {
  NormalizedWeather,
  PrecipitationType,
  WeatherCondition,
} from "./weather";
import { precipitationTypeForCondition } from "./weather";
import { WIPE_MIN_FOG } from "./wipe";

export type RGB = readonly [number, number, number];

export interface ScreenPoint {
  /** 0..1, left → right. */
  x: number;
  /** 0..1, bottom → top. */
  y: number;
}

export interface WeatherScene {
  sun: SolarPosition & {
    screen: ScreenPoint;
    /** 0 = astronomical night … 1 = full day. */
    daylight: number;
    /** The one day/night decision (`DAY_ELEVATION_DEG`): icons, palettes, chips. */
    isDay: boolean;
  };
  moon: SolarPosition & {
    phase: number;
    illumination: number;
    /** 0..1 how strongly the moon shows (above horizon × dark sky × clear). */
    visible: number;
    /** Where the disc is drawn — staged, not the raw elevation (see `stageMoon`). */
    screen: ScreenPoint;
    /** Relative disc size: 1 high in the sky, larger near the horizon. */
    size: number;
  };
  /** +1 northern hemisphere (east on the left), −1 southern (mirrored). */
  hemisphere: 1 | -1;
  sky: {
    zenith: RGB;
    horizon: RGB;
    /** Colour of the sun's glow / the light that tints clouds. */
    glow: RGB;
    /** 0..1 intensity of the sun glow. */
    glowStrength: number;
  };
  clouds: {
    cover: number;
    density: number;
    /** 0..1 storminess — how dark the cloud bases read. */
    darkness: number;
    lit: RGB;
    shade: RGB;
    /** Relative drift speed. */
    speed: number;
  };
  precipitation: {
    type: PrecipitationType;
    intensity: number;
  };
  /** Screen-space wind: x < 0 blows left. |wind| ∈ 0..1. */
  wind: { x: number; y: number };
  fog: number;
  lightning: number;
  stars: number;
  /**
   * What the murk is hiding: the same night sky with neither the fog nor the
   * deck that a fog day brings in front of it.
   *
   * A foggy night has no stars and barely a moon — `cover` alone saturates the
   * star term and the fog halves what is left of the moon — so by the time the
   * shader runs there is nothing there to uncover. Which is the whole point of
   * the wipe: the sky above the fog really does have a moon and stars in it,
   * and clearing the mist is supposed to show you them. So the scene hands over
   * the unhidden version too, and the shader reaches for it inside the swath.
   * See "The Fog Wipe" in docs/system-ambient.md.
   */
  behind: { stars: number; moon: number };
  /**
   * How much of the sky the murk leaves you: 1 under an open sky, 0 under an
   * overcast or a fog. `stars` is `behind.stars * clarity` — the first factor
   * is how dark the night is, the second is whether there is anything in the
   * way — and keeping them apart is what lets a question about one be asked
   * without dragging in the other. The meteor's window is the example: whether
   * it is dark enough is the sun's business and whether you could see through
   * is the weather's, and multiplying them together (which is all `stars` is)
   * answers neither.
   */
  clarity: number;
  /** Theme veil: blend the rendered scene toward the page background. */
  veil: { color: RGB; amount: number };
  exposure: number;
  /** Stable per-session seed so cloud layouts don't jump between renders. */
  seed: number;
  /** Which discrete condition produced this scene (for icons / labels). */
  condition: WeatherCondition;
  theme: "light" | "dark";
}

// -----------------------------------------------------------------------------
// Colour helpers
// -----------------------------------------------------------------------------

function hex(h: string): RGB {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  const k = clamp01(t);
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

export function rgbToCss(c: RGB, alpha?: number): string {
  const r = Math.round(clamp01(c[0]) * 255);
  const g = Math.round(clamp01(c[1]) * 255);
  const b = Math.round(clamp01(c[2]) * 255);
  return alpha === undefined
    ? `rgb(${r} ${g} ${b})`
    : `rgb(${r} ${g} ${b} / ${clamp01(alpha).toFixed(3)})`;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// -----------------------------------------------------------------------------
// Sky keyframes by sun elevation (clear sky)
// -----------------------------------------------------------------------------

interface SkyKey {
  el: number;
  zenith: RGB;
  horizon: RGB;
  glow: RGB;
  strength: number;
}

const SKY_KEYS: SkyKey[] = [
  { el: -18, zenith: hex("#05091a"), horizon: hex("#0b1330"), glow: hex("#1b2447"), strength: 0.0 },
  { el: -12, zenith: hex("#070e29"), horizon: hex("#151f48"), glow: hex("#3d3d72"), strength: 0.25 },
  { el: -6, zenith: hex("#0f1a48"), horizon: hex("#4d3f73"), glow: hex("#c8765c"), strength: 0.6 },
  { el: -2, zenith: hex("#1f3d7a"), horizon: hex("#b86d57"), glow: hex("#f28c4e"), strength: 0.95 },
  { el: 0, zenith: hex("#2d5ca4"), horizon: hex("#dd905a"), glow: hex("#ffb267"), strength: 1.0 },
  { el: 4, zenith: hex("#3b76c3"), horizon: hex("#ecb886"), glow: hex("#ffd9a3"), strength: 0.92 },
  { el: 10, zenith: hex("#4a90da"), horizon: hex("#bdd8f0"), glow: hex("#fff3d6"), strength: 0.72 },
  { el: 25, zenith: hex("#3d87dc"), horizon: hex("#c9e0f4"), glow: hex("#ffffff"), strength: 0.58 },
  { el: 60, zenith: hex("#2f74d2"), horizon: hex("#d0e4f8"), glow: hex("#ffffff"), strength: 0.5 },
];

function sampleSky(elevation: number): Omit<SkyKey, "el"> {
  const el = Math.max(SKY_KEYS[0].el, Math.min(SKY_KEYS[SKY_KEYS.length - 1].el, elevation));
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    const a = SKY_KEYS[i];
    const b = SKY_KEYS[i + 1];
    if (el >= a.el && el <= b.el) {
      const t = smoothstep(a.el, b.el, el);
      return {
        zenith: mixRGB(a.zenith, b.zenith, t),
        horizon: mixRGB(a.horizon, b.horizon, t),
        glow: mixRGB(a.glow, b.glow, t),
        strength: lerp(a.strength, b.strength, t),
      };
    }
  }
  const last = SKY_KEYS[SKY_KEYS.length - 1];
  return { zenith: last.zenith, horizon: last.horizon, glow: last.glow, strength: last.strength };
}

// -----------------------------------------------------------------------------
// Per-condition defaults + tints
// -----------------------------------------------------------------------------

interface ConditionProfile {
  /** Cloud cover used when the API gives none, and the floor when it does. */
  cover: number;
  coverMin: number;
  density: number;
  darkness: number;
  precip: number;
  fog: number;
  /** Sky tint (day / night) and how strongly it overrides the clear sky. */
  tintDay: { zenith: RGB; horizon: RGB };
  tintNight: { zenith: RGB; horizon: RGB };
  tintAmount: number;
}

const PROFILES: Record<WeatherCondition, ConditionProfile> = {
  clear: {
    cover: 0.04, coverMin: 0, density: 0.35, darkness: 0.05, precip: 0, fog: 0,
    tintDay: { zenith: hex("#2f74d2"), horizon: hex("#d0e4f8") },
    tintNight: { zenith: hex("#05091a"), horizon: hex("#0b1330") },
    tintAmount: 0,
  },
  // "cloudy" spans WMO 1–3 (mainly clear → overcast); the measured cover
  // decides how heavy it reads, so the floor stays low.
  cloudy: {
    cover: 0.7, coverMin: 0.2, density: 0.75, darkness: 0.3, precip: 0, fog: 0.05,
    tintDay: { zenith: hex("#7e8b9b"), horizon: hex("#b4bfca") },
    tintNight: { zenith: hex("#171b24"), horizon: hex("#252b36") },
    tintAmount: 0.8,
  },
  fog: {
    cover: 0.75, coverMin: 0.5, density: 0.6, darkness: 0.1, precip: 0, fog: 0.9,
    tintDay: { zenith: hex("#c4cad2"), horizon: hex("#e3e6ea") },
    tintNight: { zenith: hex("#23272e"), horizon: hex("#31363e") },
    tintAmount: 0.9,
  },
  rain: {
    cover: 0.92, coverMin: 0.7, density: 0.9, darkness: 0.6, precip: 0.6, fog: 0.22,
    tintDay: { zenith: hex("#56626f"), horizon: hex("#8e9aa7") },
    tintNight: { zenith: hex("#10141b"), horizon: hex("#1c222b") },
    tintAmount: 0.9,
  },
  snow: {
    cover: 0.88, coverMin: 0.6, density: 0.75, darkness: 0.25, precip: 0.5, fog: 0.3,
    tintDay: { zenith: hex("#a3adba"), horizon: hex("#d9dfe6") },
    tintNight: { zenith: hex("#242a38"), horizon: hex("#353c4c") },
    tintAmount: 0.85,
  },
  thunder: {
    cover: 0.96, coverMin: 0.8, density: 1, darkness: 0.9, precip: 0.8, fog: 0.2,
    tintDay: { zenith: hex("#2c3440"), horizon: hex("#4d5665") },
    tintNight: { zenith: hex("#0a0d13"), horizon: hex("#151a22") },
    tintAmount: 0.92,
  },
};

// -----------------------------------------------------------------------------
// Theme veil defaults
// -----------------------------------------------------------------------------

const VEIL_DEFAULTS = {
  light: { color: hex("#ffffff"), amount: 0.3, exposure: 1.06 },
  dark: { color: hex("#1a1a1a"), amount: 0.26, exposure: 0.86 },
} as const;

// -----------------------------------------------------------------------------
// Derivation
// -----------------------------------------------------------------------------

/**
 * The weather as the scene reads it. Only `condition` is required: every
 * measurement present replaces the condition's profile default for what it
 * describes, and every one missing falls back to it — so a condition alone
 * (the devtool, the legibility gallery, the profiler) paints exactly the
 * hand-tuned profile, and a real forecast paints the sky it measured.
 */
export interface SceneWeatherInput {
  condition: WeatherCondition;
  /** WMO code, for the thunderstorm's severity (96/99: with hail). */
  weatherCode?: number;
  cloudCover?: number;
  /** 0..1 cover by layer. All three, or the profile's density and darkness. */
  cloudCoverLow?: number;
  cloudCoverMid?: number;
  cloudCoverHigh?: number;
  /** What is actually falling (weather.ts derivePrecipitationType). */
  precipitationType?: PrecipitationType;
  precipitationIntensity?: number;
  windSpeedKmh?: number;
  windGustsKmh?: number;
  windDirectionDeg?: number;
  humidity?: number;
  visibilityM?: number;
  temperatureC?: number;
  dewPointC?: number;
  capeJkg?: number;
  sunriseMs?: number;
  sunsetMs?: number;
}

export interface SceneOverrides {
  cloudCover?: number;
  precipitationIntensity?: number;
  windSpeedKmh?: number;
  /**
   * Where the wind blows FROM, in met degrees. Speed alone says nothing about
   * what the sky does: the screen looks south, so a wind along that axis has no
   * horizontal component at all and no amount of it leans the rain. A devtool
   * that can set a speed and not a direction can therefore look broken.
   */
  windDirectionDeg?: number;
  /** Override the veil amount (0..1). */
  veilAmount?: number;
}

export interface DeriveSceneParams {
  nowMs: number;
  lat?: number;
  lon?: number;
  weather: SceneWeatherInput | null;
  theme: "light" | "dark";
  overrides?: SceneOverrides;
  seed?: number;
}

/** The observer's coordinates, when the params carry usable ones. */
function coordsOf(params: DeriveSceneParams): { lat: number; lon: number } | null {
  const { lat, lon } = params;
  return typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
    ? { lat, lon }
    : null;
}

const HORIZON_Y = 0.1;

// -----------------------------------------------------------------------------
// Staging the moon
//
// Where the moon IS comes from the ephemeris and is never bent: it rises and
// sets when it really does, its phase is the calendar's, and a first-quarter
// moon really is up all afternoon. Where the moon is DRAWN is a composition
// decision, made on purpose:
//
//   · The vertical mapping is a stage, not a protractor. A moon a few degrees
//     up is already drawn in the strip above the page content (the hero and
//     the greeting, on a phone the top third), and it climbs from there to
//     just under the top edge. Mapping elevation linearly put most of the
//     night's moon behind the widget grid, where nothing sees it.
//   · Horizontally it still crosses east → west with its azimuth (mirrored in
//     the south), but the disc is kept off the extreme edges so a rising or
//     setting moon is never half a moon.
//   · The daytime moon is intentional and quiet: it shows only when it is well
//     up AND far enough from the sun to be seen in daylight (a crescent near
//     the sun is invisible by day, in the sky and here), and then as a pale
//     disc, not the night's lantern.
//   · It is drawn a little larger near the horizon — the moon illusion, which
//     is how the eye remembers a rising moon.
// -----------------------------------------------------------------------------

const MOON_STAGE = {
  /** Screen y where the disc first appears, as it clears the horizon. */
  rise: 0.5,
  /** Screen y once it is properly up (a few degrees). */
  low: 0.62,
  /** Screen y at its highest. */
  high: 0.9,
  /** Elevation, °, at which the disc reaches `high`. */
  topAt: 60,
  /** The disc stays inside these screen x bounds. */
  xMin: 0.12,
  xMax: 0.88,
} as const;

function stageMoon(
  lunar: SolarPosition,
  hemisphere: 1 | -1
): { screen: ScreenPoint; size: number } {
  const rising = smoothstep(-3, 6, lunar.elevation);
  const climb = smoothstep(6, MOON_STAGE.topAt, lunar.elevation);
  const y =
    lerp(MOON_STAGE.rise, MOON_STAGE.low, rising) +
    (MOON_STAGE.high - MOON_STAGE.low) * climb;
  const x = Math.min(
    MOON_STAGE.xMax,
    Math.max(MOON_STAGE.xMin, azimuthToScreenX(lunar.azimuth, hemisphere))
  );
  // The moon illusion: up to 30% larger near the horizon.
  const size = 1 + 0.3 * (1 - smoothstep(0, 35, lunar.elevation));
  return { screen: { x, y }, size };
}

/** Map a compass azimuth to a screen x. Northern hemisphere looks south, so
 *  east is on the left; the southern hemisphere looks north and mirrors. */
function azimuthToScreenX(azimuthDeg: number, hemisphere: 1 | -1): number {
  const x = 0.5 + 0.5 * Math.sin((azimuthDeg - 180) * (Math.PI / 180)) * hemisphere;
  return 0.06 + x * 0.88;
}

function resolveSolar(params: DeriveSceneParams): SolarPosition {
  const coords = coordsOf(params);
  return coords
    ? getSolarPosition(params.nowMs, coords.lat, coords.lon)
    : estimateSolarPosition({
        nowMs: params.nowMs,
        sunriseMs: params.weather?.sunriseMs,
        sunsetMs: params.weather?.sunsetMs,
      });
}

/**
 * Moon geometry. With coordinates this is the real topocentric ephemeris (so
 * the moon rises, crosses and sets when it should, and a time-travel sweep
 * moves it along a genuine arc). Without coordinates it follows a plausible
 * arc across the night, driven by sunrise/sunset (or the local clock).
 */
function resolveLunar(params: DeriveSceneParams): SolarPosition & { phase: number } {
  const coords = coordsOf(params);
  if (coords) return getLunarPosition(params.nowMs, coords.lat, coords.lon);

  const { nowMs } = params;
  const { sunrise: sr, sunset: ss } = sunTimesOrDefault(
    nowMs,
    params.weather?.sunriseMs,
    params.weather?.sunsetMs
  );
  let np: number;
  if (nowMs >= ss) {
    np = clamp01((nowMs - ss) / Math.max(1, sr + 86_400_000 - ss));
  } else if (nowMs <= sr) {
    np = clamp01((nowMs - (ss - 86_400_000)) / Math.max(1, sr - (ss - 86_400_000)));
  } else {
    np = -1; // daytime: below the horizon
  }
  const natural: SolarPosition =
    np < 0
      ? { elevation: -30, azimuth: 0 }
      : { elevation: Math.sin(np * Math.PI) * 55, azimuth: 90 + np * 180 };
  return { ...natural, phase: getMoonPhase(nowMs) };
}

/**
 * Instability, 0..1: 0 in stable air, 1 by ~2500 J/kg of CAPE — the towering,
 * dark-based cumulonimbus of a real storm. A thunder code is convection
 * whatever the CAPE reads this quarter-hour, so it never counts for less than
 * half.
 */
function convectionOf(weather: SceneWeatherInput | null | undefined): number {
  const cape = weather?.capeJkg;
  const measured = typeof cape === "number" ? smoothstep(300, 2500, cape) : 0;
  return weather?.condition === "thunder" ? Math.max(0.5, measured) : measured;
}

/**
 * How hard a thunderstorm flashes, 0.55..1 — the shader scales the flash's
 * brightness by it. A code with hail (96/99) is the severe end; otherwise the
 * air's instability decides. A thunder scene is never 0: the strike egg
 * (lib/poke.ts) arms on any lightning at all.
 */
function lightningFor(weather: SceneWeatherInput | null | undefined): number {
  const code = weather?.weatherCode;
  if (code === 96 || code === 99) return 1;
  if (typeof weather?.capeJkg !== "number") return 1;
  return 0.55 + 0.45 * convectionOf(weather);
}

export function deriveWeatherScene(params: DeriveSceneParams): WeatherScene {
  const { theme } = params;
  const weather = params.weather;
  // No weather yet → a mostly clear sky with a few clouds, lit by the clock.
  const condition: WeatherCondition = weather?.condition ?? "clear";
  const profile = PROFILES[condition];
  const ov = params.overrides ?? {};

  const hemisphere: 1 | -1 =
    typeof params.lat === "number" && params.lat < 0 ? -1 : 1;

  // --- Sun --------------------------------------------------------------
  const solar = resolveSolar(params);
  const elevation = solar.elevation;
  const daylight = daylightFactor(elevation);
  const sunScreen: ScreenPoint = {
    x: azimuthToScreenX(solar.azimuth, hemisphere),
    y: HORIZON_Y + Math.sin(elevation * (Math.PI / 180)) * 0.9,
  };

  // --- Precipitation ----------------------------------------------------
  // What is falling comes from the measurements when there are any; the
  // condition otherwise.
  const precipType =
    weather?.precipitationType ?? precipitationTypeForCondition(condition);
  const precipIntensity =
    precipType === "none"
      ? 0
      : clamp01(
          ov.precipitationIntensity ??
            weather?.precipitationIntensity ??
            profile.precip
        );

  // --- Clouds -----------------------------------------------------------
  // Cover is the measured cover. The only floor is physical: whatever is
  // falling came out of a cloud, so the heavier it falls the more sky that
  // cloud takes (a shower under a broken sky is real; a downpour from 20% is
  // not). Fog keeps its profile floor — it is murk, not sky, but the murk is
  // what tints the palette below.
  const measuredCover = ov.cloudCover ?? weather?.cloudCover;
  const coverFloor =
    condition === "fog"
      ? profile.coverMin
      : precipType === "none"
        ? 0
        : 0.4 + 0.45 * precipIntensity;
  const cover = clamp01(
    measuredCover === undefined
      ? weather
        ? profile.cover
        : 0.3
      : Math.max(coverFloor, measuredCover)
  );

  const convective = convectionOf(weather);

  // Which layers the cover is in decides what it looks like. Low stratus is
  // thick and grey-based, mid-level cloud in between, high cirrus a thin
  // bright veil — so "70% cloud" of cirrus and "70% cloud" of stratus are no
  // longer the same sky. (The shader scales coverage by density, which is
  // exactly the thin-cirrus effect.)
  const low = weather?.cloudCoverLow;
  const mid = weather?.cloudCoverMid;
  const high = weather?.cloudCoverHigh;
  const layered =
    typeof low === "number" && typeof mid === "number" && typeof high === "number";
  const layerSum = layered ? low + mid + high : 0;
  // A fog's "low cloud" is the fog itself, which the fog layer draws.
  const density = layered && layerSum > 0.05 && condition !== "fog"
    ? clamp01(
        (low * 0.95 + mid * 0.7 + high * 0.3) / layerSum +
          precipIntensity * 0.2 +
          convective * 0.2
      )
    : profile.density;

  // --- Sky palette ------------------------------------------------------
  const clearSky = sampleSky(elevation);
  const tint = {
    zenith: mixRGB(profile.tintNight.zenith, profile.tintDay.zenith, daylight),
    horizon: mixRGB(profile.tintNight.horizon, profile.tintDay.horizon, daylight),
  };
  // Heavier cover → the condition tint takes over the clear-sky palette. Even
  // an overcast dawn keeps a hint of warmth near the horizon.
  const tintAmount = profile.tintAmount * smoothstep(0.25, 0.9, cover);
  const zenith = mixRGB(clearSky.zenith, tint.zenith, tintAmount);
  const horizon = mixRGB(clearSky.horizon, tint.horizon, tintAmount * 0.85);
  const glow = clearSky.glow;
  const glowStrength =
    clearSky.strength * (1 - 0.75 * smoothstep(0.3, 0.95, cover) * density);

  // --- Cloud lighting ---------------------------------------------------
  // With layers measured, how dark the undersides are is how much low and mid
  // cloud there is, how hard it is falling, and how unstable the air is —
  // calibrated so the typical day of each condition lands on its old profile
  // value. Snow cloud is bright-based, and fog lifts everything.
  const darkness = layered
    ? clamp01(
        (0.05 + 0.35 * low + 0.15 * mid + 0.4 * precipIntensity + 0.25 * convective) *
          (precipType === "snow" ? 0.5 : 1) *
          (condition === "fog" ? 0.35 : 1)
      )
    : clamp01(
        profile.darkness + precipIntensity * 0.25 + (cover - profile.cover) * 0.2
      );
  const litDay = mixRGB(hex("#ffffff"), glow, 0.55 + 0.45 * (1 - daylight));
  const litNight = hex("#2a3040");
  const lit = mixRGB(litNight, litDay, smoothstep(-8, 4, elevation));
  const shadeDay = mixRGB(hex("#98a4b3"), hex("#39404a"), darkness);
  const shadeNight = mixRGB(hex("#11141b"), hex("#07090d"), darkness);
  const shade = mixRGB(shadeNight, shadeDay, smoothstep(-8, 6, elevation));

  // --- Wind -------------------------------------------------------------
  // Gusty air reads windier than its mean: a third of the way to the gusts.
  const meanWind = weather?.windSpeedKmh ?? 8;
  const gusts = weather?.windGustsKmh;
  const windKmh =
    ov.windSpeedKmh ??
    (typeof gusts === "number" ? meanWind + Math.max(0, gusts - meanWind) / 3 : meanWind);
  const windSpeed = clamp01(windKmh / 50);
  const windFrom = ov.windDirectionDeg ?? weather?.windDirectionDeg ?? 270;
  const windTo = (windFrom + 180) % 360;
  const windX = -Math.sin(windTo * (Math.PI / 180)) * hemisphere * windSpeed;
  const wind = { x: windX, y: 0 };

  // --- Atmosphere -------------------------------------------------------
  // Fog is visibility: nothing at 10 km, thick by 200 m (log scale — the eye
  // reads visibility in orders of magnitude). A fog code keeps it at least
  // half-thick, since model visibility is the least reliable number here. A
  // dew point within a degree or two of the air temperature adds a haze.
  // Without a visibility, the profile and the old humidity/precip terms.
  const humidity = weather?.humidity ?? 0.5;
  const vis = weather?.visibilityM;
  const haze =
    typeof weather?.temperatureC === "number" && typeof weather?.dewPointC === "number"
      ? smoothstep(2.5, 0.5, weather.temperatureC - weather.dewPointC) * 0.15
      : condition === "cloudy"
        ? smoothstep(0.85, 1, humidity) * 0.15
        : 0;
  const fogMeasured =
    typeof vis === "number"
      ? clamp01(Math.log10(10_000 / Math.max(vis, 1)) / Math.log10(10_000 / 200)) + haze
      : undefined;
  const fogRaw = clamp01(
    fogMeasured === undefined
      ? profile.fog +
          (condition === "cloudy" ? smoothstep(0.85, 1, humidity) * 0.15 : 0) +
          (precipType !== "none" ? precipIntensity * 0.12 : 0)
      : condition === "fog"
        ? Math.max(0.5, fogMeasured)
        : fogMeasured
  );
  // Falling rain or snow keeps the mist under the wipe's threshold: the fog
  // wipe and the gust are never armed together (lib/wipe.ts).
  const fog = precipType === "none" ? fogRaw : Math.min(fogRaw, WIPE_MIN_FOG - 0.05);
  const night = smoothstep(-4, -14, elevation);

  // --- Moon -------------------------------------------------------------
  const lunar = resolveLunar(params);
  const moonPhase = lunar.phase;
  const moonIllum = getMoonIllumination(moonPhase);
  const moonUp = smoothstep(-3, 5, lunar.elevation);
  const skyDark = smoothstep(6, -8, elevation);
  // The daytime moon, on purpose (see "Staging the moon"): well up, and far
  // enough from the sun — elongation from the phase: 0° at new, 180° at full —
  // and then pale. At night the sky's darkness is the only gate.
  const elongation = 180 - Math.abs(moonPhase * 360 - 180);
  const dayMoon =
    0.18 * smoothstep(12, 30, lunar.elevation) * smoothstep(40, 90, elongation);
  // The moon the sky would show with nothing in front of it, and then the same
  // moon behind the murk. Split rather than written twice so the daytime-moon
  // rule above has one home: the wipe uncovers the moon under the rule the sky
  // is showing, not a copy of it. (`starDust` below is the same split.)
  const moonBare = moonUp * lerp(dayMoon, 1, skyDark);
  const moonVisible =
    moonBare * (1 - smoothstep(0.45, 0.9, cover)) * (1 - fog * 0.8);
  const { screen: moonScreen, size: moonSize } = stageMoon(lunar, hemisphere);
  // Moonlight: a bright, high moon lifts the night sky and cloud tops and
  // washes out the fainter stars.
  const moonLight = moonIllum * smoothstep(0, 25, lunar.elevation) * night;

  const starDust = night * (1 - 0.55 * moonLight);
  // What the deck and the fog leave of whatever is up there. Named because two
  // different questions want it on its own: how bright to draw the star field
  // (that is `stars`, below) and whether anything up there could be seen at all
  // (that is the meteor's window — see lib/poke.ts).
  const clarity = (1 - smoothstep(0.15, 0.65, cover)) * (1 - fog);
  // Naming it moves a multiplication inside a bracket, and `a * (b * c)` is not
  // `(a * b) * c`: `stars` shifts by one double ULP on about 3% of scenes. It
  // reaches the shader as a float32, whose spacing near 1 is five hundred
  // million times coarser, so nothing rendered moves — checked over 366336
  // scenes, zero of them landing on a different float32.
  const stars = starDust * clarity;
  // The same two with the murk taken away — see `behind` on WeatherScene. Only
  // the fog wipe ever asks for them, and only inside the swath it has cleared.
  const behind = { stars: starDust, moon: moonBare };

  const veilDefaults = VEIL_DEFAULTS[theme];

  const moonlitZenith = mixRGB(zenith, hex("#1c2748"), moonLight * 0.45);
  const moonlitHorizon = mixRGB(horizon, hex("#2a3556"), moonLight * 0.35);
  const moonlitLit = mixRGB(lit, hex("#4a5578"), moonLight * (1 - smoothstep(-8, 4, elevation)) * 0.7);

  return {
    sun: { ...solar, screen: sunScreen, daylight, isDay: elevation > DAY_ELEVATION_DEG },
    moon: {
      elevation: lunar.elevation,
      azimuth: lunar.azimuth,
      phase: moonPhase,
      illumination: moonIllum,
      visible: moonVisible,
      screen: moonScreen,
      size: moonSize,
    },
    hemisphere,
    sky: { zenith: moonlitZenith, horizon: moonlitHorizon, glow, glowStrength },
    clouds: {
      cover,
      density,
      darkness,
      lit: moonlitLit,
      shade,
      speed: 0.35 + windSpeed * 1.4,
    },
    precipitation: { type: precipType, intensity: precipIntensity },
    wind,
    fog,
    lightning: condition === "thunder" ? lightningFor(weather) : 0,
    stars,
    clarity,
    behind,
    veil: { color: veilDefaults.color, amount: ov.veilAmount ?? veilDefaults.amount },
    exposure: veilDefaults.exposure,
    seed: params.seed ?? 0,
    condition,
    theme,
  };
}

/**
 * Shape a NormalizedWeather (or a devtool override) into scene input.
 *
 * Day/night is never part of this: the effective clock (and the real sun)
 * decides, so a forced condition can't put a moon in a daytime sky. `sunTimes`
 * lets the caller pass the effective day's sunrise/sunset (time travel shifts
 * them) instead of the forecast's.
 */
export function toSceneWeather(
  weather: NormalizedWeather | null | undefined,
  override?: { condition: WeatherCondition } | null,
  sunTimes?: { sunriseMs?: number; sunsetMs?: number }
): SceneWeatherInput | null {
  if (!weather && !override) return null;
  const condition = override?.condition ?? (weather as NormalizedWeather).condition;
  const overrideChangesCondition = !!override && override.condition !== weather?.condition;
  // Real measurements only make sense for the real condition; a forced
  // condition falls back to its profile defaults. Wind is kept: it is the one
  // measurement that reads the same under any sky.
  const real = overrideChangesCondition ? undefined : weather ?? undefined;
  return {
    condition,
    weatherCode: real?.weatherCode,
    cloudCover: real?.cloudCover,
    cloudCoverLow: real?.cloudCoverLow,
    cloudCoverMid: real?.cloudCoverMid,
    cloudCoverHigh: real?.cloudCoverHigh,
    precipitationType: real?.precipitationType,
    precipitationIntensity: real?.precipitationIntensity,
    windSpeedKmh: weather?.windSpeedKmh,
    windGustsKmh: weather?.windGustsKmh,
    windDirectionDeg: weather?.windDirectionDeg,
    humidity: real?.humidity,
    visibilityM: real?.visibilityM,
    temperatureC: real?.temperatureC,
    dewPointC: real?.dewPointC,
    capeJkg: real?.capeJkg,
    sunriseMs: sunTimes ? sunTimes.sunriseMs : weather?.sunriseMs,
    sunsetMs: sunTimes ? sunTimes.sunsetMs : weather?.sunsetMs,
  };
}

/**
 * One day's worth of scene inputs: everything `deriveWeatherScene` needs except
 * the instant. Anything walking a day — the devtool's sky strip, the meteor's
 * window — takes this, so a new scene input is threaded through once.
 */
export interface DaySampleParams {
  /** Any instant of the day to sample; the day is taken from local midnight. */
  dayMs: number;
  lat?: number;
  lon?: number;
  weather: SceneWeatherInput | null;
  theme: "light" | "dark";
  overrides?: SceneOverrides;
  seed?: number;
}

/**
 * The scene at a given minute of one local day.
 *
 * The one way to walk a day, so the things drawn from it cannot disagree about
 * which day it is. Pure and cheap — the ephemeris is a few hundred multiplies.
 */
export function daySceneAt(
  params: DaySampleParams
): (minute: number) => WeatherScene {
  const startMs = startOfLocalDay(params.dayMs);
  return (minute) =>
    deriveWeatherScene({ ...params, nowMs: startMs + minute * 60_000 });
}

/** Scenes per day in `sampleDaySky`: one every twenty minutes. */
const DAY_SKY_SAMPLES = 72;

/**
 * The sky across one day, for a timeline.
 *
 * Scenes from local midnight to midnight, each reduced to one colour (the
 * zenith/horizon mix, unveiled, so it stays vivid at 4px tall), so a devtool
 * can redraw it whenever the condition, the day or the location changes.
 */
export function sampleDaySky(params: DaySampleParams): RGB[] {
  const sceneAt = daySceneAt(params);
  const out: RGB[] = [];
  for (let i = 0; i < DAY_SKY_SAMPLES; i++) {
    const scene = sceneAt(((i + 0.5) / DAY_SKY_SAMPLES) * DAY_MINUTES);
    out.push(mixRGB(scene.sky.zenith, scene.sky.horizon, 0.45));
  }
  return out;
}

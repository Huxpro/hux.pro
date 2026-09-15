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
  daylightFactor,
  estimateSolarPosition,
  getLunarPosition,
  getMoonIllumination,
  getMoonPhase,
  getSolarPosition,
  smoothstep,
} from "./solar";
import type {
  NormalizedWeather,
  PrecipitationType,
  WeatherCondition,
} from "./weather";
import { precipitationTypeForCondition } from "./weather";

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
    /** 0..1 how much the moon lights the night sky (illumination × altitude). */
    light: number;
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

export function hex(h: string): RGB {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  const k = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

export function scaleRGB(a: RGB, s: number): RGB {
  return [
    Math.min(1, a[0] * s),
    Math.min(1, a[1] * s),
    Math.min(1, a[2] * s),
  ];
}

export function rgbToCss(c: RGB, alpha?: number): string {
  const r = Math.round(Math.max(0, Math.min(1, c[0])) * 255);
  const g = Math.round(Math.max(0, Math.min(1, c[1])) * 255);
  const b = Math.round(Math.max(0, Math.min(1, c[2])) * 255);
  return alpha === undefined
    ? `rgb(${r} ${g} ${b})`
    : `rgb(${r} ${g} ${b} / ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

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

export function getConditionProfile(condition: WeatherCondition) {
  return PROFILES[condition];
}

// -----------------------------------------------------------------------------
// Theme veil defaults
// -----------------------------------------------------------------------------

export const VEIL_DEFAULTS = {
  light: { color: hex("#ffffff"), amount: 0.3, exposure: 1.06 },
  dark: { color: hex("#1a1a1a"), amount: 0.26, exposure: 0.86 },
} as const;

// -----------------------------------------------------------------------------
// Derivation
// -----------------------------------------------------------------------------

export interface SceneWeatherInput {
  condition: WeatherCondition;
  isDay?: boolean;
  cloudCover?: number;
  precipitationIntensity?: number;
  windSpeedKmh?: number;
  windDirectionDeg?: number;
  humidity?: number;
  sunriseMs?: number;
  sunsetMs?: number;
}

export interface SceneOverrides {
  cloudCover?: number;
  precipitationIntensity?: number;
  windSpeedKmh?: number;
  /** Override the veil amount (0..1). */
  veilAmount?: number;
}

export interface DeriveSceneParams {
  nowMs: number;
  lat?: number;
  lon?: number;
  weather: SceneWeatherInput | null;
  theme: "light" | "dark";
  /** Force sun geometry (devtool preview thumbnails only). */
  solar?: Partial<SolarPosition>;
  overrides?: SceneOverrides;
  seed?: number;
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
  const hasCoords =
    typeof params.lat === "number" &&
    typeof params.lon === "number" &&
    Number.isFinite(params.lat) &&
    Number.isFinite(params.lon);

  const natural = hasCoords
    ? getSolarPosition(params.nowMs, params.lat as number, params.lon as number)
    : estimateSolarPosition({
        nowMs: params.nowMs,
        sunriseMs: params.weather?.sunriseMs,
        sunsetMs: params.weather?.sunsetMs,
      });

  return {
    elevation: params.solar?.elevation ?? natural.elevation,
    azimuth: params.solar?.azimuth ?? natural.azimuth,
  };
}

/**
 * Moon geometry. With coordinates this is the real topocentric ephemeris (so
 * the moon rises, crosses and sets when it should, and a time-travel sweep
 * moves it along a genuine arc). Without coordinates it follows a plausible
 * arc across the night, driven by sunrise/sunset (or the local clock).
 */
function resolveLunar(params: DeriveSceneParams): SolarPosition & { phase: number } {
  const hasCoords =
    typeof params.lat === "number" &&
    typeof params.lon === "number" &&
    Number.isFinite(params.lat) &&
    Number.isFinite(params.lon);

  const phase = getMoonPhase(params.nowMs);

  let natural: SolarPosition;
  if (hasCoords) {
    natural = getLunarPosition(params.nowMs, params.lat as number, params.lon as number);
  } else {
    const { nowMs } = params;
    let sunrise = params.weather?.sunriseMs;
    let sunset = params.weather?.sunsetMs;
    if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) {
      const d = new Date(nowMs);
      d.setHours(6, 30, 0, 0);
      sunrise = d.getTime();
      d.setHours(18, 30, 0, 0);
      sunset = d.getTime();
    }
    const ss = sunset as number;
    const sr = sunrise as number;
    let np: number;
    if (nowMs >= ss) {
      np = clamp01((nowMs - ss) / Math.max(1, sr + 86_400_000 - ss));
    } else if (nowMs <= sr) {
      np = clamp01((nowMs - (ss - 86_400_000)) / Math.max(1, sr - (ss - 86_400_000)));
    } else {
      np = -1; // daytime: below the horizon
    }
    natural =
      np < 0
        ? { elevation: -30, azimuth: 0 }
        : { elevation: Math.sin(np * Math.PI) * 55, azimuth: 90 + np * 180 };
  }

  return { ...natural, phase };
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

  // --- Clouds -----------------------------------------------------------
  const measuredCover = ov.cloudCover ?? weather?.cloudCover;
  const cover = clamp01(
    measuredCover === undefined
      ? weather
        ? profile.cover
        : 0.3
      : Math.max(profile.coverMin, measuredCover)
  );
  const precipType = precipitationTypeForCondition(condition);
  const precipIntensity =
    precipType === "none"
      ? 0
      : clamp01(
          ov.precipitationIntensity ??
            weather?.precipitationIntensity ??
            profile.precip
        );

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
    clearSky.strength * (1 - 0.75 * smoothstep(0.3, 0.95, cover) * profile.density);

  // --- Cloud lighting ---------------------------------------------------
  const darkness = clamp01(
    profile.darkness + precipIntensity * 0.25 + (cover - profile.cover) * 0.2
  );
  const litDay = mixRGB(hex("#ffffff"), glow, 0.55 + 0.45 * (1 - daylight));
  const litNight = hex("#2a3040");
  const lit = mixRGB(litNight, litDay, smoothstep(-8, 4, elevation));
  const shadeDay = mixRGB(hex("#98a4b3"), hex("#39404a"), darkness);
  const shadeNight = mixRGB(hex("#11141b"), hex("#07090d"), darkness);
  const shade = mixRGB(shadeNight, shadeDay, smoothstep(-8, 6, elevation));

  // --- Wind -------------------------------------------------------------
  const windKmh = ov.windSpeedKmh ?? weather?.windSpeedKmh ?? 8;
  const windSpeed = clamp01(windKmh / 50);
  const windTo = ((weather?.windDirectionDeg ?? 270) + 180) % 360;
  const windX = -Math.sin(windTo * (Math.PI / 180)) * hemisphere * windSpeed;
  const wind = { x: windX, y: 0 };

  // --- Atmosphere -------------------------------------------------------
  const humidity = weather?.humidity ?? 0.5;
  const fog = clamp01(
    profile.fog +
      (condition === "cloudy" ? smoothstep(0.85, 1, humidity) * 0.15 : 0) +
      (precipType !== "none" ? precipIntensity * 0.12 : 0)
  );
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
  const moonVisible =
    moonUp *
    lerp(dayMoon, 1, skyDark) *
    (1 - smoothstep(0.45, 0.9, cover)) *
    (1 - fog * 0.8);
  const { screen: moonScreen, size: moonSize } = stageMoon(lunar, hemisphere);
  // Moonlight: a bright, high moon lifts the night sky and cloud tops and
  // washes out the fainter stars.
  const moonLight = moonIllum * smoothstep(0, 25, lunar.elevation) * night;

  const stars =
    night * (1 - smoothstep(0.15, 0.65, cover)) * (1 - fog) * (1 - 0.55 * moonLight);

  const veilDefaults = VEIL_DEFAULTS[theme];

  const moonlitZenith = mixRGB(zenith, hex("#1c2748"), moonLight * 0.45);
  const moonlitHorizon = mixRGB(horizon, hex("#2a3556"), moonLight * 0.35);
  const moonlitLit = mixRGB(lit, hex("#4a5578"), moonLight * (1 - smoothstep(-8, 4, elevation)) * 0.7);

  return {
    sun: { ...solar, screen: sunScreen, daylight },
    moon: {
      elevation: lunar.elevation,
      azimuth: lunar.azimuth,
      phase: moonPhase,
      illumination: moonIllum,
      visible: moonVisible,
      screen: moonScreen,
      size: moonSize,
      light: moonLight,
    },
    hemisphere,
    sky: { zenith: moonlitZenith, horizon: moonlitHorizon, glow, glowStrength },
    clouds: {
      cover,
      density: profile.density,
      darkness,
      lit: moonlitLit,
      shade,
      speed: 0.35 + windSpeed * 1.4,
    },
    precipitation: { type: precipType, intensity: precipIntensity },
    wind,
    fog,
    lightning: condition === "thunder" ? 1 : 0,
    stars,
    veil: { color: veilDefaults.color, amount: ov.veilAmount ?? veilDefaults.amount },
    exposure: veilDefaults.exposure,
    seed: params.seed ?? 0,
    condition,
    theme,
  };
}

/** Shape a NormalizedWeather (or a devtool override) into scene input. */
export function toSceneWeather(
  weather: NormalizedWeather | null | undefined,
  override?: { condition: WeatherCondition } | null
): SceneWeatherInput | null {
  if (!weather && !override) return null;
  const condition = override?.condition ?? (weather as NormalizedWeather).condition;
  const overrideChangesCondition = !!override && override.condition !== weather?.condition;
  return {
    condition,
    // Day/night is never overridden: the effective clock (and the real sun)
    // decides, so a forced condition can't put a moon in a daytime sky.
    isDay: weather?.isDay,
    // Real measurements only make sense for the real condition; a forced
    // condition falls back to its profile defaults.
    cloudCover: overrideChangesCondition ? undefined : weather?.cloudCover,
    precipitationIntensity: overrideChangesCondition
      ? undefined
      : weather?.precipitationIntensity,
    windSpeedKmh: weather?.windSpeedKmh,
    windDirectionDeg: weather?.windDirectionDeg,
    humidity: overrideChangesCondition ? undefined : weather?.humidity,
    sunriseMs: weather?.sunriseMs,
    sunsetMs: weather?.sunsetMs,
  };
}

/**
 * The sky across one day, for a timeline.
 *
 * `samples` scenes from local midnight to midnight, each reduced to one colour
 * (the zenith/horizon mix, unveiled, so it stays vivid at 4px tall). Pure and
 * cheap — the ephemeris is a few hundred multiplies — so a devtool can redraw
 * it whenever the condition, the day or the location changes.
 */
export function sampleDaySky(params: {
  /** Any instant of the day to sample; the day is taken from local midnight. */
  dayMs: number;
  lat?: number;
  lon?: number;
  weather: SceneWeatherInput | null;
  theme: "light" | "dark";
  overrides?: SceneOverrides;
  samples?: number;
}): RGB[] {
  const n = Math.max(2, params.samples ?? 72);
  const start = new Date(params.dayMs);
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  const out: RGB[] = [];
  for (let i = 0; i < n; i++) {
    const scene = deriveWeatherScene({
      nowMs: startMs + ((i + 0.5) / n) * 86_400_000,
      lat: params.lat,
      lon: params.lon,
      weather: params.weather,
      theme: params.theme,
      overrides: params.overrides,
    });
    out.push(mixRGB(scene.sky.zenith, scene.sky.horizon, 0.45));
  }
  return out;
}

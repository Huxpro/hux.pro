// =============================================================================
// Weather scene derivation
//
// One pure function turns (weather × sun × theme × config) into a
// `WeatherScene`: the complete, renderer-agnostic description of the wallpaper
// — sky palette, sun and moon placement, cloud cover/density/lighting,
// precipitation, wind, fog, lightning, stars and the theme veil.
//
// Both renderers consume it: the WebGL shader (the iOS-like animated
// wallpaper) and the CSS gradient fallback (widget mode / no WebGL / reduced
// motion). Keeping the palette here means both always agree, and the devtool
// can preview any state without a canvas.
//
// Every number the look depends on comes from a `SkyConfig` (see
// `sky-config.ts`). The site paints from the committed `content/sky.json`; the
// Sky Engine Lab (`/editor/sky`) hands in an in-memory config instead, so the
// same functions that ship a look are the ones that preview it.
// =============================================================================

import skyFileJson from "@/content/sky.json";
import type { SolarPosition } from "./solar";
import {
  clamp01,
  daylightFactor,
  estimateSolarPosition,
  getLunarPosition,
  getMoonIllumination,
  getMoonPhase,
  getSolarPosition,
  smoothstep,
  startOfLocalDay,
  sunTimesOrDefault,
} from "./solar";
import {
  activeSkyConfig,
  normalizeSkyFile,
  type ConditionProfileConfig,
  type GateConfig,
  type SkyConfig,
  type SkyKeyConfig,
  type StagingConfig,
} from "./sky-config";
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

/**
 * The shader's own framing and figure sizes, resolved from the config.
 *
 * The scene carries them so the renderer stays a dumb pipe: it packs whatever
 * the scene says into uniforms, and the lab can retune the shader live through
 * the same path the site's committed config takes.
 */
export interface SkyRender {
  sunDisc: number;
  sunGlowRadiusHigh: number;
  sunGlowRadiusLow: number;
  sunGlowGain: number;
  horizonBand: number;
  moonDisc: number;
  moonHalo: number;
  earthshine: number;
  terminator: number;
  starDensity: number;
  starTwinkle: number;
  horizonCurve: number;
  cloudScaleFar: number;
  cloudScaleNear: number;
  cloudParallaxFar: number;
  cloudParallaxNear: number;
}

export interface WeatherScene {
  sun: SolarPosition & {
    screen: ScreenPoint;
    /** 0 = astronomical night … 1 = full day. */
    daylight: number;
    /** The one day/night decision (`sun.dayElevationDeg`): icons, palettes, chips. */
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
  /** Theme veil: blend the rendered scene toward the page background. */
  veil: { color: RGB; amount: number };
  exposure: number;
  /** Shader-side framing and figure sizes (see `SkyRender`). */
  render: SkyRender;
  /** Stable per-session seed so cloud layouts don't jump between renders. */
  seed: number;
  /** Which discrete condition produced this scene (for icons / labels). */
  condition: WeatherCondition;
  theme: "light" | "dark";
}

// -----------------------------------------------------------------------------
// The committed config
//
// `content/sky.json` is a document of named presets; the site paints from its
// active one. It is a static import, so the config is baked at build and the
// static export needs nothing at runtime.
// -----------------------------------------------------------------------------

export const SKY_FILE = normalizeSkyFile(skyFileJson);
export const SKY_CONFIG: SkyConfig = activeSkyConfig(SKY_FILE);

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

/** A config gate, applied. `from > to` is legal and reverses the ramp. */
const gate = (g: GateConfig, x: number) => smoothstep(g.from, g.to, x);

// -----------------------------------------------------------------------------
// Resolving a config
//
// The config is plain JSON — colours are `#rrggbb` strings — so it round-trips
// through `content/sky.json` without a codec. Derivation wants RGB triples, and
// `sampleDaySky` alone derives 72 scenes from one config, so the conversion is
// done once per config object and cached against it.
// -----------------------------------------------------------------------------

interface ResolvedKey {
  el: number;
  zenith: RGB;
  horizon: RGB;
  glow: RGB;
  strength: number;
}

interface ResolvedProfile {
  cover: number;
  coverMin: number;
  density: number;
  darkness: number;
  precip: number;
  fog: number;
  tintDay: { zenith: RGB; horizon: RGB };
  tintNight: { zenith: RGB; horizon: RGB };
  tintAmount: number;
}

export interface ResolvedSky {
  keys: ResolvedKey[];
  profiles: Record<WeatherCondition, ResolvedProfile>;
  veil: {
    light: { color: RGB; amount: number; exposure: number };
    dark: { color: RGB; amount: number; exposure: number };
  };
  moonLight: { zenith: RGB; horizon: RGB; cloud: RGB };
  lighting: {
    litDay: RGB;
    litNight: RGB;
    shadeDay: RGB;
    shadeDayStorm: RGB;
    shadeNight: RGB;
    shadeNightStorm: RGB;
  };
  render: SkyRender;
}

const resolvedCache = new WeakMap<SkyConfig, ResolvedSky>();

function resolveProfile(p: ConditionProfileConfig): ResolvedProfile {
  return {
    cover: p.cover,
    coverMin: p.coverMin,
    density: p.density,
    darkness: p.darkness,
    precip: p.precip,
    fog: p.fog,
    tintDay: { zenith: hex(p.tintDay.zenith), horizon: hex(p.tintDay.horizon) },
    tintNight: {
      zenith: hex(p.tintNight.zenith),
      horizon: hex(p.tintNight.horizon),
    },
    tintAmount: p.tintAmount,
  };
}

/** A config with its colours parsed. Cached per config object. */
export function resolveSkyConfig(config: SkyConfig): ResolvedSky {
  const cached = resolvedCache.get(config);
  if (cached) return cached;

  const profiles = {} as Record<WeatherCondition, ResolvedProfile>;
  for (const key of Object.keys(config.clouds.profiles) as WeatherCondition[]) {
    profiles[key] = resolveProfile(config.clouds.profiles[key]);
  }

  const l = config.clouds.lighting;
  const resolved: ResolvedSky = {
    keys: config.sun.keys.map((k: SkyKeyConfig) => ({
      el: k.el,
      zenith: hex(k.zenith),
      horizon: hex(k.horizon),
      glow: hex(k.glow),
      strength: k.strength,
    })),
    profiles,
    veil: {
      light: {
        color: hex(config.veil.light.color),
        amount: config.veil.light.amount,
        exposure: config.veil.light.exposure,
      },
      dark: {
        color: hex(config.veil.dark.color),
        amount: config.veil.dark.amount,
        exposure: config.veil.dark.exposure,
      },
    },
    moonLight: {
      zenith: hex(config.moon.light.zenithColor),
      horizon: hex(config.moon.light.horizonColor),
      cloud: hex(config.moon.light.cloudColor),
    },
    lighting: {
      litDay: hex(l.litDay),
      litNight: hex(l.litNight),
      shadeDay: hex(l.shadeDay),
      shadeDayStorm: hex(l.shadeDayStorm),
      shadeNight: hex(l.shadeNight),
      shadeNightStorm: hex(l.shadeNightStorm),
    },
    render: {
      sunDisc: config.sun.discSize,
      sunGlowRadiusHigh: config.sun.glowRadiusHigh,
      sunGlowRadiusLow: config.sun.glowRadiusLow,
      sunGlowGain: config.sun.glowGain,
      horizonBand: config.sun.horizonBand,
      moonDisc: config.moon.discSize,
      moonHalo: config.moon.haloStrength,
      earthshine: config.moon.earthshine,
      terminator: config.moon.terminatorSoftness,
      starDensity: config.stars.density,
      starTwinkle: config.stars.twinkle,
      horizonCurve: config.staging.shader.horizonCurve,
      cloudScaleFar: config.staging.shader.cloudScaleFar,
      cloudScaleNear: config.staging.shader.cloudScaleNear,
      cloudParallaxFar: config.staging.shader.cloudParallaxFar,
      cloudParallaxNear: config.staging.shader.cloudParallaxNear,
    },
  };
  resolvedCache.set(config, resolved);
  return resolved;
}

// -----------------------------------------------------------------------------
// Sky keyframes by sun elevation (clear sky)
// -----------------------------------------------------------------------------

export interface SampledSky {
  zenith: RGB;
  horizon: RGB;
  glow: RGB;
  strength: number;
}

/** The clear sky at a sun elevation, interpolated between keyframes. */
export function sampleSky(elevation: number, keys: ResolvedKey[]): SampledSky {
  const first = keys[0];
  const last = keys[keys.length - 1];
  const el = Math.max(first.el, Math.min(last.el, elevation));
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
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
  return { zenith: last.zenith, horizon: last.horizon, glow: last.glow, strength: last.strength };
}

// -----------------------------------------------------------------------------
// Derivation
// -----------------------------------------------------------------------------

export interface SceneWeatherInput {
  condition: WeatherCondition;
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
  /** The tunable world model. Defaults to the committed `content/sky.json`. */
  config?: SkyConfig;
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
//
// Every number above is a `staging` field of the config, and `/editor/sky`
// plots the screen-space path they produce beside the real trajectory.
// -----------------------------------------------------------------------------

export function stageMoon(
  lunar: SolarPosition,
  hemisphere: 1 | -1,
  config: SkyConfig
): { screen: ScreenPoint; size: number } {
  const stage = config.staging.moon;
  const rising = gate(stage.riseGate, lunar.elevation);
  const climb = smoothstep(stage.riseGate.to, stage.topAtDeg, lunar.elevation);
  const y = lerp(stage.rise, stage.low, rising) + (stage.high - stage.low) * climb;
  const x = Math.min(
    stage.xMax,
    Math.max(stage.xMin, azimuthToScreenX(lunar.azimuth, hemisphere, config.staging))
  );
  // The moon illusion: larger near the horizon.
  const size =
    1 +
    config.moon.illusionScale *
      (1 - smoothstep(0, config.moon.illusionFadeDeg, lunar.elevation));
  return { screen: { x, y }, size };
}

/** Map a compass azimuth to a screen x. Northern hemisphere looks south, so
 *  east is on the left; the southern hemisphere looks north and mirrors. */
export function azimuthToScreenX(
  azimuthDeg: number,
  hemisphere: 1 | -1,
  staging: StagingConfig
): number {
  const x = 0.5 + 0.5 * Math.sin((azimuthDeg - 180) * (Math.PI / 180)) * hemisphere;
  return staging.azimuthMargin + x * staging.azimuthSpan;
}

/** Where the sun disc is drawn: its azimuth across, its real elevation up. */
export function sunToScreen(
  solar: SolarPosition,
  hemisphere: 1 | -1,
  staging: StagingConfig
): ScreenPoint {
  return {
    x: azimuthToScreenX(solar.azimuth, hemisphere, staging),
    y:
      staging.horizonY +
      Math.sin(solar.elevation * (Math.PI / 180)) * staging.sunArc,
  };
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

export function deriveWeatherScene(params: DeriveSceneParams): WeatherScene {
  const { theme } = params;
  const config = params.config ?? SKY_CONFIG;
  const sky = resolveSkyConfig(config);
  const weather = params.weather;
  // No weather yet → a mostly clear sky with a few clouds, lit by the clock.
  const condition: WeatherCondition = weather?.condition ?? "clear";
  const profile = sky.profiles[condition];
  const ov = params.overrides ?? {};

  const hemisphere: 1 | -1 =
    typeof params.lat === "number" && params.lat < 0 ? -1 : 1;

  // --- Sun --------------------------------------------------------------
  const solar = resolveSolar(params);
  const elevation = solar.elevation;
  const daylight = daylightFactor(
    elevation,
    config.sun.twilightFloorDeg,
    config.sun.twilightCeilDeg
  );
  const sunScreen = sunToScreen(solar, hemisphere, config.staging);

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
  const clearSky = sampleSky(elevation, sky.keys);
  const tint = {
    zenith: mixRGB(profile.tintNight.zenith, profile.tintDay.zenith, daylight),
    horizon: mixRGB(profile.tintNight.horizon, profile.tintDay.horizon, daylight),
  };
  // Heavier cover → the condition tint takes over the clear-sky palette. Even
  // an overcast dawn keeps a hint of warmth near the horizon.
  const tintAmount = profile.tintAmount * gate(config.clouds.tintCover, cover);
  const zenith = mixRGB(clearSky.zenith, tint.zenith, tintAmount);
  const horizon = mixRGB(
    clearSky.horizon,
    tint.horizon,
    tintAmount * config.clouds.horizonTintRatio
  );
  const glow = clearSky.glow;
  const glowStrength =
    clearSky.strength *
    (1 - config.sun.coverFade * smoothstep(0.3, 0.95, cover) * profile.density);

  // --- Cloud lighting ---------------------------------------------------
  const lighting = config.clouds.lighting;
  const darkness = clamp01(
    profile.darkness +
      precipIntensity * config.clouds.darknessFromPrecip +
      (cover - profile.cover) * config.clouds.darknessFromCover
  );
  const litDay = mixRGB(sky.lighting.litDay, glow, 0.55 + 0.45 * (1 - daylight));
  const lit = mixRGB(sky.lighting.litNight, litDay, gate(lighting.dayGate, elevation));
  const shadeDay = mixRGB(sky.lighting.shadeDay, sky.lighting.shadeDayStorm, darkness);
  const shadeNight = mixRGB(
    sky.lighting.shadeNight,
    sky.lighting.shadeNightStorm,
    darkness
  );
  const shade = mixRGB(shadeNight, shadeDay, gate(lighting.shadeDayGate, elevation));

  // --- Wind -------------------------------------------------------------
  const windKmh =
    ov.windSpeedKmh ?? weather?.windSpeedKmh ?? config.clouds.defaultWindKmh;
  const windSpeed = clamp01(windKmh / config.clouds.windScaleKmh);
  const windFrom = ov.windDirectionDeg ?? weather?.windDirectionDeg ?? 270;
  const windTo = (windFrom + 180) % 360;
  const windX = -Math.sin(windTo * (Math.PI / 180)) * hemisphere * windSpeed;
  const wind = { x: windX, y: 0 };

  // --- Atmosphere -------------------------------------------------------
  const humidity = weather?.humidity ?? 0.5;
  const fog = clamp01(
    profile.fog +
      (condition === "cloudy" ? smoothstep(0.85, 1, humidity) * 0.15 : 0) +
      (precipType !== "none" ? precipIntensity * 0.12 : 0)
  );
  const night = gate(config.stars.night, elevation);

  // --- Moon -------------------------------------------------------------
  const lunar = resolveLunar(params);
  const moonPhase = lunar.phase;
  const moonIllum = getMoonIllumination(moonPhase);
  const moonUp = gate(config.moon.up, lunar.elevation);
  const skyDark = gate(config.moon.skyDark, elevation);
  // The daytime moon, on purpose (see "Staging the moon"): well up, and far
  // enough from the sun — elongation from the phase: 0° at new, 180° at full —
  // and then pale. At night the sky's darkness is the only gate.
  const elongation = 180 - Math.abs(moonPhase * 360 - 180);
  const dayMoon =
    config.moon.day.strength *
    gate(config.moon.day.elevation, lunar.elevation) *
    gate(config.moon.day.elongation, elongation);
  // The moon the sky would show with nothing in front of it, and then the same
  // moon behind the murk. Split rather than written twice so the daytime-moon
  // rule above has one home: the wipe uncovers the moon under the rule the sky
  // is showing, not a copy of it. (`starDust` below is the same split.)
  const moonBare = moonUp * lerp(dayMoon, 1, skyDark);
  const moonVisible =
    moonBare *
    (1 - gate(config.moon.cover, cover)) *
    (1 - fog * config.moon.fogGate);
  const { screen: moonScreen, size: moonSize } = stageMoon(lunar, hemisphere, config);
  // Moonlight: a bright, high moon lifts the night sky and cloud tops and
  // washes out the fainter stars.
  const moonLight = moonIllum * gate(config.moon.light.rise, lunar.elevation) * night;

  const starDust = night * (1 - config.moon.light.starWash * moonLight);
  const stars = starDust * (1 - gate(config.stars.cover, cover)) * (1 - fog);
  // The same two with the murk taken away — see `behind` on WeatherScene. Only
  // the fog wipe ever asks for them, and only inside the swath it has cleared.
  const behind = { stars: starDust, moon: moonBare };

  const veilDefaults = sky.veil[theme];

  const ml = config.moon.light;
  const moonlitZenith = mixRGB(zenith, sky.moonLight.zenith, moonLight * ml.zenithAmount);
  const moonlitHorizon = mixRGB(
    horizon,
    sky.moonLight.horizon,
    moonLight * ml.horizonAmount
  );
  const moonlitLit = mixRGB(
    lit,
    sky.moonLight.cloud,
    moonLight * (1 - gate(lighting.dayGate, elevation)) * ml.cloudAmount
  );

  return {
    sun: {
      ...solar,
      screen: sunScreen,
      daylight,
      isDay: elevation > config.sun.dayElevationDeg,
    },
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
      density: profile.density,
      darkness,
      lit: moonlitLit,
      shade,
      speed: config.clouds.speedBase + windSpeed * config.clouds.speedGain,
    },
    precipitation: { type: precipType, intensity: precipIntensity },
    wind,
    fog,
    lightning: condition === "thunder" ? 1 : 0,
    stars,
    behind,
    veil: { color: veilDefaults.color, amount: ov.veilAmount ?? veilDefaults.amount },
    exposure: veilDefaults.exposure,
    render: sky.render,
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
  return {
    condition,
    // Real measurements only make sense for the real condition; a forced
    // condition falls back to its profile defaults. Wind is kept: it is the
    // one measurement that reads the same under any sky.
    cloudCover: overrideChangesCondition ? undefined : weather?.cloudCover,
    precipitationIntensity: overrideChangesCondition
      ? undefined
      : weather?.precipitationIntensity,
    windSpeedKmh: weather?.windSpeedKmh,
    windDirectionDeg: weather?.windDirectionDeg,
    humidity: overrideChangesCondition ? undefined : weather?.humidity,
    sunriseMs: sunTimes ? sunTimes.sunriseMs : weather?.sunriseMs,
    sunsetMs: sunTimes ? sunTimes.sunsetMs : weather?.sunsetMs,
  };
}

/** Scenes per day in `sampleDaySky`: one every twenty minutes. */
const DAY_SKY_SAMPLES = 72;

export interface DaySampleParams {
  /** Any instant of the day to sample; the day is taken from local midnight. */
  dayMs: number;
  lat?: number;
  lon?: number;
  weather: SceneWeatherInput | null;
  theme: "light" | "dark";
  overrides?: SceneOverrides;
  config?: SkyConfig;
  /** Samples across the day. Defaults to 72 (one every twenty minutes). */
  samples?: number;
}

/**
 * The scenes of one day, local midnight to midnight.
 *
 * Pure and cheap — the ephemeris is a few hundred multiplies — so a devtool or
 * the Sky Engine Lab can redraw a whole day whenever the condition, the date,
 * the location or a tuned number changes.
 */
export function sampleDay(params: DaySampleParams): WeatherScene[] {
  const n = Math.max(2, Math.round(params.samples ?? DAY_SKY_SAMPLES));
  const startMs = startOfLocalDay(params.dayMs);
  const out: WeatherScene[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      deriveWeatherScene({
        nowMs: startMs + ((i + 0.5) / n) * 86_400_000,
        lat: params.lat,
        lon: params.lon,
        weather: params.weather,
        theme: params.theme,
        overrides: params.overrides,
        config: params.config,
      })
    );
  }
  return out;
}

/**
 * The sky across one day, for a timeline: each scene reduced to one colour
 * (the zenith/horizon mix, unveiled, so it stays vivid at 4px tall).
 */
export function sampleDaySky(params: DaySampleParams): RGB[] {
  return sampleDay(params).map((scene) =>
    mixRGB(scene.sky.zenith, scene.sky.horizon, 0.45)
  );
}

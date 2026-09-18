// =============================================================================
// SkyConfig — the weather wallpaper's tunable world model.
//
// `scene.ts` used to keep its look in four module-level tables (`SKY_KEYS`,
// `PROFILES`, `VEIL_DEFAULTS`, `MOON_STAGE`) and a scattering of literals; the
// shader kept another set inside GLSL. Changing any of them meant editing
// source and reloading. This module turns all of it into one plain-data
// config, with today's constants as the defaults, so the same numbers can be
// previewed live in the Sky Engine Lab (`/editor/sky`), saved to
// `content/sky.json`, and read back at build by the site.
//
// Three rules keep it honest:
//
//   1. **Defaults are the old constants, exactly.** `DEFAULT_SKY_CONFIG` is a
//      transcription, not a re-tuning — the wallpaper renders identically
//      before and after the extraction.
//   2. **Plain JSON only.** Colours are `#rrggbb` strings, never tuples, so a
//      config round-trips through `content/sky.json` without a codec.
//      `scene.ts` resolves them to RGB once per config object.
//   3. **This file is a leaf.** No React, no Next, no `@/` imports, no `fs` —
//      it is imported by the scene, the editor, the dev save route and the
//      `pnpm sky:check` CLI alike.
//
// One file rather than three (the issue's open question): a preset is one
// object to save, diff and share, and the grouping below — `sun` / `moon` /
// `stars` / `clouds` / `veil` / `staging` — already keeps each consumer out of
// the parts it does not use. `staging.shader` is the shader's framing; nothing
// in `scene.ts` reads it beyond copying it onto the scene.
// =============================================================================

import type { WeatherCondition } from "./weather";

/** The six conditions, spelled out so this module stays a leaf. */
export const SKY_CONDITIONS: WeatherCondition[] = [
  "clear",
  "cloudy",
  "fog",
  "rain",
  "snow",
  "thunder",
];

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** One keyframe of the clear sky, keyed on sun elevation. */
export interface SkyKeyConfig {
  /** Sun elevation, degrees. Keys are kept sorted ascending. */
  el: number;
  zenith: string;
  horizon: string;
  /** Colour of the sun's glow / the light that tints clouds. */
  glow: string;
  /** 0..1 glow intensity at this keyframe. */
  strength: number;
}

export interface SunConfig {
  /** The clear-sky ramp. Sampled with smoothstep between neighbouring keys. */
  keys: SkyKeyConfig[];
  /** Sun elevation above which the scene counts as day (icons, palettes). */
  dayElevationDeg: number;
  /** Daylight factor reaches 0 at this elevation (astronomical night). */
  twilightFloorDeg: number;
  /** …and 1 at this one (full day). The gap is the twilight width. */
  twilightCeilDeg: number;
  /** How strongly cloud cover mutes the glow (0 = never, 1 = fully). */
  coverFade: number;
  // --- Shader-side ---------------------------------------------------------
  /** Sun disc radius in screen units. */
  discSize: number;
  /** Glow radius with the sun high overhead… */
  glowRadiusHigh: number;
  /** …and sitting on the horizon. */
  glowRadiusLow: number;
  /** Multiplier on the whole glow term. */
  glowGain: number;
  /** Strength of the dawn/dusk warmth band along the horizon. */
  horizonBand: number;
}

/** A smoothstep gate, `from` → `to` (either may be the larger). */
export interface GateConfig {
  from: number;
  to: number;
}

export interface MoonConfig {
  // --- Shader-side ---------------------------------------------------------
  /** Moon disc radius in screen units, before the illusion scale. */
  discSize: number;
  /** How much larger the disc is drawn at the horizon (0.3 = +30%). */
  illusionScale: number;
  /** Elevation, °, by which the illusion has faded out. */
  illusionFadeDeg: number;
  /** Atmospheric halo strength, scaled by the illuminated fraction. */
  haloStrength: number;
  /** Earthshine on the night side — a whisper, or the crescent stops reading. */
  earthshine: number;
  /** Terminator softness: the width of the sphere's day/night line, in
   *  cosine of the incidence angle. */
  terminatorSoftness: number;
  // --- Visibility gates ----------------------------------------------------
  /** Elevation gate: below `from` the moon is down, above `to` fully up. */
  up: GateConfig;
  /** Sun-elevation gate for "the sky is dark enough to see it". */
  skyDark: GateConfig;
  /** The daytime moon: well up, far from the sun, and pale. */
  day: {
    elevation: GateConfig;
    /** Elongation from the sun, degrees (0 at new, 180 at full). */
    elongation: GateConfig;
    /** Peak visibility of a daytime moon. */
    strength: number;
  };
  /** Cloud cover gate — the moon fades out under cover. */
  cover: GateConfig;
  /** How much fog hides the moon (0..1). */
  fogGate: number;
  // --- Moonlight -----------------------------------------------------------
  light: {
    /** Elevation gate over which moonlight reaches full strength. */
    rise: GateConfig;
    /** Moonlight's lift of the night sky… */
    zenithColor: string;
    zenithAmount: number;
    horizonColor: string;
    horizonAmount: number;
    /** …and of the cloud tops. */
    cloudColor: string;
    cloudAmount: number;
    /** How strongly a bright moon washes out the stars. */
    starWash: number;
  };
}

export interface StarsConfig {
  /** Sun-elevation gate for night: 0 at `from`, 1 at `to`. */
  night: GateConfig;
  /** Cloud cover gate. */
  cover: GateConfig;
  // --- Shader-side ---------------------------------------------------------
  /** Field density multiplier (1 = the shipped field). */
  density: number;
  /** Twinkle amplitude, 0..1. */
  twinkle: number;
}

/** Per-condition defaults and tints — the `PROFILES` table. */
export interface ConditionProfileConfig {
  /** Cloud cover used when the API gives none… */
  cover: number;
  /** …and the floor when it does. */
  coverMin: number;
  density: number;
  darkness: number;
  precip: number;
  fog: number;
  tintDay: { zenith: string; horizon: string };
  tintNight: { zenith: string; horizon: string };
  /** How strongly the tint overrides the clear sky at full cover. */
  tintAmount: number;
}

export interface CloudsConfig {
  profiles: Record<WeatherCondition, ConditionProfileConfig>;
  /** Cover gate over which the condition tint takes over the clear sky. */
  tintCover: GateConfig;
  /** The horizon keeps a little more of the clear sky than the zenith. */
  horizonTintRatio: number;
  /** Storminess added per unit of precipitation… */
  darknessFromPrecip: number;
  /** …and per unit of cover above the profile's own. */
  darknessFromCover: number;
  // --- Cloud lighting ------------------------------------------------------
  lighting: {
    /** Lit tops by day: white mixed toward the sun glow. */
    litDay: string;
    /** …and at night. */
    litNight: string;
    /** Shaded bases, calm → stormy, by day… */
    shadeDay: string;
    shadeDayStorm: string;
    /** …and at night. */
    shadeNight: string;
    shadeNightStorm: string;
    /** Sun-elevation gate between the night and day faces. */
    dayGate: GateConfig;
    shadeDayGate: GateConfig;
  };
  // --- Wind ----------------------------------------------------------------
  /** Wind speed that counts as "full" drift, km/h. */
  windScaleKmh: number;
  /** Wind assumed when the forecast has none, km/h. */
  defaultWindKmh: number;
  /** Cloud drift at zero wind… */
  speedBase: number;
  /** …and how much full wind adds. */
  speedGain: number;
}

export interface VeilConfig {
  color: string;
  amount: number;
  exposure: number;
}

export interface StagingConfig {
  /** Screen y of the horizon, 0..1 bottom → top. */
  horizonY: number;
  /** Screen height of the sun's arc, from the horizon. */
  sunArc: number;
  /** Fraction of the width the east→west sweep spans… */
  azimuthSpan: number;
  /** …and the margin it starts from. */
  azimuthMargin: number;
  /** The moon's stage (see "Staging the moon" in scene.ts). */
  moon: {
    /** Screen y where the disc first appears, clearing the horizon. */
    rise: number;
    /** Screen y once it is properly up. */
    low: number;
    /** Screen y at its highest. */
    high: number;
    /** Elevation, °, at which the disc reaches `high`. */
    topAtDeg: number;
    /** Elevation gate across which it climbs from `rise` to `low`. */
    riseGate: GateConfig;
    /** The disc stays inside these screen x bounds. */
    xMin: number;
    xMax: number;
  };
  /** Shader framing — nothing in the scene derivation reads these. */
  shader: {
    /** Exponent on the zenith→horizon gradient; < 1 lifts the horizon band. */
    horizonCurve: number;
    /** Feature size of the far cloud deck… */
    cloudScaleFar: number;
    /** …and the near one. */
    cloudScaleNear: number;
    /** Vertical foreshortening of the far deck… */
    cloudParallaxFar: number;
    /** …and the near one. */
    cloudParallaxNear: number;
  };
}

export interface SkyConfig {
  sun: SunConfig;
  moon: MoonConfig;
  stars: StarsConfig;
  clouds: CloudsConfig;
  veil: { light: VeilConfig; dark: VeilConfig };
  staging: StagingConfig;
}

// -----------------------------------------------------------------------------
// Defaults — a transcription of the constants `scene.ts` and the shader shipped
// with. Changing a number here changes the wallpaper; that is the point.
// -----------------------------------------------------------------------------

const DEFAULT_SKY_KEYS: SkyKeyConfig[] = [
  { el: -18, zenith: "#05091a", horizon: "#0b1330", glow: "#1b2447", strength: 0 },
  { el: -12, zenith: "#070e29", horizon: "#151f48", glow: "#3d3d72", strength: 0.25 },
  { el: -6, zenith: "#0f1a48", horizon: "#4d3f73", glow: "#c8765c", strength: 0.6 },
  { el: -2, zenith: "#1f3d7a", horizon: "#b86d57", glow: "#f28c4e", strength: 0.95 },
  { el: 0, zenith: "#2d5ca4", horizon: "#dd905a", glow: "#ffb267", strength: 1 },
  { el: 4, zenith: "#3b76c3", horizon: "#ecb886", glow: "#ffd9a3", strength: 0.92 },
  { el: 10, zenith: "#4a90da", horizon: "#bdd8f0", glow: "#fff3d6", strength: 0.72 },
  { el: 25, zenith: "#3d87dc", horizon: "#c9e0f4", glow: "#ffffff", strength: 0.58 },
  { el: 60, zenith: "#2f74d2", horizon: "#d0e4f8", glow: "#ffffff", strength: 0.5 },
];

const DEFAULT_PROFILES: Record<WeatherCondition, ConditionProfileConfig> = {
  clear: {
    cover: 0.04, coverMin: 0, density: 0.35, darkness: 0.05, precip: 0, fog: 0,
    tintDay: { zenith: "#2f74d2", horizon: "#d0e4f8" },
    tintNight: { zenith: "#05091a", horizon: "#0b1330" },
    tintAmount: 0,
  },
  // "cloudy" spans WMO 1–3 (mainly clear → overcast); the measured cover
  // decides how heavy it reads, so the floor stays low.
  cloudy: {
    cover: 0.7, coverMin: 0.2, density: 0.75, darkness: 0.3, precip: 0, fog: 0.05,
    tintDay: { zenith: "#7e8b9b", horizon: "#b4bfca" },
    tintNight: { zenith: "#171b24", horizon: "#252b36" },
    tintAmount: 0.8,
  },
  fog: {
    cover: 0.75, coverMin: 0.5, density: 0.6, darkness: 0.1, precip: 0, fog: 0.9,
    tintDay: { zenith: "#c4cad2", horizon: "#e3e6ea" },
    tintNight: { zenith: "#23272e", horizon: "#31363e" },
    tintAmount: 0.9,
  },
  rain: {
    cover: 0.92, coverMin: 0.7, density: 0.9, darkness: 0.6, precip: 0.6, fog: 0.22,
    tintDay: { zenith: "#56626f", horizon: "#8e9aa7" },
    tintNight: { zenith: "#10141b", horizon: "#1c222b" },
    tintAmount: 0.9,
  },
  snow: {
    cover: 0.88, coverMin: 0.6, density: 0.75, darkness: 0.25, precip: 0.5, fog: 0.3,
    tintDay: { zenith: "#a3adba", horizon: "#d9dfe6" },
    tintNight: { zenith: "#242a38", horizon: "#353c4c" },
    tintAmount: 0.85,
  },
  thunder: {
    cover: 0.96, coverMin: 0.8, density: 1, darkness: 0.9, precip: 0.8, fog: 0.2,
    tintDay: { zenith: "#2c3440", horizon: "#4d5665" },
    tintNight: { zenith: "#0a0d13", horizon: "#151a22" },
    tintAmount: 0.92,
  },
};

export const DEFAULT_SKY_CONFIG: SkyConfig = {
  sun: {
    keys: DEFAULT_SKY_KEYS,
    dayElevationDeg: -0.5,
    twilightFloorDeg: -18,
    twilightCeilDeg: 10,
    coverFade: 0.75,
    discSize: 0.03,
    glowRadiusHigh: 0.42,
    glowRadiusLow: 1.15,
    glowGain: 1,
    horizonBand: 0.26,
  },
  moon: {
    discSize: 0.03,
    illusionScale: 0.3,
    illusionFadeDeg: 35,
    haloStrength: 0.1,
    earthshine: 0.03,
    terminatorSoftness: 0.13,
    up: { from: -3, to: 5 },
    skyDark: { from: 6, to: -8 },
    day: {
      elevation: { from: 12, to: 30 },
      elongation: { from: 40, to: 90 },
      strength: 0.18,
    },
    cover: { from: 0.45, to: 0.9 },
    fogGate: 0.8,
    light: {
      rise: { from: 0, to: 25 },
      zenithColor: "#1c2748",
      zenithAmount: 0.45,
      horizonColor: "#2a3556",
      horizonAmount: 0.35,
      cloudColor: "#4a5578",
      cloudAmount: 0.7,
      starWash: 0.55,
    },
  },
  stars: {
    night: { from: -4, to: -14 },
    cover: { from: 0.15, to: 0.65 },
    density: 1,
    twinkle: 0.45,
  },
  clouds: {
    profiles: DEFAULT_PROFILES,
    tintCover: { from: 0.25, to: 0.9 },
    horizonTintRatio: 0.85,
    darknessFromPrecip: 0.25,
    darknessFromCover: 0.2,
    lighting: {
      litDay: "#ffffff",
      litNight: "#2a3040",
      shadeDay: "#98a4b3",
      shadeDayStorm: "#39404a",
      shadeNight: "#11141b",
      shadeNightStorm: "#07090d",
      dayGate: { from: -8, to: 4 },
      shadeDayGate: { from: -8, to: 6 },
    },
    windScaleKmh: 50,
    defaultWindKmh: 8,
    speedBase: 0.35,
    speedGain: 1.4,
  },
  veil: {
    light: { color: "#ffffff", amount: 0.3, exposure: 1.06 },
    dark: { color: "#1a1a1a", amount: 0.26, exposure: 0.86 },
  },
  staging: {
    horizonY: 0.1,
    sunArc: 0.9,
    azimuthSpan: 0.88,
    azimuthMargin: 0.06,
    moon: {
      rise: 0.5,
      low: 0.62,
      high: 0.9,
      topAtDeg: 60,
      riseGate: { from: -3, to: 6 },
      xMin: 0.12,
      xMax: 0.88,
    },
    shader: {
      horizonCurve: 0.8,
      cloudScaleFar: 1.35,
      cloudScaleNear: 2.6,
      cloudParallaxFar: 0.75,
      cloudParallaxNear: 1,
    },
  },
};

// -----------------------------------------------------------------------------
// Normalization
//
// Every reader goes through `normalizeSkyConfig`: the editor's live state, the
// dev save route, the committed `content/sky.json` at build, and `sky:check`.
// A hand-edited, stale or partial file can therefore never produce a broken
// sky — the worst case is that a dropped field falls back to its default.
// -----------------------------------------------------------------------------

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

const num = (v: unknown, d: number, min: number, max: number): number =>
  isNum(v) ? clamp(v, min, max) : d;

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** A `#rrggbb` string, lower-cased, or the default. */
const color = (v: unknown, d: string): string =>
  typeof v === "string" && HEX6.test(v.trim()) ? v.trim().toLowerCase() : d;

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

/** A smoothstep gate. Both ends share one range; `from > to` is legal (and is
 *  how "darker than" gates are written). */
function gate(input: unknown, d: GateConfig, min: number, max: number): GateConfig {
  const g = obj(input);
  return {
    from: num(g.from, d.from, min, max),
    to: num(g.to, d.to, min, max),
  };
}

function skyKey(input: unknown, d: SkyKeyConfig): SkyKeyConfig {
  const k = obj(input);
  return {
    el: num(k.el, d.el, -90, 90),
    zenith: color(k.zenith, d.zenith),
    horizon: color(k.horizon, d.horizon),
    glow: color(k.glow, d.glow),
    strength: num(k.strength, d.strength, 0, 4),
  };
}

/** Keys: at least two, sorted by elevation, so `sampleSky` always brackets. */
function skyKeys(input: unknown): SkyKeyConfig[] {
  if (!Array.isArray(input) || input.length < 2) return DEFAULT_SKY_KEYS.map((k) => ({ ...k }));
  const fallback = DEFAULT_SKY_KEYS[0];
  const keys = input
    .slice(0, 24)
    .map((k, i) => skyKey(k, DEFAULT_SKY_KEYS[i] ?? fallback))
    .sort((a, b) => a.el - b.el);
  return keys.length >= 2 ? keys : DEFAULT_SKY_KEYS.map((k) => ({ ...k }));
}

function profile(
  input: unknown,
  d: ConditionProfileConfig
): ConditionProfileConfig {
  const p = obj(input);
  const day = obj(p.tintDay);
  const night = obj(p.tintNight);
  return {
    cover: num(p.cover, d.cover, 0, 1),
    coverMin: num(p.coverMin, d.coverMin, 0, 1),
    density: num(p.density, d.density, 0, 1),
    darkness: num(p.darkness, d.darkness, 0, 1),
    precip: num(p.precip, d.precip, 0, 1),
    fog: num(p.fog, d.fog, 0, 1),
    tintDay: {
      zenith: color(day.zenith, d.tintDay.zenith),
      horizon: color(day.horizon, d.tintDay.horizon),
    },
    tintNight: {
      zenith: color(night.zenith, d.tintNight.zenith),
      horizon: color(night.horizon, d.tintNight.horizon),
    },
    tintAmount: num(p.tintAmount, d.tintAmount, 0, 1),
  };
}

function veil(input: unknown, d: VeilConfig): VeilConfig {
  const v = obj(input);
  return {
    color: color(v.color, d.color),
    amount: num(v.amount, d.amount, 0, 1),
    exposure: num(v.exposure, d.exposure, 0.2, 2),
  };
}

/** Coerce arbitrary (partial, stale, untrusted) input into a valid config. */
export function normalizeSkyConfig(input: unknown): SkyConfig {
  const raw = obj(input);
  const D = DEFAULT_SKY_CONFIG;

  const sun = obj(raw.sun);
  const moon = obj(raw.moon);
  const moonDay = obj(moon.day);
  const moonLight = obj(moon.light);
  const stars = obj(raw.stars);
  const clouds = obj(raw.clouds);
  const lighting = obj(clouds.lighting);
  const profiles = obj(clouds.profiles);
  const veils = obj(raw.veil);
  const staging = obj(raw.staging);
  const stage = obj(staging.moon);
  const shader = obj(staging.shader);

  return {
    sun: {
      keys: skyKeys(sun.keys),
      dayElevationDeg: num(sun.dayElevationDeg, D.sun.dayElevationDeg, -18, 18),
      twilightFloorDeg: num(sun.twilightFloorDeg, D.sun.twilightFloorDeg, -40, 0),
      twilightCeilDeg: num(sun.twilightCeilDeg, D.sun.twilightCeilDeg, 0, 40),
      coverFade: num(sun.coverFade, D.sun.coverFade, 0, 1),
      discSize: num(sun.discSize, D.sun.discSize, 0, 0.3),
      glowRadiusHigh: num(sun.glowRadiusHigh, D.sun.glowRadiusHigh, 0.02, 3),
      glowRadiusLow: num(sun.glowRadiusLow, D.sun.glowRadiusLow, 0.02, 3),
      glowGain: num(sun.glowGain, D.sun.glowGain, 0, 3),
      horizonBand: num(sun.horizonBand, D.sun.horizonBand, 0, 2),
    },
    moon: {
      discSize: num(moon.discSize, D.moon.discSize, 0.002, 0.3),
      illusionScale: num(moon.illusionScale, D.moon.illusionScale, 0, 2),
      illusionFadeDeg: num(moon.illusionFadeDeg, D.moon.illusionFadeDeg, 1, 90),
      haloStrength: num(moon.haloStrength, D.moon.haloStrength, 0, 1),
      earthshine: num(moon.earthshine, D.moon.earthshine, 0, 1),
      terminatorSoftness: num(
        moon.terminatorSoftness,
        D.moon.terminatorSoftness,
        0.001,
        1
      ),
      up: gate(moon.up, D.moon.up, -90, 90),
      skyDark: gate(moon.skyDark, D.moon.skyDark, -90, 90),
      day: {
        elevation: gate(moonDay.elevation, D.moon.day.elevation, -90, 90),
        elongation: gate(moonDay.elongation, D.moon.day.elongation, 0, 180),
        strength: num(moonDay.strength, D.moon.day.strength, 0, 1),
      },
      cover: gate(moon.cover, D.moon.cover, 0, 1),
      fogGate: num(moon.fogGate, D.moon.fogGate, 0, 1),
      light: {
        rise: gate(moonLight.rise, D.moon.light.rise, -90, 90),
        zenithColor: color(moonLight.zenithColor, D.moon.light.zenithColor),
        zenithAmount: num(moonLight.zenithAmount, D.moon.light.zenithAmount, 0, 1),
        horizonColor: color(moonLight.horizonColor, D.moon.light.horizonColor),
        horizonAmount: num(moonLight.horizonAmount, D.moon.light.horizonAmount, 0, 1),
        cloudColor: color(moonLight.cloudColor, D.moon.light.cloudColor),
        cloudAmount: num(moonLight.cloudAmount, D.moon.light.cloudAmount, 0, 1),
        starWash: num(moonLight.starWash, D.moon.light.starWash, 0, 1),
      },
    },
    stars: {
      night: gate(stars.night, D.stars.night, -90, 90),
      cover: gate(stars.cover, D.stars.cover, 0, 1),
      density: num(stars.density, D.stars.density, 0, 4),
      twinkle: num(stars.twinkle, D.stars.twinkle, 0, 1),
    },
    clouds: {
      profiles: Object.fromEntries(
        SKY_CONDITIONS.map((c) => [
          c,
          profile(profiles[c], D.clouds.profiles[c]),
        ])
      ) as Record<WeatherCondition, ConditionProfileConfig>,
      tintCover: gate(clouds.tintCover, D.clouds.tintCover, 0, 1),
      horizonTintRatio: num(
        clouds.horizonTintRatio,
        D.clouds.horizonTintRatio,
        0,
        1
      ),
      darknessFromPrecip: num(
        clouds.darknessFromPrecip,
        D.clouds.darknessFromPrecip,
        0,
        1
      ),
      darknessFromCover: num(
        clouds.darknessFromCover,
        D.clouds.darknessFromCover,
        0,
        1
      ),
      lighting: {
        litDay: color(lighting.litDay, D.clouds.lighting.litDay),
        litNight: color(lighting.litNight, D.clouds.lighting.litNight),
        shadeDay: color(lighting.shadeDay, D.clouds.lighting.shadeDay),
        shadeDayStorm: color(
          lighting.shadeDayStorm,
          D.clouds.lighting.shadeDayStorm
        ),
        shadeNight: color(lighting.shadeNight, D.clouds.lighting.shadeNight),
        shadeNightStorm: color(
          lighting.shadeNightStorm,
          D.clouds.lighting.shadeNightStorm
        ),
        dayGate: gate(lighting.dayGate, D.clouds.lighting.dayGate, -90, 90),
        shadeDayGate: gate(
          lighting.shadeDayGate,
          D.clouds.lighting.shadeDayGate,
          -90,
          90
        ),
      },
      windScaleKmh: num(clouds.windScaleKmh, D.clouds.windScaleKmh, 1, 300),
      defaultWindKmh: num(clouds.defaultWindKmh, D.clouds.defaultWindKmh, 0, 300),
      speedBase: num(clouds.speedBase, D.clouds.speedBase, 0, 4),
      speedGain: num(clouds.speedGain, D.clouds.speedGain, 0, 8),
    },
    veil: {
      light: veil(veils.light, D.veil.light),
      dark: veil(veils.dark, D.veil.dark),
    },
    staging: {
      horizonY: num(staging.horizonY, D.staging.horizonY, -0.5, 1),
      sunArc: num(staging.sunArc, D.staging.sunArc, 0, 2),
      azimuthSpan: num(staging.azimuthSpan, D.staging.azimuthSpan, 0, 2),
      azimuthMargin: num(staging.azimuthMargin, D.staging.azimuthMargin, -0.5, 0.5),
      moon: {
        rise: num(stage.rise, D.staging.moon.rise, -0.5, 1.5),
        low: num(stage.low, D.staging.moon.low, -0.5, 1.5),
        high: num(stage.high, D.staging.moon.high, -0.5, 1.5),
        topAtDeg: num(stage.topAtDeg, D.staging.moon.topAtDeg, 1, 90),
        riseGate: gate(stage.riseGate, D.staging.moon.riseGate, -90, 90),
        xMin: num(stage.xMin, D.staging.moon.xMin, 0, 1),
        xMax: num(stage.xMax, D.staging.moon.xMax, 0, 1),
      },
      shader: {
        horizonCurve: num(shader.horizonCurve, D.staging.shader.horizonCurve, 0.1, 4),
        cloudScaleFar: num(shader.cloudScaleFar, D.staging.shader.cloudScaleFar, 0.1, 12),
        cloudScaleNear: num(shader.cloudScaleNear, D.staging.shader.cloudScaleNear, 0.1, 12),
        cloudParallaxFar: num(
          shader.cloudParallaxFar,
          D.staging.shader.cloudParallaxFar,
          0.05,
          4
        ),
        cloudParallaxNear: num(
          shader.cloudParallaxNear,
          D.staging.shader.cloudParallaxNear,
          0.05,
          4
        ),
      },
    },
  };
}

// -----------------------------------------------------------------------------
// The committed file — one document, many named presets
// -----------------------------------------------------------------------------

export interface SkyPreset {
  /** Stable slug; `default` is always present and is the shipped look. */
  id: string;
  name: string;
  config: SkyConfig;
}

export interface SkyFile {
  version: number;
  /** Which preset the site paints from. */
  active: string;
  presets: SkyPreset[];
}

export const SKY_FILE_VERSION = 1;
export const DEFAULT_PRESET_ID = "default";

export const DEFAULT_SKY_FILE: SkyFile = {
  version: SKY_FILE_VERSION,
  active: DEFAULT_PRESET_ID,
  presets: [
    { id: DEFAULT_PRESET_ID, name: "Default", config: DEFAULT_SKY_CONFIG },
  ],
};

/** A slug safe as a preset id and as a `?preset=` query value. */
export function skyPresetId(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "preset";
}

/**
 * Coerce a whole `content/sky.json` into a valid `SkyFile`.
 *
 * Invariants it enforces: the `default` preset always exists (and is first),
 * ids are unique slugs, and `active` names a preset that is actually there.
 * A bare `SkyConfig` (no `presets` key) is accepted as the default preset, so
 * an early hand-written file still loads.
 */
export function normalizeSkyFile(input: unknown): SkyFile {
  const raw = obj(input);
  const list = Array.isArray(raw.presets) ? raw.presets : null;

  // A bare config — treat it as the default preset.
  if (!list) {
    return {
      version: SKY_FILE_VERSION,
      active: DEFAULT_PRESET_ID,
      presets: [
        {
          id: DEFAULT_PRESET_ID,
          name: "Default",
          config: normalizeSkyConfig(Object.keys(raw).length ? raw : undefined),
        },
      ],
    };
  }

  const seen = new Set<string>();
  const presets: SkyPreset[] = [];
  for (const entry of list.slice(0, 64)) {
    const p = obj(entry);
    const name = typeof p.name === "string" && p.name.trim() ? p.name.trim().slice(0, 48) : "Preset";
    let id = skyPresetId(typeof p.id === "string" && p.id ? p.id : name);
    while (seen.has(id)) id = `${id}-2`.slice(0, 48);
    seen.add(id);
    presets.push({ id, name, config: normalizeSkyConfig(p.config) });
  }

  const fallback = presets.find((p) => p.id === DEFAULT_PRESET_ID);
  if (!fallback) {
    presets.unshift({
      id: DEFAULT_PRESET_ID,
      name: "Default",
      config: DEFAULT_SKY_CONFIG,
    });
  }

  const active =
    typeof raw.active === "string" && presets.some((p) => p.id === raw.active)
      ? raw.active
      : DEFAULT_PRESET_ID;

  return { version: SKY_FILE_VERSION, active, presets };
}

/** The config a file paints from — `active`, or the default preset. */
export function activeSkyConfig(file: SkyFile, presetId?: string): SkyConfig {
  const id = presetId ?? file.active;
  const found = file.presets.find((p) => p.id === id);
  return (found ?? file.presets[0])?.config ?? DEFAULT_SKY_CONFIG;
}

// -----------------------------------------------------------------------------
// Drift report — what `pnpm sky:check` prints
// -----------------------------------------------------------------------------

export interface SkyConfigIssue {
  /** Dotted path into the config, e.g. `presets[1].config.sun.discSize`. */
  path: string;
  /** What was in the file… */
  found: unknown;
  /** …and what normalization replaced it with. */
  normalized: unknown;
}

/**
 * Every field normalization had to change, as a flat list.
 *
 * A clean file normalizes to itself: `sky:check` fails when this is non-empty,
 * which catches a removed field, an out-of-range value, a mistyped colour, or
 * a file written by an older shape of the config.
 */
export function diffSkyValues(
  found: unknown,
  normalized: unknown,
  path = ""
): SkyConfigIssue[] {
  if (Array.isArray(normalized)) {
    if (!Array.isArray(found) || found.length !== normalized.length) {
      return [{ path: path || "(root)", found, normalized }];
    }
    return normalized.flatMap((v, i) =>
      diffSkyValues(found[i], v, `${path}[${i}]`)
    );
  }
  if (normalized && typeof normalized === "object") {
    if (!found || typeof found !== "object" || Array.isArray(found)) {
      return [{ path: path || "(root)", found, normalized }];
    }
    const f = found as Record<string, unknown>;
    const n = normalized as Record<string, unknown>;
    const keys = new Set([...Object.keys(n), ...Object.keys(f)]);
    return [...keys].flatMap((k) =>
      k in n
        ? diffSkyValues(f[k], n[k], path ? `${path}.${k}` : k)
        : // A key the current shape no longer has: report it, so a rename
          // does not silently leave dead data in the committed file.
          [{ path: path ? `${path}.${k}` : k, found: f[k], normalized: undefined }]
    );
  }
  return Object.is(found, normalized) ? [] : [{ path: path || "(root)", found, normalized }];
}

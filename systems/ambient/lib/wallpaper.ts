import type { AmbientPhase } from "./phase";
import type { WeatherCondition } from "./weather";

// =============================================================================
// Wallpaper scene model
//
// A photographic-feeling atmosphere for the full-page weather wallpaper.
// Sky color, sun/moon, clouds, and precipitation are derived from phase +
// condition + theme, then the renderer morphs uniforms toward the target
// (never snaps) so condition changes feel like iOS Weather.
// =============================================================================

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export interface AtmosphereParams {
  zenith: Vec3;
  horizon: Vec3;
  haze: Vec3;
  ground: Vec3;
  sunPos: Vec2;
  sunColor: Vec3;
  sunSize: number;
  sunGlow: number;
  moonPos: Vec2;
  moonColor: Vec3;
  moonSize: number;
  moonGlow: number;
  cloudCover: number;
  cloudScale: number;
  cloudSpeed: number;
  cloudLight: Vec3;
  cloudShade: Vec3;
  fog: number;
  stars: number;
  wind: number;
  rain: number;
  snow: number;
  thunder: number;
  rays: number;
  vignette: number;
  grain: number;
}

export interface WallpaperSceneInput {
  condition: WeatherCondition;
  phase: AmbientPhase;
  theme: "light" | "dark";
  isDay: boolean;
}

const DEFAULT_MOON: Vec3 = [0.86, 0.9, 0.98];

function rgb(r: number, g: number, b: number): Vec3 {
  return [r / 255, g / 255, b / 255];
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

function lift(c: Vec3, amount: number): Vec3 {
  return [
    mix(c[0], 1, amount),
    mix(c[1], 1, amount),
    mix(c[2], 1, amount),
  ];
}

function shade(c: Vec3, amount: number): Vec3 {
  return [c[0] * amount, c[1] * amount, c[2] * amount];
}

function saturate(c: Vec3, amount: number): Vec3 {
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return [
    mix(l, c[0], amount),
    mix(l, c[1], amount),
    mix(l, c[2], amount),
  ];
}

type SkyPlate = {
  zenith: Vec3;
  horizon: Vec3;
  haze: Vec3;
  ground: Vec3;
  sunPos: Vec2;
  sunColor: Vec3;
  sunSize: number;
  sunGlow: number;
  moonPos: Vec2;
  moonGlow: number;
  rays: number;
  stars: number;
};

/**
 * Phase plates — photographic skies close to iOS Weather's time-of-day grades.
 * Dark-theme values are the cinematic source; light theme lifts them later.
 */
const PHASE_SKY: Record<AmbientPhase, SkyPlate> = {
  sunrise: {
    zenith: rgb(58, 92, 148),
    horizon: rgb(255, 176, 122),
    haze: rgb(255, 206, 154),
    ground: rgb(42, 54, 86),
    sunPos: [0.18, 0.2],
    sunColor: rgb(255, 214, 160),
    sunSize: 0.018,
    sunGlow: 1.15,
    moonPos: [0.78, 0.72],
    moonGlow: 0,
    rays: 0.55,
    stars: 0.08,
  },
  morning: {
    zenith: rgb(62, 142, 214),
    horizon: rgb(186, 222, 245),
    haze: rgb(214, 236, 250),
    ground: rgb(92, 140, 186),
    sunPos: [0.3, 0.58],
    sunColor: rgb(255, 244, 214),
    sunSize: 0.016,
    sunGlow: 0.95,
    moonPos: [0.8, 0.7],
    moonGlow: 0,
    rays: 0.28,
    stars: 0,
  },
  afternoon: {
    zenith: rgb(36, 118, 204),
    horizon: rgb(154, 206, 236),
    haze: rgb(198, 226, 242),
    ground: rgb(74, 128, 176),
    sunPos: [0.58, 0.74],
    sunColor: rgb(255, 250, 230),
    sunSize: 0.014,
    sunGlow: 1.05,
    moonPos: [0.82, 0.68],
    moonGlow: 0,
    rays: 0.22,
    stars: 0,
  },
  sunset: {
    zenith: rgb(52, 48, 110),
    horizon: rgb(255, 122, 64),
    haze: rgb(232, 86, 110),
    ground: rgb(48, 28, 62),
    sunPos: [0.84, 0.18],
    sunColor: rgb(255, 186, 110),
    sunSize: 0.02,
    sunGlow: 1.25,
    moonPos: [0.22, 0.7],
    moonGlow: 0.08,
    rays: 0.62,
    stars: 0.12,
  },
  evening: {
    zenith: rgb(18, 28, 64),
    horizon: rgb(86, 64, 128),
    haze: rgb(110, 78, 132),
    ground: rgb(12, 16, 36),
    sunPos: [0.86, -0.12],
    sunColor: rgb(255, 176, 120),
    sunSize: 0.01,
    sunGlow: 0.12,
    moonPos: [0.76, 0.64],
    moonGlow: 0.72,
    rays: 0.04,
    stars: 0.55,
  },
  night: {
    zenith: rgb(8, 14, 32),
    horizon: rgb(22, 34, 68),
    haze: rgb(28, 40, 78),
    ground: rgb(6, 10, 22),
    sunPos: [0.5, -0.2],
    sunColor: rgb(200, 210, 230),
    sunSize: 0.008,
    sunGlow: 0,
    moonPos: [0.7, 0.7],
    moonGlow: 0.88,
    rays: 0,
    stars: 0.85,
  },
};

type WeatherMod = {
  cloudCover: number;
  cloudScale: number;
  cloudSpeed: number;
  fog: number;
  wind: number;
  rain: number;
  snow: number;
  thunder: number;
  dim: number;
  saturate: number;
  cool: number;
};

const WEATHER_MOD: Record<WeatherCondition, WeatherMod> = {
  clear: {
    cloudCover: 0.22,
    cloudScale: 1.15,
    cloudSpeed: 0.018,
    fog: 0.04,
    wind: 0.12,
    rain: 0,
    snow: 0,
    thunder: 0,
    dim: 1,
    saturate: 1.05,
    cool: 0,
  },
  cloudy: {
    cloudCover: 0.78,
    cloudScale: 1.35,
    cloudSpeed: 0.022,
    fog: 0.1,
    wind: 0.22,
    rain: 0,
    snow: 0,
    thunder: 0,
    dim: 0.82,
    saturate: 0.78,
    cool: 0.08,
  },
  fog: {
    cloudCover: 0.48,
    cloudScale: 0.85,
    cloudSpeed: 0.01,
    fog: 0.78,
    wind: 0.06,
    rain: 0,
    snow: 0,
    thunder: 0,
    dim: 0.78,
    saturate: 0.32,
    cool: 0.22,
  },
  rain: {
    cloudCover: 0.9,
    cloudScale: 1.45,
    cloudSpeed: 0.04,
    fog: 0.22,
    wind: 0.45,
    rain: 1,
    snow: 0,
    thunder: 0,
    dim: 0.52,
    saturate: 0.55,
    cool: 0.42,
  },
  snow: {
    cloudCover: 0.7,
    cloudScale: 1.2,
    cloudSpeed: 0.016,
    fog: 0.22,
    wind: 0.18,
    rain: 0,
    snow: 1,
    thunder: 0,
    dim: 0.86,
    saturate: 0.58,
    cool: 0.2,
  },
  thunder: {
    cloudCover: 0.96,
    cloudScale: 1.55,
    cloudSpeed: 0.05,
    fog: 0.2,
    wind: 0.62,
    rain: 0.72,
    snow: 0,
    thunder: 1,
    dim: 0.38,
    saturate: 0.9,
    cool: 0.28,
  },
};

function applyWeatherToSky(plate: SkyPlate, weather: WeatherMod): SkyPlate {
  const coolTint = rgb(92, 118, 150);
  const stormTint = rgb(36, 32, 62);
  const tint = weather.thunder > 0 ? stormTint : coolTint;
  const t = Math.max(weather.cool, weather.thunder * 0.55);

  return {
    ...plate,
    zenith: saturate(shade(mix3(plate.zenith, tint, t), weather.dim), weather.saturate),
    horizon: saturate(shade(mix3(plate.horizon, tint, t * 0.6), mix(1, weather.dim, 0.6)), weather.saturate),
    haze: saturate(shade(mix3(plate.haze, tint, t * 0.45), mix(1, weather.dim, 0.45)), weather.saturate),
    ground: shade(mix3(plate.ground, tint, t * 0.5), weather.dim),
    sunGlow: plate.sunGlow * weather.dim * (1 - weather.fog * 0.55),
    sunSize: plate.sunSize * mix(1, 0.7, weather.cloudCover),
    moonGlow: plate.moonGlow * mix(1, 0.45, weather.cloudCover) * (1 - weather.fog * 0.4),
    rays: plate.rays * weather.dim * (1 - weather.cloudCover * 0.7) * (1 - weather.fog),
    stars: plate.stars * (1 - weather.cloudCover * 0.75) * (1 - weather.fog * 0.85),
  };
}

function cloudColors(sky: SkyPlate, weather: WeatherMod, isDay: boolean): {
  light: Vec3;
  shade: Vec3;
} {
  if (!isDay) {
    return {
      light: mix3(rgb(86, 98, 132), sky.haze, 0.35),
      shade: mix3(rgb(18, 24, 42), sky.zenith, 0.4),
    };
  }
  if (weather.thunder > 0) {
    return {
      light: rgb(118, 112, 142),
      shade: rgb(28, 26, 46),
    };
  }
  if (weather.rain > 0) {
    return {
      light: rgb(168, 180, 198),
      shade: rgb(64, 76, 96),
    };
  }
  return {
    light: mix3(rgb(250, 252, 255), sky.haze, 0.15),
    shade: mix3(rgb(118, 140, 168), sky.zenith, 0.25),
  };
}

export function resolveAtmosphere(input: WallpaperSceneInput): AtmosphereParams {
  const weather = WEATHER_MOD[input.condition];
  const plate = applyWeatherToSky(PHASE_SKY[input.phase], weather);
  const clouds = cloudColors(plate, weather, input.isDay);

  // Light theme: high-key wash so editorial type stays readable.
  const liftAmt = input.theme === "light" ? (input.isDay ? 0.58 : 0.42) : 0;
  const liftSky = (c: Vec3, extra = 0) => (liftAmt > 0 ? lift(c, liftAmt + extra) : c);

  return {
    zenith: liftSky(plate.zenith),
    horizon: liftSky(plate.horizon, 0.06),
    haze: liftSky(plate.haze, 0.08),
    ground: liftSky(plate.ground, -0.04),
    sunPos: plate.sunPos,
    sunColor: plate.sunColor,
    sunSize: plate.sunSize,
    sunGlow: input.theme === "light" ? plate.sunGlow * 0.72 : plate.sunGlow,
    moonPos: plate.moonPos,
    moonColor: DEFAULT_MOON,
    moonSize: 0.014,
    moonGlow: input.theme === "light" ? plate.moonGlow * 0.55 : plate.moonGlow,
    cloudCover: weather.cloudCover,
    cloudScale: weather.cloudScale,
    cloudSpeed: weather.cloudSpeed,
    cloudLight: liftSky(clouds.light, 0.12),
    cloudShade: liftSky(clouds.shade),
    fog: weather.fog,
    stars: input.theme === "light" ? plate.stars * 0.25 : plate.stars,
    wind: weather.wind,
    rain: weather.rain,
    snow: weather.snow,
    thunder: weather.thunder,
    rays: plate.rays,
    vignette: input.theme === "dark" ? 0.28 : 0.1,
    grain: input.theme === "dark" ? 0.045 : 0.025,
  };
}

export function createAtmosphereState(initial: AtmosphereParams): AtmosphereParams {
  return { ...initial };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Exponential approach so weather/phase changes morph instead of snapping. */
export function approachAtmosphere(
  current: AtmosphereParams,
  target: AtmosphereParams,
  dtSec: number,
  rate = 2.1
): AtmosphereParams {
  const t = 1 - Math.exp(-Math.max(0, dtSec) * rate);
  return {
    zenith: lerp3(current.zenith, target.zenith, t),
    horizon: lerp3(current.horizon, target.horizon, t),
    haze: lerp3(current.haze, target.haze, t),
    ground: lerp3(current.ground, target.ground, t),
    sunPos: lerp2(current.sunPos, target.sunPos, t),
    sunColor: lerp3(current.sunColor, target.sunColor, t),
    sunSize: lerp(current.sunSize, target.sunSize, t),
    sunGlow: lerp(current.sunGlow, target.sunGlow, t),
    moonPos: lerp2(current.moonPos, target.moonPos, t),
    moonColor: lerp3(current.moonColor, target.moonColor, t),
    moonSize: lerp(current.moonSize, target.moonSize, t),
    moonGlow: lerp(current.moonGlow, target.moonGlow, t),
    cloudCover: lerp(current.cloudCover, target.cloudCover, t),
    cloudScale: lerp(current.cloudScale, target.cloudScale, t),
    cloudSpeed: lerp(current.cloudSpeed, target.cloudSpeed, t),
    cloudLight: lerp3(current.cloudLight, target.cloudLight, t),
    cloudShade: lerp3(current.cloudShade, target.cloudShade, t),
    fog: lerp(current.fog, target.fog, t),
    stars: lerp(current.stars, target.stars, t),
    wind: lerp(current.wind, target.wind, t),
    rain: lerp(current.rain, target.rain, t),
    snow: lerp(current.snow, target.snow, t),
    thunder: lerp(current.thunder, target.thunder, t),
    rays: lerp(current.rays, target.rays, t),
    vignette: lerp(current.vignette, target.vignette, t),
    grain: lerp(current.grain, target.grain, t),
  };
}

export function isDayPhase(phase: AmbientPhase): boolean {
  return phase === "sunrise" || phase === "morning" || phase === "afternoon";
}

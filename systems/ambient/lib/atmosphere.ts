import type { AmbientPhase } from "./phase";
import {
  intensityWeight,
  type WeatherCondition,
  type WeatherIntensity,
} from "./weather";

export type RGB = readonly [number, number, number];

export type SunPosition = {
  /** −1 deep night … 0 horizon … 1 solar noon. */
  elevation: number;
  /** 0 at sunrise, 0.5 at solar noon, 1 at sunset. */
  azimuth: number;
};

export type WallpaperScene = {
  zenith: RGB;
  horizon: RGB;
  haze: RGB;
  sunColor: RGB;
  moonColor: RGB;
  cloudLit: RGB;
  cloudShadow: RGB;
  sunElevation: number;
  sunAzimuth: number;
  moonElevation: number;
  moonAzimuth: number;
  sunScale: number;
  moonScale: number;
  sunGlow: number;
  starOpacity: number;
  cloudCover: number;
  cloudSoftness: number;
  cloudDarkness: number;
  fogDensity: number;
  /** 0 none, 1 drizzle, 2 rain, 3 snow. */
  precipKind: number;
  precipRate: number;
  wind: number;
  lightningRate: number;
  warmth: number;
  /** 0 light theme, 1 dark theme. */
  theme: number;
};

export const WALLPAPER_CROSSFADE_MS = 1400;

const FALLBACK_SUNRISE_HOUR = 6.5;
const FALLBACK_SUNSET_HOUR = 18.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function mixRgb(base: RGB, tint: RGB, amount: number): RGB {
  return lerpRgb(base, tint, clamp(amount, 0, 1));
}

function liftRgb(color: RGB, amount: number): RGB {
  return [
    clamp(color[0] + amount, 0, 1),
    clamp(color[1] + amount, 0, 1),
    clamp(color[2] + amount, 0, 1),
  ];
}

function scaleRgb(color: RGB, amount: number): RGB {
  return [
    clamp(color[0] * amount, 0, 1),
    clamp(color[1] * amount, 0, 1),
    clamp(color[2] * amount, 0, 1),
  ];
}

function sunFromWindow(
  nowMs: number,
  sunriseMs: number,
  sunsetMs: number
): SunPosition {
  const twilight = 2 * 60 * 60 * 1000;
  if (nowMs < sunriseMs) {
    const t = clamp((sunriseMs - nowMs) / twilight, 0, 1);
    return { elevation: lerp(0, -0.48, t), azimuth: lerp(0, -0.16, t) };
  }
  if (nowMs > sunsetMs) {
    const t = clamp((nowMs - sunsetMs) / twilight, 0, 1);
    return { elevation: lerp(0, -0.48, t), azimuth: lerp(1, 1.16, t) };
  }
  const span = Math.max(sunsetMs - sunriseMs, 60_000);
  const progress = clamp((nowMs - sunriseMs) / span, 0, 1);
  return {
    elevation: Math.sin(progress * Math.PI),
    azimuth: progress,
  };
}

export function getSunPosition(params: {
  nowMs: number;
  sunriseMs?: number;
  sunsetMs?: number;
}): SunPosition {
  const { nowMs, sunriseMs, sunsetMs } = params;
  if (Number.isFinite(sunriseMs) && Number.isFinite(sunsetMs)) {
    return sunFromWindow(nowMs, sunriseMs as number, sunsetMs as number);
  }

  const date = new Date(nowMs);
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const sunrise = start.getTime() + FALLBACK_SUNRISE_HOUR * 3600_000;
  const sunset = start.getTime() + FALLBACK_SUNSET_HOUR * 3600_000;
  return sunFromWindow(nowMs, sunrise, sunset);
}

/** Representative sun placement for a forced ambient phase (devtool). */
export function getSunPositionForPhase(phase: AmbientPhase): SunPosition {
  switch (phase) {
    case "sunrise":
      return { elevation: 0.04, azimuth: 0.08 };
    case "morning":
      return { elevation: 0.38, azimuth: 0.28 };
    case "afternoon":
      return { elevation: 0.86, azimuth: 0.54 };
    case "sunset":
      return { elevation: 0.05, azimuth: 0.92 };
    case "evening":
      return { elevation: -0.1, azimuth: 1.06 };
    case "night":
      return { elevation: -0.38, azimuth: 1.18 };
  }
}

type SkyKeyframe = { elev: number; zenith: RGB; horizon: RGB; haze: RGB };

const DARK_SKY: SkyKeyframe[] = [
  {
    elev: -0.5,
    zenith: [0.045, 0.05, 0.12],
    horizon: [0.05, 0.055, 0.11],
    haze: [0.07, 0.08, 0.14],
  },
  {
    elev: -0.12,
    zenith: [0.07, 0.08, 0.2],
    horizon: [0.22, 0.14, 0.28],
    haze: [0.16, 0.12, 0.22],
  },
  {
    elev: 0.02,
    zenith: [0.1, 0.14, 0.36],
    horizon: [0.92, 0.48, 0.22],
    haze: [0.72, 0.38, 0.28],
  },
  {
    elev: 0.22,
    zenith: [0.16, 0.3, 0.62],
    horizon: [0.62, 0.58, 0.52],
    haze: [0.55, 0.52, 0.5],
  },
  {
    elev: 0.55,
    zenith: [0.14, 0.36, 0.72],
    horizon: [0.42, 0.64, 0.82],
    haze: [0.4, 0.58, 0.74],
  },
  {
    elev: 1,
    zenith: [0.12, 0.38, 0.78],
    horizon: [0.38, 0.66, 0.86],
    haze: [0.36, 0.6, 0.8],
  },
];

const LIGHT_SKY: SkyKeyframe[] = [
  {
    elev: -0.5,
    zenith: [0.78, 0.8, 0.88],
    horizon: [0.88, 0.9, 0.94],
    haze: [0.86, 0.88, 0.93],
  },
  {
    elev: -0.12,
    zenith: [0.62, 0.66, 0.82],
    horizon: [0.9, 0.8, 0.78],
    haze: [0.86, 0.82, 0.84],
  },
  {
    elev: 0.02,
    zenith: [0.64, 0.72, 0.9],
    horizon: [0.98, 0.8, 0.58],
    haze: [0.96, 0.84, 0.7],
  },
  {
    elev: 0.22,
    zenith: [0.72, 0.84, 0.96],
    horizon: [0.97, 0.93, 0.86],
    haze: [0.94, 0.92, 0.9],
  },
  {
    elev: 0.55,
    zenith: [0.7, 0.86, 0.98],
    horizon: [0.94, 0.96, 0.98],
    haze: [0.9, 0.94, 0.98],
  },
  {
    elev: 1,
    zenith: [0.66, 0.86, 0.99],
    horizon: [0.93, 0.96, 0.99],
    haze: [0.88, 0.94, 0.99],
  },
];

function sampleSky(keys: SkyKeyframe[], elevation: number): SkyKeyframe {
  if (elevation <= keys[0].elev) return keys[0];
  const last = keys[keys.length - 1];
  if (elevation >= last.elev) return last;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (elevation <= b.elev) {
      const t = (elevation - a.elev) / (b.elev - a.elev);
      return {
        elev: elevation,
        zenith: lerpRgb(a.zenith, b.zenith, t),
        horizon: lerpRgb(a.horizon, b.horizon, t),
        haze: lerpRgb(a.haze, b.haze, t),
      };
    }
  }
  return last;
}

function weatherSky(
  sky: SkyKeyframe,
  condition: WeatherCondition,
  intensity: WeatherIntensity,
  theme: "light" | "dark"
): { zenith: RGB; horizon: RGB; haze: RGB } {
  const weight = intensityWeight(intensity);
  let { zenith, horizon, haze } = sky;

  const grey = theme === "dark" ? ([0.16, 0.18, 0.22] as RGB) : ([0.86, 0.88, 0.9] as RGB);
  const rain = theme === "dark" ? ([0.1, 0.16, 0.24] as RGB) : ([0.72, 0.8, 0.86] as RGB);
  const snow = theme === "dark" ? ([0.22, 0.22, 0.3] as RGB) : ([0.9, 0.9, 0.96] as RGB);
  const storm = theme === "dark" ? ([0.08, 0.07, 0.16] as RGB) : ([0.7, 0.72, 0.82] as RGB);
  const fogGrey = theme === "dark" ? ([0.2, 0.22, 0.24] as RGB) : ([0.88, 0.9, 0.91] as RGB);

  switch (condition) {
    case "clear":
      break;
    case "partlyCloudy":
      zenith = mixRgb(zenith, grey, 0.18);
      horizon = mixRgb(horizon, grey, 0.12);
      break;
    case "cloudy":
      zenith = mixRgb(zenith, grey, 0.55);
      horizon = mixRgb(horizon, grey, 0.42);
      haze = mixRgb(haze, grey, 0.35);
      if (theme === "dark") {
        zenith = scaleRgb(zenith, 0.78);
        horizon = scaleRgb(horizon, 0.82);
      }
      break;
    case "fog":
      zenith = mixRgb(zenith, fogGrey, 0.72);
      horizon = mixRgb(horizon, fogGrey, 0.8);
      haze = mixRgb(haze, fogGrey, 0.7);
      zenith = lerpRgb(zenith, horizon, 0.45);
      break;
    case "drizzle":
      zenith = mixRgb(zenith, rain, 0.38 * weight);
      horizon = mixRgb(horizon, rain, 0.28 * weight);
      haze = mixRgb(haze, rain, 0.3);
      break;
    case "rain":
      zenith = mixRgb(zenith, rain, 0.62 * weight);
      horizon = mixRgb(horizon, rain, 0.48 * weight);
      haze = mixRgb(haze, rain, 0.4);
      zenith = scaleRgb(zenith, theme === "dark" ? 0.72 : 0.9);
      break;
    case "snow":
      zenith = mixRgb(zenith, snow, 0.5);
      horizon = mixRgb(horizon, snow, 0.45);
      haze = mixRgb(haze, snow, 0.4);
      if (theme === "light") {
        zenith = liftRgb(zenith, 0.04);
        horizon = liftRgb(horizon, 0.05);
      }
      break;
    case "thunder":
      zenith = mixRgb(zenith, storm, 0.7 * weight);
      horizon = mixRgb(horizon, storm, 0.55 * weight);
      haze = mixRgb(haze, storm, 0.45);
      zenith = scaleRgb(zenith, theme === "dark" ? 0.62 : 0.84);
      break;
  }

  return { zenith, horizon, haze };
}

function sunColorForElevation(elevation: number, theme: "light" | "dark"): RGB {
  const noon: RGB = theme === "dark" ? [1, 0.94, 0.78] : [1, 0.96, 0.86];
  const gold: RGB = [1, 0.72, 0.32];
  const ember: RGB = [1, 0.42, 0.16];
  if (elevation >= 0.35) return lerpRgb(gold, noon, clamp((elevation - 0.35) / 0.65, 0, 1));
  if (elevation >= 0) return lerpRgb(ember, gold, clamp(elevation / 0.35, 0, 1));
  return scaleRgb(ember, 0.15);
}

function moonFromSun(sun: SunPosition): SunPosition {
  return {
    elevation: clamp(-sun.elevation * 0.85 + 0.08, -0.2, 0.72),
    azimuth: (sun.azimuth + 0.62) % 1.2,
  };
}

const CONDITION_BASE: Record<
  WeatherCondition,
  {
    cloudCover: number;
    cloudSoftness: number;
    cloudDarkness: number;
    fog: number;
    precipKind: number;
    precipRate: number;
    lightning: number;
  }
> = {
  clear: {
    cloudCover: 0.07,
    cloudSoftness: 0.72,
    cloudDarkness: 0.12,
    fog: 0.02,
    precipKind: 0,
    precipRate: 0,
    lightning: 0,
  },
  partlyCloudy: {
    cloudCover: 0.4,
    cloudSoftness: 0.62,
    cloudDarkness: 0.22,
    fog: 0.04,
    precipKind: 0,
    precipRate: 0,
    lightning: 0,
  },
  cloudy: {
    cloudCover: 0.86,
    cloudSoftness: 0.48,
    cloudDarkness: 0.42,
    fog: 0.08,
    precipKind: 0,
    precipRate: 0,
    lightning: 0,
  },
  fog: {
    cloudCover: 0.52,
    cloudSoftness: 0.9,
    cloudDarkness: 0.16,
    fog: 0.78,
    precipKind: 0,
    precipRate: 0,
    lightning: 0,
  },
  drizzle: {
    cloudCover: 0.74,
    cloudSoftness: 0.58,
    cloudDarkness: 0.34,
    fog: 0.16,
    precipKind: 1,
    precipRate: 0.42,
    lightning: 0,
  },
  rain: {
    cloudCover: 0.9,
    cloudSoftness: 0.42,
    cloudDarkness: 0.52,
    fog: 0.2,
    precipKind: 2,
    precipRate: 0.78,
    lightning: 0,
  },
  snow: {
    cloudCover: 0.8,
    cloudSoftness: 0.7,
    cloudDarkness: 0.18,
    fog: 0.14,
    precipKind: 3,
    precipRate: 0.62,
    lightning: 0,
  },
  thunder: {
    cloudCover: 0.95,
    cloudSoftness: 0.36,
    cloudDarkness: 0.68,
    fog: 0.22,
    precipKind: 2,
    precipRate: 0.7,
    lightning: 0.72,
  },
};

export type WallpaperSceneInput = {
  condition: WeatherCondition;
  intensity?: WeatherIntensity;
  cloudCover?: number;
  precipitationMm?: number;
  windSpeedKmh?: number;
  theme: "light" | "dark";
  phase: AmbientPhase;
  nowMs: number;
  sunriseMs?: number;
  sunsetMs?: number;
  isDay?: boolean;
  /** When true, sun placement follows `phase` instead of the clock. */
  lockSunToPhase?: boolean;
};

export function buildWallpaperScene(input: WallpaperSceneInput): WallpaperScene {
  const intensity = input.intensity ?? "moderate";
  const weight = intensityWeight(intensity);
  const base = CONDITION_BASE[input.condition];

  let sun = input.lockSunToPhase
    ? getSunPositionForPhase(input.phase)
    : getSunPosition({
        nowMs: input.nowMs,
        sunriseMs: input.sunriseMs,
        sunsetMs: input.sunsetMs,
      });

  if (!input.lockSunToPhase && typeof input.isDay === "boolean") {
    if (input.isDay && sun.elevation < 0.04) {
      sun = { elevation: 0.12, azimuth: clamp(sun.azimuth, 0.12, 0.88) };
    } else if (!input.isDay && sun.elevation > 0) {
      sun = { elevation: -0.22, azimuth: sun.azimuth > 0.5 ? 1.08 : -0.08 };
    }
  }

  const moon = moonFromSun(sun);
  const keys = input.theme === "dark" ? DARK_SKY : LIGHT_SKY;
  const sky = weatherSky(sampleSky(keys, sun.elevation), input.condition, intensity, input.theme);

  const apiCover =
    typeof input.cloudCover === "number"
      ? clamp(input.cloudCover / 100, 0, 1)
      : base.cloudCover;
  const cloudCover = clamp(lerp(base.cloudCover, apiCover, 0.7), 0, 1);

  const precipBoost =
    typeof input.precipitationMm === "number" && input.precipitationMm > 0
      ? clamp(0.55 + input.precipitationMm * 0.18, 0.55, 1.2)
      : 1;

  const warmth =
    input.phase === "sunrise" || input.phase === "sunset"
      ? 1
      : clamp(1 - Math.abs(sun.elevation) * 2.4, 0, 0.55);

  const above = clamp(sun.elevation, 0, 1);
  const night = clamp(-sun.elevation, 0, 1);
  const wind = clamp((input.windSpeedKmh ?? 8) / 36, 0.06, 1.25);

  const sunColor = sunColorForElevation(sun.elevation, input.theme);
  const moonColor: RGB =
    input.theme === "dark" ? [0.86, 0.9, 0.98] : [0.94, 0.95, 0.98];

  const cloudLit = mixRgb(
    input.theme === "dark" ? [0.82, 0.84, 0.88] : [0.98, 0.98, 0.99],
    sunColor,
    0.28 + warmth * 0.35
  );
  const cloudShadow =
    input.theme === "dark"
      ? mixRgb([0.12, 0.14, 0.2], sky.zenith, 0.35)
      : mixRgb([0.62, 0.66, 0.72], sky.horizon, 0.4);

  return {
    zenith: sky.zenith,
    horizon: sky.horizon,
    haze: sky.haze,
    sunColor,
    moonColor,
    cloudLit,
    cloudShadow,
    sunElevation: sun.elevation,
    sunAzimuth: sun.azimuth,
    moonElevation: moon.elevation,
    moonAzimuth: moon.azimuth,
    sunScale: lerp(0.7, 1.15, above),
    moonScale: lerp(0.85, 1.05, night),
    sunGlow: clamp(0.15 + above * 0.85 + warmth * 0.35, 0, 1.4) * (1 - cloudCover * 0.55),
    starOpacity: clamp(night * 1.15 - cloudCover * 0.55, 0, 1) * (input.theme === "dark" ? 1 : 0.22),
    cloudCover,
    cloudSoftness: base.cloudSoftness,
    cloudDarkness: clamp(base.cloudDarkness * (0.75 + weight * 0.4), 0, 1),
    fogDensity: clamp(base.fog * (0.7 + weight * 0.45), 0, 1),
    precipKind: base.precipKind,
    precipRate: clamp(base.precipRate * weight * precipBoost, 0, 1.4),
    wind,
    lightningRate: clamp(base.lightning * weight, 0, 1),
    warmth,
    theme: input.theme === "dark" ? 1 : 0,
  };
}

export function lerpWallpaperScene(
  from: WallpaperScene,
  to: WallpaperScene,
  t: number
): WallpaperScene {
  const k = clamp(t, 0, 1);
  const rgb = (a: RGB, b: RGB): RGB => lerpRgb(a, b, k);
  return {
    zenith: rgb(from.zenith, to.zenith),
    horizon: rgb(from.horizon, to.horizon),
    haze: rgb(from.haze, to.haze),
    sunColor: rgb(from.sunColor, to.sunColor),
    moonColor: rgb(from.moonColor, to.moonColor),
    cloudLit: rgb(from.cloudLit, to.cloudLit),
    cloudShadow: rgb(from.cloudShadow, to.cloudShadow),
    sunElevation: lerp(from.sunElevation, to.sunElevation, k),
    sunAzimuth: lerp(from.sunAzimuth, to.sunAzimuth, k),
    moonElevation: lerp(from.moonElevation, to.moonElevation, k),
    moonAzimuth: lerp(from.moonAzimuth, to.moonAzimuth, k),
    sunScale: lerp(from.sunScale, to.sunScale, k),
    moonScale: lerp(from.moonScale, to.moonScale, k),
    sunGlow: lerp(from.sunGlow, to.sunGlow, k),
    starOpacity: lerp(from.starOpacity, to.starOpacity, k),
    cloudCover: lerp(from.cloudCover, to.cloudCover, k),
    cloudSoftness: lerp(from.cloudSoftness, to.cloudSoftness, k),
    cloudDarkness: lerp(from.cloudDarkness, to.cloudDarkness, k),
    fogDensity: lerp(from.fogDensity, to.fogDensity, k),
    precipKind: k < 0.5 ? from.precipKind : to.precipKind,
    precipRate: lerp(from.precipRate, to.precipRate, k),
    wind: lerp(from.wind, to.wind, k),
    lightningRate: lerp(from.lightningRate, to.lightningRate, k),
    warmth: lerp(from.warmth, to.warmth, k),
    theme: k < 0.5 ? from.theme : to.theme,
  };
}

export function scenesRoughlyEqual(a: WallpaperScene, b: WallpaperScene): boolean {
  const near = (x: number, y: number, eps = 0.012) => Math.abs(x - y) < eps;
  const nearRgb = (x: RGB, y: RGB) =>
    near(x[0], y[0]) && near(x[1], y[1]) && near(x[2], y[2]);
  return (
    nearRgb(a.zenith, b.zenith) &&
    nearRgb(a.horizon, b.horizon) &&
    near(a.sunElevation, b.sunElevation) &&
    near(a.sunAzimuth, b.sunAzimuth) &&
    near(a.cloudCover, b.cloudCover) &&
    near(a.precipRate, b.precipRate) &&
    a.precipKind === b.precipKind &&
    near(a.fogDensity, b.fogDensity) &&
    near(a.starOpacity, b.starOpacity) &&
    a.theme === b.theme
  );
}

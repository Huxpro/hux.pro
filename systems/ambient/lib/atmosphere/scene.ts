import { themeKeyFor, type WeatherScene } from "../scene";
import type { AmbientPhase } from "../phase";
import type { NormalizedWeather, WeatherCondition } from "../weather";

export type Vec3 = [number, number, number];
export interface SkyScene {
  zenith: Vec3;
  horizon: Vec3;
  cloudLight: Vec3;
  cloudShade: Vec3;
  sun: [number, number];
  daylight: number;
  twilight: number;
  cloud: number;
  rain: number;
  snow: number;
  fog: number;
  storm: number;
  /** Screen-space drift: x across, y into the scene (away from the viewer). */
  wind: [number, number];
  moonPhase: number;
  /** Where the moon's disc is, uv with y down, like `sun`. */
  moon: [number, number];
  /** 0..1 how much of the moon there is to see, before anything in front of it. */
  moonVisible: number;
  /** Relative disc size: 1 high in the sky, larger near the horizon. */
  moonSize: number;
  /** 0..1 how dark the night is for stars, before anything in front of them. */
  stars: number;
  /** 0..1 how thick the cloud is for its cover: thin cirrus → dense stratus. */
  density: number;
  /** 0..1 how dark the cloud bases read. */
  darkness: number;
  /** +1 north (the moon waxes on the right), −1 south (mirrored). */
  hemisphere: number;
}

/** Cyclic or discrete: these jump to the new scene rather than easing to it. */
export const SNAPPED_KEYS = ["moonPhase", "hemisphere"] as const;
export const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const blend = (a: Vec3, b: Vec3, t: number): Vec3 => a.map((v, i) => mix(v, b[i], t)) as Vec3;
const rad = Math.PI / 180;

/** NOAA fractional-year solar approximation. Independent of host timezone,
 * including polar day/night. Accuracy is appropriate for ambient lighting. */
export function solarPosition(nowMs: number, lat: number, lon: number) {
  const date = new Date(nowMs);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const day = Math.floor((nowMs - yearStart) / 86400000) + 1;
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const daysInYear = (Date.UTC(date.getUTCFullYear() + 1, 0, 1) - yearStart) / 86400000;
  const gamma = 2 * Math.PI / daysInYear * (day - 1 + (hour - 12) / 24);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const solarMinutes = ((hour * 60 + equation + 4 * lon) % 1440 + 1440) % 1440;
  const angle = (solarMinutes / 4 - 180) * rad;
  const elevation = Math.asin(clamp(Math.sin(lat * rad) * Math.sin(decl) + Math.cos(lat * rad) * Math.cos(decl) * Math.cos(angle), -1, 1)) / rad;
  return { elevation, progress: solarMinutes / 1440 };
}

const defaults: Record<WeatherCondition, { cloud: number; rain: number; snow: number; fog: number }> = {
  clear: { cloud: 0.05, rain: 0, snow: 0, fog: 0 },
  cloudy: { cloud: 0.55, rain: 0, snow: 0, fog: 0 },
  fog: { cloud: 0.7, rain: 0, snow: 0, fog: 0.86 },
  rain: { cloud: 0.88, rain: 0.48, snow: 0, fog: 0.14 },
  snow: { cloud: 0.82, rain: 0, snow: 0.55, fog: 0.16 },
  thunder: { cloud: 1, rain: 0.85, snow: 0, fog: 0.2 },
};
const phaseSun: Record<AmbientPhase, [number, number]> = {
  sunrise: [2, 0.25], morning: [28, 0.36], afternoon: [48, 0.59],
  sunset: [1, 0.75], evening: [-8, 0.79], night: [-35, 0.92],
};

export function deriveSkyScene({ weather, nowMs, latitude, longitude, phase, condition, isDay, sunPosition }: {
  weather?: NormalizedWeather | null;
  nowMs: number;
  latitude?: number;
  longitude?: number;
  phase?: AmbientPhase;
  condition?: WeatherCondition;
  isDay?: boolean;
  sunPosition?: { elevation: number; progress: number };
}): SkyScene {
  const kind = condition ?? weather?.condition ?? "clear";
  const preset = defaults[kind];
  // A preview must not inherit live rain or cloud quantities from another condition.
  const live = condition ? undefined : weather;
  let solar = latitude !== undefined && longitude !== undefined
    ? solarPosition(nowMs, latitude, longitude)
    : solarPosition(nowMs, 35, -new Date(nowMs).getTimezoneOffset() / 4);
  if (phase) solar = { elevation: phaseSun[phase][0], progress: phaseSun[phase][1] };
  else if (isDay !== undefined) solar = { elevation: isDay ? 40 : -30, progress: isDay ? 0.4 : 0.9 };
  if (sunPosition) solar = sunPosition;
  const daylight = smooth(-7, 12, solar.elevation);
  const twilight = (1 - smooth(3, 20, Math.abs(solar.elevation))) * smooth(-13, -3, solar.elevation);
  const cloud = clamp(live?.cloudCover ?? preset.cloud);
  const storm = kind === "thunder" ? 1 : 0;
  const rain = kind === "rain" || kind === "thunder"
    ? live?.precipitationMmH !== undefined ? clamp(Math.sqrt(Math.max(0, live.precipitationMmH) / 8)) : preset.rain : 0;
  const snow = kind === "snow"
    ? live?.snowfallCmH !== undefined ? clamp(Math.sqrt(Math.max(0, live.snowfallCmH) / 1.5)) : preset.snow : 0;
  const fog = preset.fog;
  let zenith = blend([0.012, 0.022, 0.065], [0.11, 0.36, 0.66], daylight);
  let horizon = blend([0.055, 0.09, 0.16], [0.65, 0.81, 0.91], daylight);
  zenith = blend(zenith, [0.19, 0.27, 0.44], twilight * 0.65);
  horizon = blend(horizon, [0.98, 0.47, 0.23], twilight * 0.87);
  const overcast = smooth(0.55, 1, cloud) * (0.65 + storm * 0.25);
  zenith = blend(zenith, blend([0.025, 0.035, 0.055], [0.25, 0.32, 0.39], daylight), overcast);
  horizon = blend(horizon, blend([0.075, 0.095, 0.13], [0.64, 0.69, 0.72], daylight), overcast);
  const cloudLight = blend(blend([0.1, 0.13, 0.2], [0.95, 0.97, 0.98], daylight), [1, 0.65, 0.42], twilight * (1 - storm * 0.65));
  const cloudShade = blend(blend([0.017, 0.024, 0.043], [0.3, 0.4, 0.5], daylight), [0.095, 0.13, 0.19], storm * 0.65);
  const windSpeed = clamp(live?.windSpeedKmh ?? 12, 0, 100);
  const direction = (live?.windDirectionDeg ?? 250) * rad;
  const night = 1 - smooth(-7, 5, solar.elevation);
  return {
    zenith, horizon, cloudLight, cloudShade,
    sun: [mix(0.13, 0.87, clamp((solar.progress - 0.22) / 0.56)), 0.84 - clamp(solar.elevation / 90, -0.2, 1) * 0.8],
    daylight, twilight, cloud, rain, snow, fog, storm,
    wind: [-Math.sin(direction) * windSpeed / 50, Math.cos(direction) * windSpeed / 50],
    // Synodic phase, using the Jan 2000 new moon epoch. The moon is illustrative,
    // not an ephemeris of its position in the sky.
    moonPhase: ((nowMs / 86400000 - 10962.76) / 29.530588853 % 1 + 1) % 1,
    moon: [0.76, 0.2],
    moonVisible: night,
    moonSize: 1,
    stars: night,
    density: kind === "fog" ? 0.45 : 0.55 + storm * 0.35 + rain * 0.2,
    darkness: clamp(storm * 0.65 + rain * 0.35 + snow * 0.1),
    hemisphere: 1,
  };
}

export function sceneGradient(scene: SkyScene): string {
  const rgb = (v: Vec3) => `rgb(${v.map(c => Math.round(clamp(c) * 255)).join(" ")})`;
  return `linear-gradient(180deg, ${rgb(scene.zenith)}, ${rgb(scene.horizon)})`;
}

/** Adapt the shared live scene without changing Sky's weather, clock or overrides.
 * Atmosphere keeps its own lighting palette and volumetric cloud treatment, but
 * everything that is a measurement — where the sun and moon really are, how
 * dark the night is, what the cloud is made of, which way the air is going —
 * is the shared scene's, so the two engines never disagree about the weather.
 *
 * Stars and moon are taken from `behind`: the sky with nothing in front of it.
 * Sky dims them by the cover because its decks are pictures; here the cloud
 * volume and the mist occlude them physically, per pixel, so dimming them as
 * well would count the murk twice (and leave nothing for the fog wipe to find). */
export function toAtmosphereScene(scene: WeatherScene): SkyScene {
  const result = deriveSkyScene({
    nowMs: 0,
    weather: {
      condition: scene.condition, weatherCode: 0, temperatureC: 0, updatedAt: 0,
      cloudCover: scene.clouds.cover,
    },
    sunPosition: { elevation: scene.sun.elevation, progress: 0.5 },
  });
  // The stage looks toward the equator: south in the north, north in the
  // south. Wind blowing away from the viewer carries the deck into the scene.
  const into = -scene.windWorld.north * scene.hemisphere;
  // The theme's lightness over this palette, as the shared scene keys its own:
  // a night under the light theme is lifted, a day under the dark one pressed.
  const theme = themeKeyFor(scene.theme, scene.sun.elevation);
  const keyed = (c: Vec3) => [...theme.key(c)] as Vec3;
  return {
    ...result,
    zenith: keyed(result.zenith),
    horizon: keyed(result.horizon),
    cloudLight: keyed(result.cloudLight),
    cloudShade: keyed(result.cloudShade),
    sun: [scene.sun.screen.x, 1 - scene.sun.screen.y],
    moonPhase: scene.moon.phase,
    moon: [scene.moon.screen.x, 1 - scene.moon.screen.y],
    moonVisible: scene.behind.moon * theme.moon,
    moonSize: scene.moon.size,
    stars: scene.behind.stars,
    density: scene.clouds.density,
    darkness: scene.clouds.darkness,
    hemisphere: scene.hemisphere,
    rain: scene.precipitation.type === "rain" ? scene.precipitation.intensity : 0,
    snow: scene.precipitation.type === "snow" ? scene.precipitation.intensity : 0,
    fog: scene.fog,
    storm: scene.lightning,
    wind: [scene.wind.x, into],
  };
}

/** The same palette and theme veil used by the canvas, for widget placement. */
export function atmosphereGradient(scene: WeatherScene): string {
  const { color, amount } = scene.veil;
  const veil = `rgb(${color.map(c => Math.round(clamp(c) * 255)).join(" ")} / ${amount})`;
  return `linear-gradient(${veil}, ${veil}), ${sceneGradient(toAtmosphereScene(scene))}`;
}

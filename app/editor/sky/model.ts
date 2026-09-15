/**
 * Sky Engine Lab — the pure half.
 *
 * Sweep scales, observer presets, named scenarios, trajectory sampling, the
 * reference checks and the permalink codec. No React and no DOM, so the plots
 * and the panels all read the same numbers and the maths can be reasoned about
 * (and, where it has a published answer, checked) on its own.
 *
 * Nothing here re-implements the model: every trajectory comes from
 * `systems/ambient/lib/solar.ts` and every scene from `deriveWeatherScene`.
 * The lab is a consumer of the ambient system, never a fork of it.
 */

import {
  explainMoon,
  explainSun,
  getMoonPhase,
  getMoonTimes,
  getSunTimes,
  minutesOfDay,
  startOfLocalDay,
  type RiseSetTimes,
} from "@/systems/ambient/lib/solar";
import type { WeatherCondition } from "@/systems/ambient/lib/weather";

export const DAY_MS = 86_400_000;

// -----------------------------------------------------------------------------
// Time control — play at three scales
// -----------------------------------------------------------------------------

export type SweepScale = "day" | "month" | "year";

export interface ScaleSpec {
  label: string;
  /** What the scrubber counts. */
  unit: "minute" | "day";
  /** Window length, in `unit`s. */
  span: number;
  /** Units of model time per real second at speed ×1. */
  rate: number;
  /** One press of the step button, in `unit`s. */
  step: number;
  /** What the sweep is for, in one line. */
  hint: string;
}

/**
 * The three sweeps.
 *
 * A day runs continuously; a month and a year advance by whole days with the
 * clock held, which is what makes the moon's ~50-minutes-a-day march and the
 * sun's seasonal creep legible instead of a blur of sunrises.
 */
export const SCALES: Record<SweepScale, ScaleSpec> = {
  day: {
    label: "Day",
    unit: "minute",
    span: 1440,
    rate: 60, // 1 h of model time per second
    step: 10,
    hint: "00:00 → 24:00 · the sun's arc, twilight, the moon at today's phase",
  },
  month: {
    label: "Month",
    unit: "day",
    span: 30,
    rate: 2, // 2 days per second
    step: 1,
    hint: "30 days at a fixed clock · the moon ~50 min later each day",
  },
  year: {
    label: "Year",
    unit: "day",
    span: 365,
    rate: 7, // a week per second
    step: 1,
    hint: "365 days at a fixed clock · the analemma and day-length change",
  },
};

export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8] as const;

/**
 * The instant a sweep position names.
 *
 * `origin` is local midnight of the window's first day, `t` the position in the
 * scale's unit and `clockMinutes` the time of day a month/year sweep holds.
 * One function, so the scrubber, the play loop, the plots and the permalink can
 * never disagree about what "now" is — the lab's own one-clock guarantee.
 */
export function sweepInstant(
  scale: SweepScale,
  originMs: number,
  t: number,
  clockMinutes: number
): number {
  if (scale === "day") return originMs + t * 60_000;
  return startOfLocalDay(originMs + Math.round(t) * DAY_MS) + clockMinutes * 60_000;
}

/** The window a scale opens around an instant, as a local-midnight origin. */
export function sweepOrigin(scale: SweepScale, ms: number): number {
  const day = startOfLocalDay(ms);
  if (scale === "day") return day;
  // Month and year windows are centred on the day in view, so the instant the
  // scale changes is still somewhere sensible on the new scrubber.
  return startOfLocalDay(day - Math.floor(SCALES[scale].span / 2) * DAY_MS);
}

/** Where an instant sits on a scale's scrubber. */
export function sweepPosition(
  scale: SweepScale,
  originMs: number,
  ms: number
): number {
  if (scale === "day") return (ms - originMs) / 60_000;
  return Math.round((startOfLocalDay(ms) - originMs) / DAY_MS);
}

// -----------------------------------------------------------------------------
// Observer
// -----------------------------------------------------------------------------

export interface Observer {
  label: string;
  lat: number;
  lon: number;
}

/**
 * Places that show the model doing something different: both hemispheres, the
 * equator (where the sun goes straight up), and a latitude inside the Arctic
 * circle (where the rise/set solver has to return nothing at all).
 */
export const OBSERVER_PRESETS: Observer[] = [
  { label: "London", lat: 51.5074, lon: -0.1278 },
  { label: "New York", lat: 40.7128, lon: -74.006 },
  { label: "Shanghai", lat: 31.2304, lon: 121.4737 },
  { label: "Singapore", lat: 1.3521, lon: 103.8198 },
  { label: "Sydney", lat: -33.8688, lon: 151.2093 },
  { label: "Ushuaia", lat: -54.8019, lon: -68.303 },
  { label: "Tromsø", lat: 69.6492, lon: 18.9553 },
];

/** Mirror the observer across the equator — the fastest hemisphere check. */
export function flipHemisphere(o: Observer): Observer {
  return { label: `${o.label} (mirrored)`, lat: -o.lat, lon: o.lon };
}

// -----------------------------------------------------------------------------
// Named skies
// -----------------------------------------------------------------------------

export interface Scenario {
  id: string;
  label: string;
  description: string;
  condition: WeatherCondition | null;
  /** Resolve the instant this scenario wants, from the day currently in view. */
  instant: (fromMs: number, lat: number, lon: number) => number;
}

/** The day within ±45 whose phase is closest to `target` (0 new, 0.5 full). */
export function findPhaseDay(fromMs: number, target: number): number {
  const base = startOfLocalDay(fromMs) + 12 * 3_600_000;
  let best = base;
  let bestErr = Infinity;
  for (let d = -45; d <= 45; d++) {
    const ms = base + d * DAY_MS;
    const p = getMoonPhase(ms);
    const err = Math.min(Math.abs(p - target), 1 - Math.abs(p - target));
    if (err < bestErr) {
      bestErr = err;
      best = ms;
    }
  }
  return best;
}

/** Local midnight-ish of the day, at the moon's transit, so it is actually up. */
function moonHigh(dayMs: number, lat: number, lon: number): number {
  return getMoonTimes(dayMs, lat, lon).transit;
}

function sunsetish(dayMs: number, lat: number, lon: number): number {
  const times = getSunTimes(dayMs, lat, lon);
  return times.set ?? startOfLocalDay(dayMs) + 19 * 3_600_000;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "full-moon",
    label: "Full moon, clear",
    description: "The nearest full moon, at its transit — the night's lantern.",
    condition: "clear",
    instant: (ms, lat, lon) => moonHigh(findPhaseDay(ms, 0.5), lat, lon),
  },
  {
    id: "new-moon",
    label: "New moon, clear",
    description: "The nearest new moon at midnight — stars with nothing to wash them out.",
    condition: "clear",
    instant: (ms) => startOfLocalDay(findPhaseDay(ms, 0)) + 24 * 3_600_000,
  },
  {
    id: "day-moon",
    label: "Daytime moon",
    description: "A gibbous moon well up in an afternoon sky — the quiet daytime gate.",
    condition: "clear",
    instant: (ms, lat, lon) => moonHigh(findPhaseDay(ms, 0.35), lat, lon),
  },
  {
    id: "storm-dusk",
    label: "Thunderstorm at dusk",
    description: "Sunset under a storm — the tint at its heaviest against the last warmth.",
    condition: "thunder",
    instant: (ms, lat, lon) => sunsetish(ms, lat, lon),
  },
  {
    id: "blue-hour",
    label: "Blue hour",
    description: "Civil twilight: the keyframes between −6° and 0°, where the ramp is steepest.",
    condition: "clear",
    instant: (ms, lat, lon) => sunsetish(ms, lat, lon) + 18 * 60_000,
  },
  {
    id: "polar-night",
    label: "Noon in polar night",
    description: "Midday with the sun below the horizon — only meaningful far enough north.",
    condition: "snow",
    instant: (ms) => startOfLocalDay(ms) + 12 * 3_600_000,
  },
];

// -----------------------------------------------------------------------------
// Trajectories
// -----------------------------------------------------------------------------

export interface TrackPoint {
  ms: number;
  elevation: number;
  azimuth: number;
}

export type Body = "sun" | "moon";

export function positionOf(
  body: Body,
  ms: number,
  lat: number,
  lon: number
): TrackPoint {
  const p = body === "sun" ? explainSun(ms, lat, lon) : explainMoon(ms, lat, lon);
  return { ms, elevation: p.elevation, azimuth: p.azimuth };
}

/** A body's path across one local day. */
export function dayTrack(
  body: Body,
  dayMs: number,
  lat: number,
  lon: number,
  samples = 145
): TrackPoint[] {
  const start = startOfLocalDay(dayMs);
  const out: TrackPoint[] = [];
  for (let i = 0; i < samples; i++) {
    out.push(positionOf(body, start + (i / (samples - 1)) * DAY_MS, lat, lon));
  }
  return out;
}

/** Rise / set / transit for both bodies on the day in view. */
export interface DayEvents {
  sun: RiseSetTimes;
  moon: RiseSetTimes;
}

export function dayEvents(dayMs: number, lat: number, lon: number): DayEvents {
  return { sun: getSunTimes(dayMs, lat, lon), moon: getMoonTimes(dayMs, lat, lon) };
}

/**
 * The analemma: the sun at one clock time on every day of a year.
 *
 * The figure-eight is the equation of time plus the declination — the two
 * corrections a "the sun is at 15°/hour" model does not have, drawn.
 */
export function analemma(
  originMs: number,
  clockMinutes: number,
  lat: number,
  lon: number,
  days = 365
): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (let d = 0; d < days; d++) {
    const ms = startOfLocalDay(originMs + d * DAY_MS) + clockMinutes * 60_000;
    out.push(positionOf("sun", ms, lat, lon));
  }
  return out;
}

export interface MoonDay {
  ms: number;
  phase: number;
  illumination: number;
  /** Elevation at the fixed clock time… */
  elevation: number;
  /** …and at the moon's transit, which is what "how high does it get" means. */
  transitElevation: number;
  rise: number | null;
  set: number | null;
}

/** A month of moons: phase, altitude and rise/set, one entry per day. */
export function moonMonth(
  originMs: number,
  clockMinutes: number,
  lat: number,
  lon: number,
  days = 30
): MoonDay[] {
  const out: MoonDay[] = [];
  for (let d = 0; d < days; d++) {
    const dayMs = startOfLocalDay(originMs + d * DAY_MS);
    const ms = dayMs + clockMinutes * 60_000;
    const detail = explainMoon(ms, lat, lon);
    const times = getMoonTimes(dayMs, lat, lon);
    out.push({
      ms,
      phase: detail.phase,
      illumination: detail.illumination,
      elevation: detail.elevation,
      transitElevation: times.maxElevation,
      rise: times.rise,
      set: times.set,
    });
  }
  return out;
}

// -----------------------------------------------------------------------------
// Reference checks
//
// "~1° accuracy" is a claim in a comment until something measures it. These are
// four published constants, each recomputed from this repo's ephemeris at load:
// if a perturbation term is ever dropped or a sign flipped, a row goes red.
// They check the model against the literature, not against a snapshot of
// itself, so they keep their meaning when the model changes on purpose.
// -----------------------------------------------------------------------------

export interface ReferenceCheck {
  label: string;
  source: string;
  published: string;
  measured: string;
  error: string;
  ok: boolean;
}

const J2000 = Date.UTC(2000, 0, 1, 12);
/** Meeus, *Astronomical Algorithms*: lunation 0. */
const MEEUS_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC_MONTH_DAYS = 29.530589;

/** Signed angular distance from new moon, in degrees (−180 … +180). */
function fromNew(ms: number): number {
  const p = getMoonPhase(ms);
  return (p < 0.5 ? p : p - 1) * 360;
}

/** The first new moon at or after `fromMs`, to the minute. */
export function nextNewMoon(fromMs: number): number {
  const step = 3_600_000;
  let prevMs = fromMs;
  let prev = fromNew(prevMs);
  for (let i = 1; i <= 24 * 40; i++) {
    const ms = fromMs + i * step;
    const v = fromNew(ms);
    if (prev < 0 && v >= 0) {
      let lo = prevMs;
      let hi = ms;
      for (let k = 0; k < 24 && hi - lo > 1000; k++) {
        const mid = (lo + hi) / 2;
        if (fromNew(mid) < 0) lo = mid;
        else hi = mid;
      }
      return Math.round((lo + hi) / 2);
    }
    prevMs = ms;
    prev = v;
  }
  return fromMs;
}

/** Lunations averaged for the synodic-month row — see `referenceChecks`. */
const SYNODIC_SAMPLE = 99;
const MEAN_LUNAR_DISTANCE_KM = 384_400;

let cached: ReferenceCheck[] | null = null;

/**
 * The four rows, computed once per page load (~50 ms of ephemeris).
 *
 * The synodic mean is taken over 99 lunations rather than twelve: individual
 * lunations really do run from 29.36 to 29.70 days, and a single year's worth
 * of them starts and ends at the same point of that cycle, so a twelve-month
 * mean is biased by half an hour. Eight years of them averages the cycle out —
 * which is the difference between measuring the model and measuring the
 * calendar you happened to sample.
 */
export function referenceChecks(): ReferenceCheck[] {
  if (cached) return cached;

  // 1. A published new-moon instant, against the model's own.
  const modelled = nextNewMoon(MEEUS_NEW_MOON - 3 * DAY_MS);
  const minutesOff = (modelled - MEEUS_NEW_MOON) / 60_000;

  // 2. The synodic month.
  let cursor = nextNewMoon(J2000);
  const first = cursor;
  for (let i = 0; i < SYNODIC_SAMPLE; i++) cursor = nextNewMoon(cursor + 2 * DAY_MS);
  const synodic = (cursor - first) / SYNODIC_SAMPLE / DAY_MS;

  // 3. Obliquity: the sun's greatest declination over a year.
  let maxDec = 0;
  // 4. The moon's mean distance, sampled every six hours for a year.
  let distanceSum = 0;
  let distanceCount = 0;
  for (let d = 0; d < 366; d++) {
    const ms = J2000 + d * DAY_MS;
    maxDec = Math.max(maxDec, Math.abs(explainSun(ms, 0, 0).declination));
    for (let q = 0; q < 4; q++) {
      distanceSum += explainMoon(ms + q * 6 * 3_600_000, 0, 0).distanceKm;
      distanceCount++;
    }
  }
  const meanDistance = distanceSum / distanceCount;

  const signed = (v: number, digits: number, unit: string) =>
    `${v >= 0 ? "+" : "\u2212"}${Math.abs(v).toFixed(digits)}${unit}`;

  cached = [
    {
      label: "New moon, 2000-01-06",
      source: "Meeus, lunation 0",
      published: "18:14 UT",
      measured: new Date(modelled).toISOString().slice(11, 16) + " UT",
      error: signed(minutesOff, 0, " min"),
      ok: Math.abs(minutesOff) <= 180,
    },
    {
      label: `Synodic month (${SYNODIC_SAMPLE} lunations)`,
      source: "IAU mean value",
      published: `${SYNODIC_MONTH_DAYS.toFixed(6)} d`,
      measured: `${synodic.toFixed(6)} d`,
      error: signed(synodic - SYNODIC_MONTH_DAYS, 5, " d"),
      ok: Math.abs(synodic - SYNODIC_MONTH_DAYS) <= 0.01,
    },
    {
      label: "Obliquity of the ecliptic",
      source: "J2000.0 \u2014 peak solar declination",
      published: "23.4393\u00b0",
      measured: `${maxDec.toFixed(4)}\u00b0`,
      error: signed(maxDec - 23.4393, 4, "\u00b0"),
      ok: Math.abs(maxDec - 23.4393) <= 0.05,
    },
    {
      label: "Mean lunar distance",
      source: "IAU, centre to centre",
      published: `${MEAN_LUNAR_DISTANCE_KM.toLocaleString("en-GB")} km`,
      measured: `${Math.round(meanDistance).toLocaleString("en-GB")} km`,
      error: signed(meanDistance - MEAN_LUNAR_DISTANCE_KM, 0, " km"),
      ok: Math.abs(meanDistance - MEAN_LUNAR_DISTANCE_KM) <= 2000,
    },
  ];
  return cached;
}

// -----------------------------------------------------------------------------
// Permalink
// -----------------------------------------------------------------------------

export interface LabLink {
  t?: number;
  lat?: number;
  lon?: number;
  preset?: string;
  scale?: SweepScale;
}

export function buildPermalink(link: LabLink): string {
  const q = new URLSearchParams();
  if (link.t !== undefined) q.set("t", String(Math.round(link.t)));
  if (link.lat !== undefined) q.set("lat", link.lat.toFixed(4));
  if (link.lon !== undefined) q.set("lon", link.lon.toFixed(4));
  if (link.preset) q.set("preset", link.preset);
  if (link.scale) q.set("scale", link.scale);
  return `/editor/sky?${q.toString()}`;
}

export function readPermalink(search: string): LabLink {
  const q = new URLSearchParams(search);
  const numberOf = (key: string, min: number, max: number): number | undefined => {
    const raw = q.get(key);
    if (raw === null) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
  };
  const scale = q.get("scale");
  return {
    t: numberOf("t", 0, 4e12),
    lat: numberOf("lat", -90, 90),
    lon: numberOf("lon", -180, 180),
    preset: q.get("preset") ?? undefined,
    scale:
      scale === "day" || scale === "month" || scale === "year" ? scale : undefined,
  };
}

// -----------------------------------------------------------------------------
// Formatting
// -----------------------------------------------------------------------------

const clockFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
});
const stampFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export { minutesOfDay };

export const clock = (ms: number | null | undefined): string =>
  typeof ms === "number" && Number.isFinite(ms) ? clockFormat.format(ms) : "—";
export const date = (ms: number): string => dateFormat.format(ms);
export const stamp = (ms: number): string => stampFormat.format(ms);
export const deg = (v: number, digits = 1): string => `${v.toFixed(digits)}°`;
export const pct = (v: number, digits = 0): string => `${(v * 100).toFixed(digits)}%`;

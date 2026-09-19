// =============================================================================
// Solar + lunar geometry
//
// The wallpaper is *continuously* time-sensitive: instead of six discrete
// phases, the sky is lit by the real sun elevation/azimuth for the visitor's
// coordinates, so dawn brightens minute by minute and the sun glow tracks
// across the viewport through the day. This module is pure math (no DOM), so
// it can be shared by the shader renderer, the CSS fallback and the devtool.
//
// Solar position: the simplified NOAA / Astronomical Almanac algorithm
// (accurate to ~0.01°, more than enough for a wallpaper).
// =============================================================================

export interface SolarPosition {
  /** Degrees above the horizon (negative = below). */
  elevation: number;
  /** Degrees clockwise from north (0 = N, 90 = E, 180 = S, 270 = W). */
  azimuth: number;
}

const DEG = Math.PI / 180;
const rev = (deg: number) => ((deg % 360) + 360) % 360;
const J2000_MS = 946728000000; // 2000-01-01T12:00:00Z

function daysSinceJ2000(ms: number): number {
  return (ms - J2000_MS) / 86_400_000;
}

/** Sun elevation/azimuth for a timestamp and geographic coordinates. */
export function getSolarPosition(
  ms: number,
  lat: number,
  lon: number
): SolarPosition {
  const d = daysSinceJ2000(ms);
  const g = (357.529 + 0.98560028 * d) * DEG; // mean anomaly
  const q = 280.459 + 0.98564736 * d; // mean longitude (deg)
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG; // ecliptic lon
  const e = (23.439 - 0.00000036 * d) * DEG; // obliquity

  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));

  const h = equatorialToHorizontal(ms, lat, lon, ra, dec);
  return { elevation: h.elevationRad / DEG, azimuth: h.azimuth };
}

/**
 * Right ascension / declination (rad) → elevation / azimuth (deg) for an
 * observer, via the local sidereal time. Shared by the sun and the moon.
 */
function equatorialToHorizontal(
  ms: number,
  lat: number,
  lon: number,
  ra: number,
  dec: number
): { elevationRad: number; azimuth: number; latR: number; ha: number } {
  const gmstHours = 18.697374558 + 24.06570982441908 * daysSinceJ2000(ms);
  const lst = ((gmstHours % 24) + 24) % 24; // hours
  const ha = (lst * 15 + lon) * DEG - ra; // hour angle (rad)
  const latR = lat * DEG;
  const sinEl =
    Math.sin(latR) * Math.sin(dec) + Math.cos(latR) * Math.cos(dec) * Math.cos(ha);
  const elevationRad = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const az = Math.atan2(
    -Math.sin(ha),
    Math.tan(dec) * Math.cos(latR) - Math.sin(latR) * Math.cos(ha)
  );
  return { elevationRad, azimuth: rev(az / DEG), latR, ha };
}

/**
 * Fallback when coordinates are unknown: approximate the sun from the local
 * clock (or from sunrise/sunset timestamps when those are known). Returns a
 * plausible arc that peaks at solar noon so a first-paint sky still reads as
 * the right time of day.
 */
export function estimateSolarPosition(params: {
  nowMs: number;
  sunriseMs?: number;
  sunsetMs?: number;
}): SolarPosition {
  const { nowMs } = params;
  /** Peak elevation at solar noon (deg). */
  const peak = 55;
  const { sunrise, sunset } = sunTimesOrDefault(nowMs, params.sunriseMs, params.sunsetMs);

  const dayLen = Math.max(1, sunset - sunrise);
  const nightLen = Math.max(1, 86_400_000 - dayLen);

  if (nowMs >= sunrise && nowMs <= sunset) {
    const t = (nowMs - sunrise) / dayLen; // 0..1 across the day
    return {
      elevation: Math.sin(t * Math.PI) * peak,
      azimuth: 90 + t * 180, // E → S → W
    };
  }

  // Night: mirror the arc below the horizon (bounded so the sky can reach
  // full night).
  const sinceSunset =
    nowMs > sunset ? nowMs - sunset : nowMs - (sunset - 86_400_000);
  const t = clamp01(sinceSunset / nightLen);
  return {
    elevation: -Math.sin(t * Math.PI) * Math.min(peak, 40),
    azimuth: 270 + t * 180,
  };
}

// -----------------------------------------------------------------------------
// Moon
//
// Low-precision lunar ephemeris (Schlyter, "How to compute planetary
// positions"): geocentric ecliptic longitude/latitude with the main
// perturbation terms (~1° accuracy), converted to a topocentric horizontal
// position for the observer. Good enough that the moon rises, transits and
// sets at the right times and shows the right phase — which is what makes its
// wallpaper trajectory believable through a time-travel sweep.
// -----------------------------------------------------------------------------

/** Schlyter's day number: days since 1999-12-31 00:00 UT (= J2000 + 1.5). */
function schlyterDay(ms: number): number {
  return daysSinceJ2000(ms) + 1.5;
}

interface EclipticLunar {
  lonDeg: number;
  latDeg: number;
  /** Earth radii. */
  distance: number;
  /** Sun's geocentric ecliptic longitude (deg). */
  sunLonDeg: number;
}

function lunarEcliptic(ms: number): EclipticLunar {
  const d = schlyterDay(ms);

  // Sun (for perturbations and the phase).
  const ws = rev(282.9404 + 4.70935e-5 * d);
  const Ms = rev(356.047 + 0.9856002585 * d);
  const Ls = rev(ws + Ms);

  // Moon orbital elements.
  const N = rev(125.1228 - 0.0529538083 * d);
  const i = 5.1454;
  const w = rev(318.0634 + 0.1643573223 * d);
  const a = 60.2666;
  const e = 0.0549;
  const M = rev(115.3654 + 13.0649929509 * d);

  // Eccentric anomaly (Kepler, a few Newton steps).
  let E = M + (180 / Math.PI) * e * Math.sin(M * DEG) * (1 + e * Math.cos(M * DEG));
  for (let k = 0; k < 5; k++) {
    const dE =
      (E - (180 / Math.PI) * e * Math.sin(E * DEG) - M) / (1 - e * Math.cos(E * DEG));
    E -= dE;
    if (Math.abs(dE) < 1e-4) break;
  }

  const xv = a * (Math.cos(E * DEG) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E * DEG);
  const v = Math.atan2(yv, xv) / DEG;
  const r = Math.sqrt(xv * xv + yv * yv);

  const vw = (v + w) * DEG;
  const Nr = N * DEG;
  const ir = i * DEG;
  const xh = r * (Math.cos(Nr) * Math.cos(vw) - Math.sin(Nr) * Math.sin(vw) * Math.cos(ir));
  const yh = r * (Math.sin(Nr) * Math.cos(vw) + Math.cos(Nr) * Math.sin(vw) * Math.cos(ir));
  const zh = r * Math.sin(vw) * Math.sin(ir);

  let lon = Math.atan2(yh, xh) / DEG;
  let lat = Math.atan2(zh, Math.sqrt(xh * xh + yh * yh)) / DEG;

  // Perturbations (degrees).
  const Lm = rev(N + w + M);
  const D = Lm - Ls;
  const F = Lm - N;
  const s = (deg: number) => Math.sin(deg * DEG);
  lon +=
    -1.274 * s(M - 2 * D) +
    0.658 * s(2 * D) -
    0.186 * s(Ms) -
    0.059 * s(2 * M - 2 * D) -
    0.057 * s(M - 2 * D + Ms) +
    0.053 * s(M + 2 * D) +
    0.046 * s(2 * D - Ms) +
    0.041 * s(M - Ms) -
    0.035 * s(D) -
    0.031 * s(M + Ms) -
    0.015 * s(2 * F - 2 * D) +
    0.011 * s(M - 4 * D);
  lat +=
    -0.173 * s(F - 2 * D) -
    0.055 * s(M - F - 2 * D) -
    0.046 * s(M + F - 2 * D) +
    0.033 * s(F + 2 * D) +
    0.017 * s(2 * M + F);
  const distance = r - 0.58 * Math.cos(M * DEG - 2 * D * DEG) - 0.46 * Math.cos(2 * D * DEG);

  return { lonDeg: rev(lon), latDeg: lat, distance, sunLonDeg: Ls };
}

/** Moon phase in [0, 1): 0 = new, 0.5 = full (from the sun–moon elongation). */
export function getMoonPhase(ms: number): number {
  const { lonDeg, sunLonDeg } = lunarEcliptic(ms);
  return rev(lonDeg - sunLonDeg) / 360;
}

/** Illuminated fraction of the lunar disc, 0..1. */
export function getMoonIllumination(phase: number): number {
  return (1 - Math.cos(phase * 2 * Math.PI)) / 2;
}

/** Topocentric moon elevation/azimuth, plus the phase (from the same ephemeris). */
export function getLunarPosition(
  ms: number,
  lat: number,
  lon: number
): SolarPosition & { phase: number } {
  const ecl = lunarEcliptic(ms);
  const d = schlyterDay(ms);
  const obliquity = (23.4393 - 3.563e-7 * d) * DEG;

  const lo = ecl.lonDeg * DEG;
  const la = ecl.latDeg * DEG;
  const xe = Math.cos(lo) * Math.cos(la);
  const ye = Math.sin(lo) * Math.cos(la);
  const ze = Math.sin(la);
  const xq = xe;
  const yq = ye * Math.cos(obliquity) - ze * Math.sin(obliquity);
  const zq = ye * Math.sin(obliquity) + ze * Math.cos(obliquity);
  const ra = Math.atan2(yq, xq);
  const dec = Math.atan2(zq, Math.sqrt(xq * xq + yq * yq));

  const h = equatorialToHorizontal(ms, lat, lon, ra, dec);
  // Topocentric parallax (the moon is close enough for ~1°).
  const parallax = Math.asin(1 / ecl.distance);
  const elevation = h.elevationRad - parallax * Math.cos(h.elevationRad);

  return {
    elevation: elevation / DEG,
    azimuth: h.azimuth,
    phase: rev(ecl.lonDeg - ecl.sunLonDeg) / 360,
  };
}

export type MoonPhaseName =
  | "new"
  | "waxing-crescent"
  | "first-quarter"
  | "waxing-gibbous"
  | "full"
  | "waning-gibbous"
  | "last-quarter"
  | "waning-crescent";

/** Eight-way phase name for labels / icons. */
export function getMoonPhaseName(phase: number): MoonPhaseName {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.0325 || p >= 0.9675) return "new";
  if (p < 0.2175) return "waxing-crescent";
  if (p < 0.2825) return "first-quarter";
  if (p < 0.4675) return "waxing-gibbous";
  if (p < 0.5325) return "full";
  if (p < 0.7175) return "waning-gibbous";
  if (p < 0.7825) return "last-quarter";
  return "waning-crescent";
}

// -----------------------------------------------------------------------------
// Twilight helpers
// -----------------------------------------------------------------------------

/**
 * Normalised daylight factor from the sun elevation:
 *   0 → astronomical night (≤ -18°), 1 → full day (≥ +10°).
 * Twilight sits in between (civil at -6°, nautical at -12°).
 */
export function daylightFactor(elevationDeg: number): number {
  return clamp01((elevationDeg + 18) / 28);
}

/**
 * The sun elevation above which the scene counts as day: a hair below the
 * horizon, so the last of the sun disc still reads as daytime. One number,
 * read from `WeatherScene.sun.isDay`.
 */
export const DAY_ELEVATION_DEG = -0.5;

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Smoothstep helper shared by scene derivation. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// -----------------------------------------------------------------------------
// Clock helpers
// -----------------------------------------------------------------------------

/** Minutes in a day. The unit every clock helper here speaks in. */
export const DAY_MINUTES = 1440;

/** Fallback sun times, minutes past local midnight, when the forecast has none. */
export const DEFAULT_SUNRISE_MINUTES = 6 * 60 + 30;
export const DEFAULT_SUNSET_MINUTES = 18 * 60 + 30;

/** Minutes past local midnight of an instant, or the fallback when there is none. */
export function minutesOfDay(ms: number | undefined, fallback = 0): number {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return fallback;
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

/** Local midnight of the day containing `ms`. */
export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Sunrise / sunset for the day, or a plausible 06:30 / 18:30 when unknown, so
 * a first paint before the forecast arrives still reads as the right time.
 */
export function sunTimesOrDefault(
  nowMs: number,
  sunriseMs?: number,
  sunsetMs?: number
): { sunrise: number; sunset: number } {
  if (Number.isFinite(sunriseMs) && Number.isFinite(sunsetMs)) {
    return { sunrise: sunriseMs as number, sunset: sunsetMs as number };
  }
  const day = startOfLocalDay(nowMs);
  return { sunrise: day + 6.5 * 3_600_000, sunset: day + 18.5 * 3_600_000 };
}

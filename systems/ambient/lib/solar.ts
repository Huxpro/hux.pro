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

/** Every intermediate of the solar position, in the order it is computed. */
export interface SolarSteps extends SolarPosition {
  /** Days since J2000.0. */
  day: number;
  /** Mean anomaly, mean longitude and true ecliptic longitude (deg). */
  meanAnomaly: number;
  meanLongitude: number;
  eclipticLon: number;
  /** Obliquity of the ecliptic (deg). */
  obliquity: number;
  /** Right ascension and declination (deg). */
  rightAscension: number;
  declination: number;
  /** Greenwich and local sidereal time (hours) and the hour angle (deg). */
  gmstHours: number;
  lstHours: number;
  hourAngle: number;
}

/**
 * The solar position with its working shown — ecliptic → equatorial →
 * horizontal, one field per step. `getSolarPosition` is this without the
 * bookkeeping, so the lab's readouts can never drift from what the sky paints.
 */
export function explainSun(ms: number, lat: number, lon: number): SolarSteps {
  const d = daysSinceJ2000(ms);
  const g = (357.529 + 0.98560028 * d) * DEG; // mean anomaly
  const q = 280.459 + 0.98564736 * d; // mean longitude (deg)
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG; // ecliptic lon
  const e = (23.439 - 0.00000036 * d) * DEG; // obliquity

  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));

  const h = equatorialToHorizontal(ms, lat, lon, ra, dec);
  return {
    elevation: h.elevationRad / DEG,
    azimuth: h.azimuth,
    day: d,
    meanAnomaly: rev(g / DEG),
    meanLongitude: rev(q),
    eclipticLon: rev(L / DEG),
    obliquity: e / DEG,
    rightAscension: rev(ra / DEG),
    declination: dec / DEG,
    gmstHours: h.gmstHours,
    lstHours: h.lstHours,
    hourAngle: rev(h.ha / DEG),
  };
}

/** Sun elevation/azimuth for a timestamp and geographic coordinates. */
export function getSolarPosition(
  ms: number,
  lat: number,
  lon: number
): SolarPosition {
  const { elevation, azimuth } = explainSun(ms, lat, lon);
  return { elevation, azimuth };
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
): {
  elevationRad: number;
  azimuth: number;
  latR: number;
  ha: number;
  gmstHours: number;
  lstHours: number;
} {
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
  return {
    elevationRad,
    azimuth: rev(az / DEG),
    latR,
    ha,
    gmstHours: ((gmstHours % 24) + 24) % 24,
    lstHours: ((lst + lon / 15) % 24 + 24) % 24,
  };
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
  /**
   * The working — Schlyter's day number, the orbital elements, the anomalies
   * and the pre-perturbation ecliptic position. Computed on the way through
   * anyway; kept so the Sky Engine Lab can show the pipeline step by step
   * instead of only its answer.
   */
  steps: LunarElements;
}

/** Every intermediate of the lunar ephemeris, in the order it is computed. */
export interface LunarElements {
  /** Days since 1999-12-31 00:00 UT. */
  day: number;
  /** Ascending node, inclination, argument of perigee (deg). */
  node: number;
  inclination: number;
  perigee: number;
  /** Mean distance (Earth radii) and eccentricity. */
  semiMajor: number;
  eccentricity: number;
  /** Mean, eccentric and true anomaly (deg). */
  meanAnomaly: number;
  eccentricAnomaly: number;
  trueAnomaly: number;
  /** Unperturbed distance, Earth radii. */
  radius: number;
  /** Mean longitude, mean elongation from the sun, argument of latitude (deg). */
  moonLongitude: number;
  elongationD: number;
  argumentF: number;
  /** Ecliptic position before the perturbation terms (deg). */
  rawLonDeg: number;
  rawLatDeg: number;
  /** What the perturbation terms added (deg). */
  lonPerturbation: number;
  latPerturbation: number;
  /** Sun's mean anomaly (deg). */
  sunMeanAnomaly: number;
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

  const rawLon = Math.atan2(yh, xh) / DEG;
  const rawLat = Math.atan2(zh, Math.sqrt(xh * xh + yh * yh)) / DEG;
  let lon = rawLon;
  let lat = rawLat;

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

  return {
    lonDeg: rev(lon),
    latDeg: lat,
    distance,
    sunLonDeg: Ls,
    steps: {
      day: d,
      node: N,
      inclination: i,
      perigee: w,
      semiMajor: a,
      eccentricity: e,
      meanAnomaly: M,
      eccentricAnomaly: E,
      trueAnomaly: v,
      radius: r,
      moonLongitude: Lm,
      elongationD: rev(D),
      argumentF: rev(F),
      rawLonDeg: rev(rawLon),
      rawLatDeg: rawLat,
      lonPerturbation: lon - rawLon,
      latPerturbation: lat - rawLat,
      sunMeanAnomaly: Ms,
    },
  };
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

/** The lunar position with every step of the conversion kept. */
export interface LunarDetail extends SolarPosition {
  phase: number;
  /** Illuminated fraction, 0..1, and the sun–moon elongation (deg). */
  illumination: number;
  elongation: number;
  /** Geocentric ecliptic position (deg) and distance (Earth radii). */
  eclipticLon: number;
  eclipticLat: number;
  distance: number;
  /** …and in kilometres, for a readout that means something. */
  distanceKm: number;
  /** Sun's geocentric ecliptic longitude (deg) — the other half of the phase. */
  sunEclipticLon: number;
  obliquity: number;
  rightAscension: number;
  declination: number;
  gmstHours: number;
  lstHours: number;
  hourAngle: number;
  /** Elevation before the parallax correction (deg)… */
  geocentricElevation: number;
  /** …and what the correction took off (deg). */
  parallax: number;
  /** The ephemeris' working (orbital elements, anomalies, perturbations). */
  ephemeris: LunarElements;
}

/** Mean Earth radius, km — turns the ephemeris' Earth radii into a distance. */
const EARTH_RADIUS_KM = 6371;

/**
 * Topocentric moon position with its working shown.
 *
 * `getLunarPosition` is this without the bookkeeping; both go through the same
 * ecliptic → equatorial → horizontal → parallax path, so the lab's readouts
 * are the numbers the wallpaper actually used.
 */
export function explainMoon(ms: number, lat: number, lon: number): LunarDetail {
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
  const correction = parallax * Math.cos(h.elevationRad);
  const elevation = h.elevationRad - correction;
  const phase = rev(ecl.lonDeg - ecl.sunLonDeg) / 360;

  return {
    elevation: elevation / DEG,
    azimuth: h.azimuth,
    phase,
    illumination: getMoonIllumination(phase),
    elongation: 180 - Math.abs(rev(ecl.lonDeg - ecl.sunLonDeg) - 180),
    eclipticLon: ecl.lonDeg,
    eclipticLat: ecl.latDeg,
    distance: ecl.distance,
    distanceKm: ecl.distance * EARTH_RADIUS_KM,
    sunEclipticLon: ecl.sunLonDeg,
    obliquity: obliquity / DEG,
    rightAscension: rev(ra / DEG),
    declination: dec / DEG,
    gmstHours: h.gmstHours,
    lstHours: h.lstHours,
    hourAngle: rev(h.ha / DEG),
    geocentricElevation: h.elevationRad / DEG,
    parallax: correction / DEG,
    ephemeris: ecl.steps,
  };
}

/** Topocentric moon elevation/azimuth, plus the phase (from the same ephemeris). */
export function getLunarPosition(
  ms: number,
  lat: number,
  lon: number
): SolarPosition & { phase: number } {
  const { elevation, azimuth, phase } = explainMoon(ms, lat, lon);
  return { elevation, azimuth, phase };
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
export function daylightFactor(
  elevationDeg: number,
  floorDeg = -18,
  ceilDeg = 10
): number {
  const span = ceilDeg - floorDeg;
  if (span <= 0) return elevationDeg >= ceilDeg ? 1 : 0;
  return clamp01((elevationDeg - floorDeg) / span);
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

// -----------------------------------------------------------------------------
// Rise / set for any day
//
// Open-Meteo gives sunrise and sunset for *today* only. Anything that moves the
// calendar — the devtool's day offset, the Sky Engine Lab's month and year
// sweeps — needs them for an arbitrary date, so it solves them locally from the
// same ephemeris that draws the sky. One solver serves the sun and the moon:
// scan the local day for a horizon crossing, then bisect it to the second.
// -----------------------------------------------------------------------------

export interface RiseSetTimes {
  /** Timestamps, or null when the body does not cross the horizon that day. */
  rise: number | null;
  set: number | null;
  /** Upper transit: the highest point of the day, always defined. */
  transit: number;
  maxElevation: number;
  minElevation: number;
  /** Midnight sun / polar night — the reason a rise or set can be null. */
  alwaysUp: boolean;
  alwaysDown: boolean;
}

/**
 * Apparent altitude of the sun's upper limb at rise/set: −34′ of refraction
 * plus its 16′ semidiameter. The conventional value.
 */
export const SUN_HORIZON_DEG = -0.833;
/**
 * The moon's, with its ~57′ horizontal parallax folded in the other way.
 * `getLunarPosition` already returns a topocentric altitude, so the crossing
 * sits a little *above* the geometric horizon.
 */
export const MOON_HORIZON_DEG = 0.125;

/** Samples per day when scanning for a crossing: one every four minutes. */
const SCAN_STEPS = 360;

function riseSet(
  dayMs: number,
  elevationAt: (ms: number) => number,
  horizonDeg: number
): RiseSetTimes {
  const start = startOfLocalDay(dayMs);
  const step = 86_400_000 / SCAN_STEPS;

  let rise: number | null = null;
  let set: number | null = null;
  let transit = start;

  let prevMs = start;
  const first = elevationAt(prevMs);
  let prev = first - horizonDeg;
  let maxElevation = first;
  let minElevation = first;

  /** Bisect a bracketed crossing down to the second. */
  const refine = (aMs: number, aValue: number, bMs: number): number => {
    let lo = aMs;
    let loValue = aValue;
    let hi = bMs;
    for (let i = 0; i < 24 && hi - lo > 500; i++) {
      const mid = (lo + hi) / 2;
      const v = elevationAt(mid) - horizonDeg;
      if (v === 0) return Math.round(mid);
      if (v > 0 === loValue > 0) {
        lo = mid;
        loValue = v;
      } else {
        hi = mid;
      }
    }
    return Math.round((lo + hi) / 2);
  };

  for (let i = 1; i <= SCAN_STEPS; i++) {
    const ms = start + i * step;
    const el = elevationAt(ms);
    if (el > maxElevation) {
      maxElevation = el;
      transit = ms;
    }
    if (el < minElevation) minElevation = el;
    const v = el - horizonDeg;
    if (prev <= 0 && v > 0 && rise === null) rise = refine(prevMs, prev, ms);
    if (prev >= 0 && v < 0 && set === null) set = refine(prevMs, prev, ms);
    prevMs = ms;
    prev = v;
  }

  return {
    rise,
    set,
    transit,
    maxElevation,
    minElevation,
    alwaysUp: rise === null && set === null && minElevation > horizonDeg,
    alwaysDown: rise === null && set === null && maxElevation < horizonDeg,
  };
}

/** Sunrise / sunset / solar noon for the local day containing `dayMs`. */
export function getSunTimes(dayMs: number, lat: number, lon: number): RiseSetTimes {
  return riseSet(dayMs, (ms) => getSolarPosition(ms, lat, lon).elevation, SUN_HORIZON_DEG);
}

/** Moonrise / moonset / transit for the local day containing `dayMs`. */
export function getMoonTimes(dayMs: number, lat: number, lon: number): RiseSetTimes {
  return riseSet(dayMs, (ms) => getLunarPosition(ms, lat, lon).elevation, MOON_HORIZON_DEG);
}

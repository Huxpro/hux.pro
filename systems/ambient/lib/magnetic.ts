// =============================================================================
// Magnetic declination — how far magnetic north is from true north, here.
//
// Every compass a browser hands over is magnetic. Chrome's
// `deviceorientationabsolute` (and Firefox's `absolute: true`) is Android's
// rotation vector, whose north is magnetic; WebKit's `webkitCompassHeading` is
// CoreLocation's `magneticHeading` (WebCoreMotionManager.mm). The sky is not:
// the sun and the moon are placed against true north. The gap is the
// declination, and it is not "a few degrees": about +13° in San Francisco and
// Sydney, −13° in New York, −7° in Beijing, and it drifts year by year. Without
// it the sky window turned true to north for the wrong north, and a moon a
// window's width off was a correct ephemeris behind a wrong compass.
//
// This is the World Magnetic Model, WMM2025 (NOAA NCEI / British Geological
// Survey, public domain): a degree-12 spherical-harmonic model of the main
// field with a linear secular variation, valid 2025.0–2030.0. The coefficients
// below are WMM.COF as published, verbatim. Checked against the model's own
// published test values (WMM2025_TestValues.txt) to their printed precision.
// Local anomalies — a steel desk, a car — are not in any global model; that is
// the compass's own error, and nothing here removes it.
// =============================================================================

const DEG = Math.PI / 180;

/** The model's epoch, and the span it is valid for (decimal years). */
const EPOCH = 2025.0;
const VALID_UNTIL = 2030.0;
/** Geomagnetic reference radius, km. */
const REF_RADIUS = 6371.2;
/** WGS-84. */
const WGS84_A = 6378.137;
const WGS84_E2 = (1 / 298.257223563) * (2 - 1 / 298.257223563);
const MAX_DEGREE = 12;

/** n, m, g, h (nT), ġ, ḣ (nT/yr) — WMM2025.COF. */
// prettier-ignore
const COEFFICIENTS = [
  1, 0, -29351.8, 0.0, 12.0, 0.0,
  1, 1, -1410.8, 4545.4, 9.7, -21.5,
  2, 0, -2556.6, 0.0, -11.6, 0.0,
  2, 1, 2951.1, -3133.6, -5.2, -27.7,
  2, 2, 1649.3, -815.1, -8.0, -12.1,
  3, 0, 1361.0, 0.0, -1.3, 0.0,
  3, 1, -2404.1, -56.6, -4.2, 4.0,
  3, 2, 1243.8, 237.5, 0.4, -0.3,
  3, 3, 453.6, -549.5, -15.6, -4.1,
  4, 0, 895.0, 0.0, -1.6, 0.0,
  4, 1, 799.5, 278.6, -2.4, -1.1,
  4, 2, 55.7, -133.9, -6.0, 4.1,
  4, 3, -281.1, 212.0, 5.6, 1.6,
  4, 4, 12.1, -375.6, -7.0, -4.4,
  5, 0, -233.2, 0.0, 0.6, 0.0,
  5, 1, 368.9, 45.4, 1.4, -0.5,
  5, 2, 187.2, 220.2, 0.0, 2.2,
  5, 3, -138.7, -122.9, 0.6, 0.4,
  5, 4, -142.0, 43.0, 2.2, 1.7,
  5, 5, 20.9, 106.1, 0.9, 1.9,
  6, 0, 64.4, 0.0, -0.2, 0.0,
  6, 1, 63.8, -18.4, -0.4, 0.3,
  6, 2, 76.9, 16.8, 0.9, -1.6,
  6, 3, -115.7, 48.8, 1.2, -0.4,
  6, 4, -40.9, -59.8, -0.9, 0.9,
  6, 5, 14.9, 10.9, 0.3, 0.7,
  6, 6, -60.7, 72.7, 0.9, 0.9,
  7, 0, 79.5, 0.0, -0.0, 0.0,
  7, 1, -77.0, -48.9, -0.1, 0.6,
  7, 2, -8.8, -14.4, -0.1, 0.5,
  7, 3, 59.3, -1.0, 0.5, -0.8,
  7, 4, 15.8, 23.4, -0.1, 0.0,
  7, 5, 2.5, -7.4, -0.8, -1.0,
  7, 6, -11.1, -25.1, -0.8, 0.6,
  7, 7, 14.2, -2.3, 0.8, -0.2,
  8, 0, 23.2, 0.0, -0.1, 0.0,
  8, 1, 10.8, 7.1, 0.2, -0.2,
  8, 2, -17.5, -12.6, 0.0, 0.5,
  8, 3, 2.0, 11.4, 0.5, -0.4,
  8, 4, -21.7, -9.7, -0.1, 0.4,
  8, 5, 16.9, 12.7, 0.3, -0.5,
  8, 6, 15.0, 0.7, 0.2, -0.6,
  8, 7, -16.8, -5.2, -0.0, 0.3,
  8, 8, 0.9, 3.9, 0.2, 0.2,
  9, 0, 4.6, 0.0, -0.0, 0.0,
  9, 1, 7.8, -24.8, -0.1, -0.3,
  9, 2, 3.0, 12.2, 0.1, 0.3,
  9, 3, -0.2, 8.3, 0.3, -0.3,
  9, 4, -2.5, -3.3, -0.3, 0.3,
  9, 5, -13.1, -5.2, 0.0, 0.2,
  9, 6, 2.4, 7.2, 0.3, -0.1,
  9, 7, 8.6, -0.6, -0.1, -0.2,
  9, 8, -8.7, 0.8, 0.1, 0.4,
  9, 9, -12.9, 10.0, -0.1, 0.1,
  10, 0, -1.3, 0.0, 0.1, 0.0,
  10, 1, -6.4, 3.3, 0.0, 0.0,
  10, 2, 0.2, 0.0, 0.1, -0.0,
  10, 3, 2.0, 2.4, 0.1, -0.2,
  10, 4, -1.0, 5.3, -0.0, 0.1,
  10, 5, -0.6, -9.1, -0.3, -0.1,
  10, 6, -0.9, 0.4, 0.0, 0.1,
  10, 7, 1.5, -4.2, -0.1, 0.0,
  10, 8, 0.9, -3.8, -0.1, -0.1,
  10, 9, -2.7, 0.9, -0.0, 0.2,
  10, 10, -3.9, -9.1, -0.0, -0.0,
  11, 0, 2.9, 0.0, 0.0, 0.0,
  11, 1, -1.5, 0.0, -0.0, -0.0,
  11, 2, -2.5, 2.9, 0.0, 0.1,
  11, 3, 2.4, -0.6, 0.0, -0.0,
  11, 4, -0.6, 0.2, 0.0, 0.1,
  11, 5, -0.1, 0.5, -0.1, -0.0,
  11, 6, -0.6, -0.3, 0.0, -0.0,
  11, 7, -0.1, -1.2, -0.0, 0.1,
  11, 8, 1.1, -1.7, -0.1, -0.0,
  11, 9, -1.0, -2.9, -0.1, 0.0,
  11, 10, -0.2, -1.8, -0.1, 0.0,
  11, 11, 2.6, -2.3, -0.1, 0.0,
  12, 0, -2.0, 0.0, 0.0, 0.0,
  12, 1, -0.2, -1.3, 0.0, -0.0,
  12, 2, 0.3, 0.7, -0.0, 0.0,
  12, 3, 1.2, 1.0, -0.0, -0.1,
  12, 4, -1.3, -1.4, -0.0, 0.1,
  12, 5, 0.6, -0.0, -0.0, -0.0,
  12, 6, 0.6, 0.6, 0.1, -0.0,
  12, 7, 0.5, -0.1, -0.0, -0.0,
  12, 8, -0.1, 0.8, 0.0, 0.0,
  12, 9, -0.4, 0.1, 0.0, -0.0,
  12, 10, -0.2, -1.0, -0.1, -0.0,
  12, 11, -1.3, 0.1, -0.0, 0.0,
  12, 12, -0.7, 0.2, -0.1, -0.1,
];

/** Schmidt semi-normalisation factors, √((2 − δₘ₀)(n − m)!/(n + m)!), [n][m]. */
const SCHMIDT: number[][] = (() => {
  const fact = [1];
  for (let i = 1; i <= 2 * MAX_DEGREE; i++) fact[i] = fact[i - 1] * i;
  const out: number[][] = [];
  for (let n = 0; n <= MAX_DEGREE; n++) {
    out[n] = [];
    for (let m = 0; m <= n; m++) {
      out[n][m] = Math.sqrt(((m === 0 ? 1 : 2) * fact[n - m]) / fact[n + m]);
    }
  }
  return out;
})();

/** Decimal year of a timestamp. */
function decimalYear(ms: number): number {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  return y + (ms - start) / (Date.UTC(y + 1, 0, 1) - start);
}

/**
 * The declination at a place and time, degrees east of true north (positive:
 * magnetic north lies east of true north). At `altKm` above the ellipsoid —
 * sea level unless given; a few km changes it by hundredths. Outside the model's
 * span the field is held at its nearest end rather than extrapolated — a
 * devtool clock years away is still given a sensible north.
 */
export function magneticDeclination(
  latDeg: number,
  lonDeg: number,
  ms: number,
  altKm = 0
): number {
  const t = Math.min(VALID_UNTIL, Math.max(EPOCH, decimalYear(ms))) - EPOCH;

  // Geodetic → geocentric spherical. The poles are held just off
  // the axis, where the east component divides by cos φ′.
  const lat = Math.max(-89.999, Math.min(89.999, latDeg)) * DEG;
  const lon = lonDeg * DEG;
  const sinLat = Math.sin(lat);
  const rc = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const p = (rc + altKm) * Math.cos(lat);
  const z = (rc * (1 - WGS84_E2) + altKm) * sinLat;
  const r = Math.hypot(p, z);
  const latC = Math.asin(z / r);
  const x = Math.sin(latC);
  const s = Math.cos(latC);

  // Associated Legendre functions P[n][m](sin φ′), unnormalised and without
  // the Condon–Shortley phase, and their derivatives in φ′.
  const P: number[][] = [];
  const dP: number[][] = [];
  for (let n = 0; n <= MAX_DEGREE; n++) {
    P[n] = new Array(n + 1).fill(0);
    dP[n] = new Array(n + 1).fill(0);
  }
  P[0][0] = 1;
  for (let m = 0; m <= MAX_DEGREE; m++) {
    if (m > 0) P[m][m] = (2 * m - 1) * s * P[m - 1][m - 1];
    if (m < MAX_DEGREE) P[m + 1][m] = (2 * m + 1) * x * P[m][m];
    for (let n = m + 2; n <= MAX_DEGREE; n++) {
      P[n][m] = ((2 * n - 1) * x * P[n - 1][m] - (n + m - 1) * P[n - 2][m]) / (n - m);
    }
  }
  for (let n = 1; n <= MAX_DEGREE; n++) {
    for (let m = 0; m <= n; m++) {
      // (1 − x²) dP/dx = (n + m) P[n−1][m] − n x P[n][m], and dφ′ = dx / cos φ′.
      const prev = m <= n - 1 ? P[n - 1][m] : 0;
      dP[n][m] = ((n + m) * prev - n * x * P[n][m]) / s;
    }
  }

  // The field: north (X′), east (Y′) and down (Z′) in geocentric coordinates.
  let bx = 0;
  let by = 0;
  let bz = 0;
  for (let i = 0; i < COEFFICIENTS.length; i += 6) {
    const n = COEFFICIENTS[i];
    const m = COEFFICIENTS[i + 1];
    const g = COEFFICIENTS[i + 2] + t * COEFFICIENTS[i + 4];
    const h = COEFFICIENTS[i + 3] + t * COEFFICIENTS[i + 5];
    const k = SCHMIDT[n][m];
    const ratio = Math.pow(REF_RADIUS / r, n + 2);
    const cm = Math.cos(m * lon);
    const sm = Math.sin(m * lon);
    const gh = g * cm + h * sm;
    bx -= ratio * gh * k * dP[n][m];
    by += ratio * m * (g * sm - h * cm) * k * P[n][m];
    bz -= ratio * (n + 1) * gh * k * P[n][m];
  }
  by /= s;

  // Back to geodetic north and east (east is unchanged by the tilt).
  const psi = latC - lat;
  const north = bx * Math.cos(psi) - bz * Math.sin(psi);
  return Math.atan2(by, north) / DEG;
}

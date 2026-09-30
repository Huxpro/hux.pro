// =============================================================================
// The loading indicator's shapes — M3 Expressive's `LoadingIndicator`.
//
// Compose's indicator cycles through seven Material shapes (SoftBurst,
// Cookie9Sided, Pentagon, Pill, Sunny, Cookie4Sided, Oval), morphing from each
// to the next every 650ms while the whole thing turns. A morph needs two paths
// with the same commands, so every shape here is sampled the same way: its
// outline as a radius per angle, read at the same angles, joined by a smooth
// (Catmull–Rom) curve. Two shapes then differ only in their numbers, and SVG
// can interpolate one into the other — no library, no per-frame script.
//
// Each outline is scaled to the same area, so the morph changes the shape and
// not the weight: the indicator never seems to breathe.
// =============================================================================

const SAMPLES = 72;
const TAU = Math.PI * 2;

type Radius = (theta: number) => number;

/** Round lobes, `n` of them, `depth` deep (a cookie, a sun, a burst). */
const lobes =
  (n: number, depth: number, sharpness = 1): Radius =>
  (t) =>
    1 - depth * (1 - Math.pow((1 + Math.cos(n * t)) / 2, sharpness));

/** A regular polygon with softened corners (`k` < 1 rounds them). */
const polygon =
  (n: number, k: number): Radius =>
  (t) => {
    const seg = TAU / n;
    // Corner at the top, as Compose draws a pentagon.
    const a = ((((t + Math.PI / 2) % seg) + seg) % seg) - seg / 2;
    return Math.pow(Math.cos(Math.PI / n) / Math.cos(a), k);
  };

/** A superellipse `a` wide and `b` tall, turned by `turn` radians. */
const superellipse =
  (a: number, b: number, p: number, turn = 0): Radius =>
  (t) => {
    const u = t - turn;
    return Math.pow(
      Math.pow(Math.abs(Math.cos(u) / a), p) + Math.pow(Math.abs(Math.sin(u) / b), p),
      -1 / p,
    );
  };

/** Compose's `LoadingIndicatorDefaults.IndeterminateIndicatorPolygons`. */
const SEQUENCE: Radius[] = [
  lobes(10, 0.22, 1.4), // SoftBurst
  lobes(9, 0.14), // Cookie9Sided
  polygon(5, 0.55), // Pentagon
  superellipse(1, 0.6, 3.2, Math.PI / 4), // Pill, on the diagonal
  lobes(8, 0.12), // Sunny
  lobes(4, 0.2, 0.9), // Cookie4Sided
  superellipse(1, 0.72, 2, -Math.PI / 4), // Oval
];

function outline(radius: Radius): [number, number][] {
  const rs = Array.from({ length: SAMPLES }, (_, i) =>
    radius(-Math.PI / 2 + (i / SAMPLES) * TAU),
  );
  // Equal area: scale so the mean squared radius is 1.
  const k = 1 / Math.sqrt(rs.reduce((s, r) => s + r * r, 0) / SAMPLES);
  return rs.map((r, i) => {
    const t = -Math.PI / 2 + (i / SAMPLES) * TAU;
    return [r * k * Math.cos(t), r * k * Math.sin(t)];
  });
}

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();

/** A closed Catmull–Rom spline through the points, as cubic Béziers. */
function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(
      p2[0] - (p3[0] - p1[0]) / 6,
    )} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

/** The seven outlines, in the unit circle's area, centred on the origin. */
export const LOADING_SHAPES: readonly string[] = SEQUENCE.map((r) =>
  smoothPath(outline(r)),
);

/** Compose: a new shape every 650ms; a full turn of the whole every 4666ms. */
export const MORPH_INTERVAL_MS = 650;
export const GLOBAL_ROTATION_MS = 4666;

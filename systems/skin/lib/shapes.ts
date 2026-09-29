// =============================================================================
// Expressive shapes — Material 3 Expressive's shape library, as SVG paths.
//
// Compose builds these with `RoundedPolygon.star(numVerticesPerRadius,
// innerRadius, rounding)` (androidx MaterialShapes.kt). A star is n outer
// vertices on the unit circle alternating with n inner ones at
// `innerRadius`; every corner is rounded by `rounding` (a fraction of the
// radius). Here each corner is a quadratic curve through the vertex, cut
// back along both edges where a circle of that radius would touch them,
// clamped to half an edge so neighbouring corners meet — the curve Compose draws is a circular arc
// plus a smoothing blend, but at widget sizes the two are indistinguishable,
// and this one is a single path string the browser can scale for free.
//
// Paths are in a 100×100 box, centred, so they can sit in an SVG `viewBox`
// or be used as a CSS `mask` / `clip-path: path()` at any size.
// =============================================================================

export interface StarSpec {
  /** Outer vertices (the star's points). */
  points: number;
  /** Inner radius as a fraction of the outer one. */
  inner: number;
  /** Corner rounding as a fraction of the radius. */
  rounding: number;
  /** Rotation, degrees (Compose's `rotation`). */
  rotate?: number;
}

/** The shapes the site uses, with Compose's own parameters. */
export const SHAPES = {
  /** `Sunny`: star(8, 0.8, cornerRound15). */
  sunny: { points: 8, inner: 0.8, rounding: 0.15 },
  /** `Cookie9Sided`: star(9, 0.8, cornerRound50), rotated −90°. */
  cookie9: { points: 9, inner: 0.8, rounding: 0.5, rotate: -90 },
  /** `Cookie12Sided`: star(12, 0.8, cornerRound50), rotated −90°. */
  cookie12: { points: 12, inner: 0.8, rounding: 0.5, rotate: -90 },
  /** `Cookie7Sided`: star(7, 0.75, cornerRound50), rotated −90°. */
  cookie7: { points: 7, inner: 0.75, rounding: 0.5, rotate: -90 },
  /** A soft burst — `SoftBurst`'s ten points, as a star. */
  softBurst: { points: 10, inner: 0.72, rounding: 0.08 },
  /** A flower — `Flower`'s eight petals, as a deep, round star. */
  flower: { points: 8, inner: 0.62, rounding: 0.35, rotate: -90 },
} satisfies Record<string, StarSpec>;

export type ShapeName = keyof typeof SHAPES;

const r2 = (v: number) => Math.round(v * 100) / 100;

/** The SVG path of a rounded star in a 100×100 box. */
export function starPath({ points, inner, rounding, rotate = 0 }: StarSpec): string {
  const n = points * 2;
  const verts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const r = i % 2 === 0 ? 1 : inner;
    const a = ((rotate + (360 * i) / n) * Math.PI) / 180;
    verts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const at = (i: number) => verts[(i + n) % n];
  // A circular corner of radius r in an interior angle θ touches each edge
  // r / tan(θ/2) from the vertex — sharp points cut back little, shallow
  // ones a lot — clamped to half an edge so neighbouring corners meet.
  const cutLength = (i: number) => {
    const v = at(i);
    const p = at(i - 1);
    const q = at(i + 1);
    const ax = p[0] - v[0], ay = p[1] - v[1];
    const bx = q[0] - v[0], by = q[1] - v[1];
    const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
    const theta = Math.acos(Math.max(-1, Math.min(1, cos)));
    return rounding / Math.tan(theta / 2);
  };
  const cut = (i: number, toward: [number, number]) => {
    const from = at(i);
    const dx = toward[0] - from[0];
    const dy = toward[1] - from[1];
    const len = Math.hypot(dx, dy);
    const t = Math.min(cutLength(i), len / 2) / len;
    return [from[0] + dx * t, from[1] + dy * t] as [number, number];
  };
  const toBox = ([x, y]: [number, number]) => `${r2(50 + x * 50)} ${r2(50 + y * 50)}`;

  let d = "";
  for (let i = 0; i < n; i++) {
    const v = at(i);
    const a = cut(i, at(i - 1));
    const b = cut(i, at(i + 1));
    d += `${i === 0 ? "M" : "L"}${toBox(a)}Q${toBox(v)} ${toBox(b)}`;
  }
  return `${d}Z`;
}

/** The path for a named shape (memoised: the strings never change). */
const cache = new Map<ShapeName, string>();
export function shapePath(name: ShapeName): string {
  let d = cache.get(name);
  if (!d) {
    d = starPath(SHAPES[name]);
    cache.set(name, d);
  }
  return d;
}

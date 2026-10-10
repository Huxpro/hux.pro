import { kind, type Point } from "stage";

// Everyone at once: a turning globe of lights, each one somebody talking. A
// touch picks the nearest light facing you and lets the quiet run over the
// sphere from it: each light flares once as it passes, and goes out.
//
// The original loop's projection and point drawing, as they were; what moved
// is where the state lives (here) and who calls it (the stage).

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

type Hush = {
  /** Stage seconds when it began. */
  at: number;
  dot: number;
  /** Per light: its arc from the touched one, 0 to 1 (the far side); times `cross`, when the quiet reaches it. */
  delay: Float32Array;
};

type GlobeProps = {
  /** Screen area per light, px²; the count is clamped to [min, max]. */
  density: number;
  min: number;
  max: number;
  /** The radius, as a share of the shorter side, and the room kept above and below, px. */
  size: number;
  margin: number;
  /** The camera's distance, in radii. */
  camera: number;
  spin: number;
  tilt: number;
  /** The quiet: to the far side of the globe, and one light's flare and fade, s. */
  cross: number;
  fade: number;
};

type GlobeState = {
  count: number;
  pos: Float32Array;
  flicker: { a: number; phase: number; speed: number; size: number }[];
  sx: Float32Array;
  sy: Float32Array;
  sz: Float32Array;
  sp: Float32Array;
  angle: number;
  hush: Hush | null;
};

export type GlobeOut = {
  state: GlobeState;
  center: Point;
  /** The outline's radius on screen. */
  silhouette: number;
  /** Seconds since the quiet began (0 before). */
  since: number;
  /** Every light has gone out. */
  quiet: boolean;
  cross: number;
  fade: number;
};

export const Globe = kind<GlobeProps, GlobeState, GlobeOut>({
  name: "Globe",
  kind: "field",
  names: ["globe", "everyone", "the lights", "光点球"],
  intent: "Everyone at once: a turning globe of lights, each one somebody talking. Touched, it goes quiet in a wave from that light.",
  source: "app/dream/everyone/kinds/globe.ts",
  params: {
    density: { unit: "px²", note: "screen area per light" },
    size: { range: [0.2, 0.5], note: "radius, a share of the shorter side" },
    margin: { unit: "px", note: "kept above and below on a short screen" },
    camera: { note: "distance, in radii" },
    spin: { unit: "rad/s", range: [0, 1] },
    tilt: { unit: "rad" },
    cross: { unit: "s", range: [0.5, 4], note: "the quiet, to the far side" },
    fade: { unit: "s", note: "one light's flare and fade" },
  },

  init({ density, min, max }, { layout, rng }) {
    const count = Math.round(Math.min(max, Math.max(min, (layout.w * layout.h) / density)));
    const golden = Math.PI * (3 - Math.sqrt(5));
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const y = 1 - (2 * (i + 0.5)) / count;
      const r = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(i * golden) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(i * golden) * r;
    }
    const flicker = Array.from({ length: count }, () => ({
      a: 0.6 + rng() * 0.4,
      phase: rng() * Math.PI * 2,
      speed: 2 + rng() * 7,
      size: 0.9 + rng() * 1.1,
    }));
    const buf = () => new Float32Array(count);
    return { count, pos, flicker, sx: buf(), sy: buf(), sz: buf(), sp: buf(), angle: 0, hush: null };
  },

  // The turn is simulated: it slows to a stop as the quiet crosses.
  step(s, { spin, cross }, { t }) {
    const since = s.hush ? t.now - s.hush.at : 0;
    s.angle += t.dt * spin * (s.hush ? 1 - clamp01(since / cross) : 1);
  },

  // Projection: the same angle and layout give the same screen positions.
  frame(s, { size, margin, camera, tilt, cross, fade }, { t, layout }) {
    const radius = Math.min(Math.min(layout.w, layout.h) * size, layout.h / 2 - margin);
    const dotScale = Math.max(1, Math.min(2.2, radius / 170));
    const { x: cx, y: cy } = layout.center;
    const [ca, sa, cb, sb] = [Math.cos(s.angle), Math.sin(s.angle), Math.cos(tilt), Math.sin(tilt)];
    for (let i = 0; i < s.count; i++) {
      const x = s.pos[i * 3];
      const y = s.pos[i * 3 + 1];
      const z = s.pos[i * 3 + 2];
      const x1 = x * ca + z * sa;
      const z1 = -x * sa + z * ca;
      const y2 = y * cb - z1 * sb;
      const z2 = y * sb + z1 * cb;
      const p = camera / (camera - z2);
      s.sx[i] = cx + x1 * radius * p;
      s.sy[i] = cy + y2 * radius * p;
      s.sz[i] = z2;
      s.sp[i] = p * dotScale;
    }
    const since = s.hush ? t.now - s.hush.at : 0;
    return {
      state: s,
      center: layout.center,
      silhouette: (radius * camera) / Math.sqrt(camera * camera - 1),
      since,
      quiet: s.hush !== null && since > cross + fade,
      cross,
      fade,
    };
  },

  draw(g, { state: s, since, cross, fade }, _props, { t }) {
    const hush = s.hush;
    g.fillStyle = "rgb(226, 228, 236)";
    for (let i = 0; i < s.count; i++) {
      if (hush && i === hush.dot) continue;
      const f = s.flicker[i];
      let alpha = f.a * (0.45 + 0.55 * Math.sin(t.now * f.speed + f.phase));
      alpha *= 0.18 + 0.82 * clamp01((s.sz[i] + 1) / 2);
      let warm = 0;
      if (hush) {
        const u = (since - hush.delay[i] * cross) / fade;
        if (u >= 1) continue;
        if (u >= 0) {
          // The quiet reaches it: one flare, then out.
          warm = 1 - u;
          alpha = Math.min(1, alpha * (1 + 2.2 * warm)) * (1 - u);
        }
      }
      if (alpha < 0.012) continue;
      g.globalAlpha = alpha;
      g.fillStyle = warm > 0 ? "rgb(255, 214, 170)" : "rgb(226, 228, 236)";
      const size = f.size * s.sp[i] * (1 + warm);
      g.fillRect(s.sx[i] - size / 2, s.sy[i] - size / 2, size, size);
    }
    g.globalAlpha = 1;
  },

  measure: ({ center, silhouette, quiet }) => (quiet ? null : { circle: [center.x, center.y, silhouette] }),
  count: (s) => s.count,
  item(s, { since, cross, fade }, i) {
    if (s.hush && (i === s.hush.dot || since - s.hush.delay[i] * cross > fade)) return null;
    return { circle: [s.sx[i], s.sy[i], Math.max(2, s.flicker[i].size * s.sp[i])] };
  },
  inspect: (s, { since }) => ({ turning: !s.hush, angle: s.angle, ...(s.hush ? { quiet: since } : {}) }),

  // The touch: the nearest light facing you. Its place is where the light starts from.
  pointerDown(s, _out, p, ctx) {
    if (s.hush) return false;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < s.count; i++) {
      if (s.sz[i] < 0.05) continue;
      const d = (s.sx[i] - p.x) ** 2 + (s.sy[i] - p.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return false;
    const delay = new Float32Array(s.count);
    const [bx, by, bz] = [s.pos[best * 3], s.pos[best * 3 + 1], s.pos[best * 3 + 2]];
    for (let i = 0; i < s.count; i++) {
      const dot = bx * s.pos[i * 3] + by * s.pos[i * 3 + 1] + bz * s.pos[i * 3 + 2];
      delay[i] = Math.acos(Math.max(-1, Math.min(1, dot))) / Math.PI;
    }
    s.hush = { at: ctx.t.now, dot: best, delay };
    ctx.emit("touch", { x: s.sx[best], y: s.sy[best] });
    return true;
  },
});

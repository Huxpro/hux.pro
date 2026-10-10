import { kind } from "stage";
import type { SunRingOut } from "./sun-ring";
import type { ContoursOut } from "./types";

// The thing itself, opened under the finger: sky, water, light on the waves.
// The opening's radius is a function of time (when the hold began and ended);
// only following the finger is simulated. Painted on its own canvas, cut to a
// soft-edged circle, laid over the lines.

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);

type Hold = { start: number; end: number | null; endR: number; x: number; y: number };

type SeaProps = {
  /** The lines it opens through (their horizon), and the ring its sun is drawn at. */
  on: string;
  sun: string;
  /** A hold opens it to the whole screen in `open` s, slowly then giving way (`curve`); it closes in `close` s. */
  open: number;
  curve: number;
  close: number;
  /** The soft edge into the lines, px. */
  feather: number;
  /** A shorter hold is a tap, and does not count as a look, s. */
  seenAfter: number;
  /** The phases a press opens it in. */
  pressIn: string[];
};

type SeaState = { hold: Hold | null; canvas: HTMLCanvasElement; g: CanvasRenderingContext2D | null };

type SeaOut = {
  hold: Hold;
  r: number;
  open: number;
  /** The sun's bright disc, when the sea is open over it. */
  sun: [number, number, number] | null;
  sunAt: [number, number];
  horizon: number;
  t: number;
  w: number;
  h: number;
  dpr: number;
  feather: number;
  /** Its own canvas, which `draw` paints the sea into before cutting it to the opening. */
  buffer: { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D | null };
};

const radius = (hold: Hold, now: number, full: number, p: SeaProps) =>
  hold.end === null
    ? 24 + (full - 24) * Math.pow(clamp01((now - hold.start) / p.open), p.curve)
    : hold.endR * (1 - easeOut(clamp01((now - hold.end) / p.close)));

/** The sea, full screen, on its own canvas. */
function paintSea(g: CanvasRenderingContext2D, { w, h, t, horizon, sunAt: [sunX, sunY] }: SeaOut) {
  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#3d8fd9");
  sky.addColorStop(0.7, "#8cc6f0");
  sky.addColorStop(1, "#d9effc");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, horizon);

  // The sun, behind a little haze.
  const sun = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(w, h) * 0.35);
  sun.addColorStop(0, "rgba(255, 255, 250, 0.95)");
  sun.addColorStop(0.06, "rgba(255, 252, 235, 0.6)");
  sun.addColorStop(0.3, "rgba(255, 250, 235, 0.12)");
  sun.addColorStop(1, "rgba(255, 250, 235, 0)");
  g.fillStyle = sun;
  g.fillRect(0, 0, w, horizon);

  const sea = g.createLinearGradient(0, horizon, 0, h);
  sea.addColorStop(0, "#5aa7dc");
  sea.addColorStop(0.25, "#1f6fb2");
  sea.addColorStop(1, "#06244a");
  g.fillStyle = sea;
  g.fillRect(0, horizon, w, h - horizon);

  // Swells, closer and larger as they come down the screen.
  g.lineWidth = 1;
  for (let k = 1; k < 26; k++) {
    const depth = k / 26;
    const y = horizon + Math.pow(depth, 1.7) * (h - horizon);
    const amp = 0.6 + depth * 7;
    const len = 40 + depth * 260;
    g.strokeStyle = `rgba(220, 240, 255, ${0.08 + 0.14 * (1 - depth)})`;
    g.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const yy = y + Math.sin((x / len) * Math.PI * 2 + t * (0.6 + depth) + k * 1.7) * amp;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }

  // Light on the water, under the sun.
  for (let i = 0; i < 140; i++) {
    const depth = (i * 0.618) % 1;
    const y = horizon + 2 + Math.pow(depth, 1.5) * (h - horizon) * 0.9;
    const spread = 6 + depth * w * 0.18;
    const x = sunX + Math.sin(i * 12.9898) * spread;
    const flicker = 0.5 + 0.5 * Math.sin(t * (3 + (i % 7)) + i);
    const a = flicker * flicker * (0.75 - depth * 0.5);
    if (a < 0.05) continue;
    g.fillStyle = `rgba(255, 255, 245, ${a})`;
    g.fillRect(x, y, 2 + depth * 10, 1 + depth * 1.5);
  }
}

export const Sea = kind<SeaProps, SeaState, SeaOut | null>({
  name: "Sea",
  kind: "effect",
  names: ["the sea", "colour", "海", "颜色"],
  intent: "The thing itself, opened under the finger: sky, water, light on the waves.",
  source: "app/dream/blue/kinds/sea.ts",
  params: {
    open: { unit: "s", range: [1, 5], note: "a hold opens it to the whole screen" },
    curve: { range: [0.5, 3], note: "slow, then giving way" },
    close: { unit: "s", range: [0.2, 2] },
    feather: { unit: "px", range: [0, 120], note: "the soft edge into the lines" },
    seenAfter: { unit: "s", range: [0.1, 1.5], note: "a shorter hold is a tap" },
  },

  init: () => {
    const canvas = document.createElement("canvas");
    return { hold: null, canvas, g: canvas.getContext("2d") };
  },

  // Following the finger while held is the one simulated thing.
  step(s, _p, { pointer }) {
    if (s.hold?.end === null && pointer) {
      s.hold.x = pointer.x;
      s.hold.y = pointer.y;
    }
  },

  frame(s, p, { t, layout, out }) {
    const lines = out<ContoursOut>(p.on);
    const ring = out<SunRingOut>(p.sun);
    if (!s.hold || !lines || !ring) return null;
    const full = Math.hypot(layout.w, layout.h) + p.feather;
    const r = radius(s.hold, t.now, full, p);
    if (r <= 0.5) return null;
    const disc: [number, number, number] = [ring.x, ring.y, Math.max(layout.w, layout.h) * 0.35 * 0.06];
    const seen = Math.hypot(disc[0] - s.hold.x, disc[1] - s.hold.y) + disc[2] < r - p.feather / 2;
    return {
      hold: s.hold,
      r,
      open: r / full,
      sun: seen ? disc : null,
      sunAt: [ring.x, ring.y],
      horizon: lines.horizon,
      t: t.now,
      w: layout.w,
      h: layout.h,
      dpr: layout.dpr,
      feather: p.feather,
      buffer: { canvas: s.canvas, g: s.g },
    };
  },

  draw(ctx, o) {
    const g = o?.buffer.g;
    if (!o || !g) return;
    const { canvas } = o.buffer;
    const [cw, ch] = [Math.round(o.w * o.dpr), Math.round(o.h * o.dpr)];
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    g.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
    g.globalCompositeOperation = "source-over";
    paintSea(g, o);
    const { x, y } = o.hold;
    const mask = g.createRadialGradient(x, y, Math.max(0, o.r - o.feather), x, y, o.r);
    mask.addColorStop(0, "rgba(0, 0, 0, 1)");
    mask.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.globalCompositeOperation = "destination-in";
    g.fillStyle = mask;
    g.fillRect(0, 0, o.w, o.h);
    ctx.drawImage(canvas, 0, 0, o.w, o.h);
  },

  measure: (o) => (o ? { circle: [o.hold.x, o.hold.y, o.r] } : null),
  inspect: (_s, o) => ({ phase: o ? (o.hold.end === null ? "opening" : "closing") : "closed", open: o?.open ?? 0 }),

  pointerDown(s, _o, p, { t, emit }, props) {
    if (!props.pressIn.includes(t.phase) || s.hold?.end === null) return false;
    s.hold = { start: t.now, end: null, endR: 0, x: p.x, y: p.y };
    emit("press", p);
    return true;
  },

  pointerUp(s, o, { t, layout, emit }, props) {
    const hold = s.hold;
    if (!hold || hold.end !== null) return;
    hold.endR = o ? o.r : radius(hold, t.now, Math.hypot(layout.w, layout.h) + props.feather, props);
    hold.end = t.now;
    emit(t.now - hold.start >= props.seenAfter ? "release" : "tap");
  },
});

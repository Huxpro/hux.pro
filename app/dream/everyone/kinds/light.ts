import { kind, type Point } from "stage";

// The one picked out of everyone: from where it was touched it comes to the
// middle, glowing, says hello in two soft rings, and leans toward the pointer.
// Coming and the rings are a function of time; the lean follows the pointer,
// so it is simulated.

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);

/** How far one breath swells the glow. */
const BREATH = 0.07;
/** A hello ring's life, s. */
const RING = 2.4;

type LightProps = {
  /** Where it was touched (`ref("touch")`). */
  from: Point;
  approach: number;
  /** When it says hello, s after the touch. */
  hello: number[];
  /** Its glow at rest, in vmin. */
  size: number;
};

type LightState = { lean: Point };

type LightOut = {
  x: number;
  y: number;
  r: number;
  core: number;
  /** Hello rings now, each 0..1 through its life. */
  rings: number[];
  ringSize: number;
  /** Where it rests and how big it ever gets: what words anchor to. */
  rest: [number, number, number];
  since: number;
  approach: number;
  hello: number[];
};

export const Light = kind<LightProps, LightState, LightOut>({
  name: "Light",
  kind: "agent",
  names: ["the light", "the one you touched", "那一点", "orb"],
  intent: "The one picked out of everyone: it comes forward, glows, says hello in two rings, and leans toward you.",
  source: "app/dream/everyone/kinds/light.ts",
  params: {
    approach: { unit: "s", range: [0.8, 3], note: "how long it takes to come to you" },
    hello: { unit: "s", note: "its two rings, after the touch" },
    size: { unit: "vmin", range: [8, 30], note: "its glow at rest" },
  },

  init: () => ({ lean: { x: 0, y: 0 } }),

  step(s, { approach }, { t, pointer, layout }) {
    const here = t.since("hushed") >= approach;
    const want = pointer && here ? { x: (pointer.x - layout.center.x) * 0.06, y: (pointer.y - layout.center.y) * 0.06 } : { x: 0, y: 0 };
    const k = 1 - Math.exp(-t.dt * 3);
    s.lean.x += (Math.max(-30, Math.min(30, want.x)) - s.lean.x) * k;
    s.lean.y += (Math.max(-30, Math.min(30, want.y)) - s.lean.y) * k;
  },

  frame(s, { from, approach, hello, size }, { t, layout }) {
    const since = t.since("hushed");
    const e = easeInOut(clamp01(since / approach));
    const { x: cx, y: cy } = layout.center;
    const breath = 1 + BREATH * Math.sin(since * 1.7);
    return {
      x: from.x + (cx - from.x) * e + s.lean.x,
      y: from.y + (cy - from.y) * e + s.lean.y,
      r: (14 + layout.vmin(size) * e) * breath,
      core: (1.6 + 5 * e) * breath,
      rings: hello.map((at) => (since - at) / RING).filter((u) => u >= 0 && u < 1),
      ringSize: Math.min(layout.w, layout.h) * 0.32,
      rest: [cx, cy, (14 + layout.vmin(size)) * (1 + BREATH)],
      since,
      approach,
      hello,
    };
  },

  draw(g, { x, y, r, core, rings, ringSize }) {
    const glow = g.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, "rgba(255, 214, 170, 0.6)");
    glow.addColorStop(0.35, "rgba(255, 180, 120, 0.17)");
    glow.addColorStop(1, "rgba(255, 170, 110, 0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgb(255, 244, 230)";
    g.beginPath();
    g.arc(x, y, core, 0, Math.PI * 2);
    g.fill();
    // Hello: two soft rings, toward you.
    g.lineWidth = 1;
    g.strokeStyle = "rgb(255, 214, 170)";
    for (const u of rings) {
      g.globalAlpha = 0.32 * (1 - u);
      g.beginPath();
      g.arc(x, y, 10 + ringSize * (1 - Math.pow(1 - u, 2)), 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
  },

  measure: ({ x, y, r }) => ({ circle: [x, y, r] }),
  anchor: ({ rest }) => ({ circle: rest }),
  inspect: (s, { since, approach, hello }) => ({
    phase: since < approach ? "coming" : since < (hello.at(-1) ?? 0) + 1 ? "hello" : "here",
    lean: [Math.round(s.lean.x), Math.round(s.lean.y)],
  }),
});

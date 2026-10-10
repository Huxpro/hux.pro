import { kind } from "stage";
import type { Speck } from "./types";

// What the moments become: their own colours, rising, slowing, and staying
// faint. It happened. Each speck the moments shed becomes a mote here.

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

type DustProps = {
  /** What it is the dust of: a node whose output sheds specks. */
  from: string;
  /** How hard it rises, at most: less on a short screen, so it stays on it. */
  rise: number;
  /** How quickly it slows, per second. */
  drag: number;
  /** How much of itself it keeps once it has faded. */
  kept: number;
};

type Mote = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  /** How long it takes to fade to what it keeps, s. */
  fade: number;
  size: number;
  color: string;
  phase: number;
};

type DustState = { motes: Mote[] };
type DustOut = { motes: Mote[]; now: number; kept: number; w: number; h: number };

export const Dust = kind<DustProps, DustState, DustOut | null>({
  name: "Dust",
  kind: "field",
  names: ["dust", "尘", "what is left"],
  intent: "What the moments become: their own colours, rising, slowing, and staying faint. It happened.",
  source: "app/dream/forget/kinds/dust.ts",
  params: {
    rise: { range: [0.3, 2], note: "how hard it rises (less on a short screen)" },
    drag: { range: [0, 3], note: "how quickly it slows" },
    kept: { range: [0, 1], note: "how much of itself it keeps once faded" },
  },

  init: () => ({ motes: [] }),

  step(s, p, { t, layout, rng, out }) {
    // Its lift is a share of the screen's height, so the dust stays on a short one.
    const lift = Math.min(p.rise, layout.h / 844);
    for (const b of out<{ shed: Speck[] }>(p.from)?.shed ?? []) {
      s.motes.push({
        x: b.x,
        y: b.y,
        vx: (-45 + rng() * 100) * lift,
        vy: (-40 - rng() * 110) * lift,
        born: t.now,
        fade: 1.6 + rng() * 1.6,
        size: 1.2 + rng() * 1.3,
        color: b.color,
        phase: rng() * Math.PI * 2,
      });
    }
    const drag = Math.exp(-t.dt * p.drag);
    for (const d of s.motes) {
      d.vx *= drag;
      d.vy *= drag;
      d.x += (d.vx + Math.sin(t.now * 0.7 + d.phase) * 4) * t.dt;
      d.y += (d.vy + Math.cos(t.now * 0.5 + d.phase) * 3) * t.dt;
    }
  },

  frame: (s, p, { t, layout }) => (s.motes.length ? { motes: s.motes, now: t.now, kept: p.kept, w: layout.w, h: layout.h } : null),

  draw(g, o) {
    if (!o) return;
    for (const d of o.motes) {
      const kept = o.kept + 0.12 * Math.sin(o.now * 1.3 + d.phase);
      const a = kept + (1 - kept) * (1 - clamp01((o.now - d.born) / d.fade));
      g.fillStyle = `rgba(${d.color}, ${a})`;
      g.fillRect(d.x, d.y, d.size, d.size);
    }
  },

  measure(o) {
    if (!o) return null;
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const d of o.motes) {
      x0 = Math.min(x0, d.x);
      y0 = Math.min(y0, d.y);
      x1 = Math.max(x1, d.x + d.size);
      y1 = Math.max(y1, d.y + d.size);
    }
    return { rect: [x0, y0, x1 - x0, y1 - y0] };
  },
  count: (s) => s.motes.length,
  item: (s, _o, i) => {
    const d = s.motes[i];
    return d ? { rect: [d.x - 2, d.y - 2, d.size + 4, d.size + 4] } : null;
  },
  inspect: (s, o) => ({
    motes: s.motes.length,
    onScreen: o && s.motes.length ? s.motes.filter((d) => d.x >= 0 && d.x <= o.w && d.y >= 0 && d.y <= o.h).length / s.motes.length : 1,
  }),
});

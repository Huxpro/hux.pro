import { kind } from "stage";
import type { GlobeOut } from "./globe";

// What everyone is saying: small rings rising off the lights, until it is
// quiet. Simulated: rings are born at random lights (the node's own seeded
// random) and age out.

type Ring = { x: number; y: number; born: number; size: number };

type VoicesProps = {
  /** The globe they rise from. */
  on: string;
  /** Rings a second, and how long one lasts, s. */
  rate: number;
  life: number;
};

type VoicesState = { rings: Ring[] };
type VoicesOut = { rings: Ring[]; now: number; life: number; area: [number, number, number] | null };

export const Voices = kind<VoicesProps, VoicesState, VoicesOut>({
  name: "Voices",
  kind: "field",
  names: ["voices", "rings", "talking"],
  intent: "What they are saying: small rings rising off the lights until it is quiet.",
  source: "app/dream/everyone/kinds/voices.ts",
  params: { rate: { unit: "/s", range: [0, 200] }, life: { unit: "s" } },

  init: () => ({ rings: [] }),

  step(s, { on, rate, life }, { t, rng, out }) {
    const globe = out<GlobeOut>(on);
    if (globe && t.phase === "talking") {
      const g = globe.state;
      let spawn = t.dt * rate;
      while (spawn > 0) {
        if (spawn < 1 && rng() > spawn) break;
        spawn -= 1;
        const i = (rng() * g.count) | 0;
        if (g.sz[i] < -0.2) continue;
        s.rings.push({ x: g.sx[i], y: g.sy[i], born: t.now, size: 5 + rng() * 9 * g.sp[i] });
      }
    }
    s.rings = s.rings.filter((r) => t.now - r.born < life);
  },

  frame(s, { on, life }, { t, out }) {
    const globe = out<GlobeOut>(on);
    return {
      rings: s.rings,
      now: t.now,
      life,
      area: globe && s.rings.length ? [globe.center.x, globe.center.y, globe.silhouette] : null,
    };
  },

  draw(g, { rings, now, life }) {
    g.lineWidth = 1;
    g.strokeStyle = "rgb(226, 228, 236)";
    for (const r of rings) {
      const u = (now - r.born) / life;
      g.globalAlpha = 0.22 * (1 - u);
      g.beginPath();
      g.arc(r.x, r.y, r.size * u, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
  },

  measure: ({ area }) => (area ? { circle: area } : null),
  count: (s) => s.rings.length,
  item: (s, { now, life }, i) => {
    const r = s.rings[i];
    return r ? { circle: [r.x, r.y, Math.max(1, (r.size * (now - r.born)) / life)] } : null;
  },
});

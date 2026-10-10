import { kind } from "stage";
import type { ContoursOut } from "./types";

// The sea as I know it: a description. Grey contour lines rolling to the
// horizon, far to near, each hiding the ones behind it. Each look leaves them
// a little bluer: how much they have kept is simulated, easing toward what
// the phase says they keep.

type ContoursProps = {
  /** The horizon, as a share of the height: the same in both seas. */
  horizon: number;
  lines: number;
  /** "r, g, b": the grey, and the blue they keep after every look. */
  grey: string;
  kept: string;
  /** How much of that blue each phase keeps (0 when it is not named). */
  keptIn: Record<string, number>;
  background: string;
};

const rgb = (s: string) => s.split(",").map(Number) as [number, number, number];

export const Contours = kind<ContoursProps, { kept: number }, ContoursOut>({
  name: "Contours",
  kind: "field",
  names: ["contour lines", "the drawing", "the grey sea", "线稿"],
  intent: "The sea as I know it: a description, grey lines rolling to the horizon, each hiding the ones behind it.",
  source: "app/dream/blue/kinds/contours.ts",
  params: {
    horizon: { range: [0.3, 0.6], note: "share of the height, the same in both seas" },
    lines: { range: [8, 60] },
  },

  init: () => ({ kept: 0 }),
  step(s, { keptIn }, { t }) {
    s.kept += ((keptIn[t.phase] ?? 0) - s.kept) * (1 - Math.exp(-t.dt * 0.8));
  },
  frame(s, { horizon, grey, kept }, { t, layout }) {
    const [g, k] = [rgb(grey), rgb(kept)];
    return {
      horizon: layout.h * horizon,
      kept: s.kept,
      rgb: g.map((c, i) => Math.round(c + (k[i] - c) * s.kept)) as [number, number, number],
      t: t.now,
      w: layout.w,
      h: layout.h,
    };
  },
  draw(ctx, { horizon, rgb: [r, g, b], t, w, h }, { lines, background }) {
    ctx.lineWidth = 1;
    // The horizon.
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.55)`;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(w, horizon);
    ctx.stroke();
    for (let k = 1; k <= lines; k++) {
      const depth = k / lines;
      const y0 = horizon + Math.pow(depth, 1.8) * (h - horizon) * 1.04;
      const amp = 1 + depth * depth * 26;
      const len = 60 + depth * 340;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      for (let x = 0; x <= w + 6; x += 6) {
        const swell =
          Math.sin((x / len) * Math.PI * 2 + t * (0.5 + depth * 0.6) + k * 1.7) * 0.6 +
          Math.sin((x / (len * 0.43)) * Math.PI * 2 - t * 0.9 + k) * 0.25;
        ctx.lineTo(x, y0 - (swell + 0.85) * amp);
      }
      // Everything nearer hides what is behind it.
      ctx.lineTo(w + 6, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = background;
      ctx.fill();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.3 + 0.55 * (1 - depth)})`;
      ctx.stroke();
    }
  },
  measure: ({ horizon, w, h }) => ({ rect: [0, horizon, w, h - horizon] }),
  inspect: ({ kept }) => ({ kept }),
});

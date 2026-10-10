import { kind } from "stage";
import type { ContoursOut } from "./types";

// The sun as a description: a ring where the real one will be, faintly warm
// once it has been seen. The one place the sun's position is decided; the sea
// draws its sun where this ring is.

type SunRingProps = {
  /** The contour lines it is drawn with (their colour, their horizon). */
  on: string;
  /** Across the screen, and down the sky (a share of the horizon's height). */
  x: number;
  y: number;
  /** Its radius, as a share of the shorter side. */
  size: number;
};

export type SunRingOut = { x: number; y: number; r: number; kept: number; rgb: [number, number, number] };

export const SunRing = kind<SunRingProps, null, SunRingOut | null>({
  name: "SunRing",
  kind: "agent",
  names: ["the sun's ring", "the drawn sun", "太阳圆环"],
  intent: "The sun as a description: a ring where the real one will be, faintly warm once it has been seen.",
  source: "app/dream/blue/kinds/sun-ring.ts",
  params: { x: { range: [0.1, 0.9] }, y: { range: [0.1, 0.9] }, size: { range: [0.02, 0.12] } },

  frame(_s, { on, x, y, size }, { layout, out }) {
    const lines = out<ContoursOut>(on);
    if (!lines) return null;
    return { x: layout.w * x, y: lines.horizon * y, r: Math.min(layout.w, layout.h) * size, kept: lines.kept, rgb: lines.rgb };
  },
  draw(ctx, o) {
    if (!o) return;
    const [r, g, b] = o.rgb;
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.stroke();
    if (o.kept > 0) {
      ctx.fillStyle = `rgba(255, 246, 220, ${o.kept * 0.12})`;
      ctx.fill();
    }
  },
  measure: (o) => (o ? { circle: [o.x, o.y, o.r] } : null),
});

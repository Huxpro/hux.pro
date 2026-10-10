import { kind } from "stage";
import { MOMENT_NAMES } from "./pictures";
import type { EdgeOut, WindowOut } from "./types";

// The window's top edge: a moment that reaches it turns to dust; held there,
// it wears away anyway. It draws nothing; the moments read it.

type EdgeProps = {
  /** The window it is the edge of, and the moments it wears. */
  on: string;
  moments: string;
  /** How long a held moment lasts at the edge, s. */
  erode: number;
  /** The share of a held moment that goes to dust each second as it wears. */
  shed: number;
};

export const Edge = kind<EdgeProps, null, EdgeOut | null>({
  name: "Edge",
  kind: "effect",
  names: ["the edge", "窗沿", "where things go"],
  intent: "The window's top edge: a moment that reaches it turns to dust; held there, it wears away anyway.",
  source: "app/dream/forget/kinds/edge.ts",
  params: {
    erode: { unit: "s", range: [0.5, 6], note: "how long a held moment lasts at the edge" },
    shed: { range: [0, 3], note: "how much of it goes to dust each second as it wears" },
  },

  frame(_s, p, { out }) {
    const win = out<WindowOut>(p.on);
    if (!win) return null;
    const { box, row } = win;
    return { rect: [box.x, box.y, box.width, row / 2], y: box.y + row / 2, erode: p.erode, shed: p.shed, presence: win.presence, moments: p.moments };
  },

  measure: (o) => (o && o.presence > 0.01 ? { rect: o.rect } : null),
  // The moments come after it in the scene; when the inspector asks, they have framed.
  inspect(_s, o, { out }) {
    const m = out<{ edgeAt: number; wear: number[] }>(o?.moments ?? "");
    return m && m.edgeAt !== -1 ? { wearing: MOMENT_NAMES[m.edgeAt], wear: Math.round(m.wear[m.edgeAt] * 100) / 100 } : { wearing: null, wear: 0 };
  },
});

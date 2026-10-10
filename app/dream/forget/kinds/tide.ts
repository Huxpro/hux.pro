import { kind } from "stage";
import type { TideOut, WindowOut } from "./types";

// Letting go: what is left in the window goes at once, top to bottom. It
// draws nothing; the moments read when it began and how it staggers.

type TideProps = {
  /** The window it empties. */
  on: string;
  /** The gap between one moment going and the next, s. */
  stagger: number;
};

export const Tide = kind<TideProps, null, TideOut | null>({
  name: "Tide",
  kind: "effect",
  names: ["the tide", "letting go", "退潮"],
  intent: "Letting go: what is left in the window goes at once, top to bottom.",
  source: "app/dream/forget/kinds/tide.ts",
  params: { stagger: { unit: "s", range: [0, 0.6], note: "between one moment going and the next" } },

  frame(_s, p, { t, out }) {
    const win = out<WindowOut>(p.on);
    return win && t.phase === "tide" ? { box: win.box, since: t.since("tide"), stagger: p.stagger } : null;
  },

  measure: (o) => (o ? { rect: [o.box.x, o.box.y, o.box.width, o.box.height] } : null),
});

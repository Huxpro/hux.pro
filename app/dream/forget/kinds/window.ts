import { kind } from "stage";
import type { WindowOut } from "./types";

// The window: what I can hold at once. Moments rise through it and go at its
// top edge. It warms while you hold on, and leaves with the last moment. Its
// rows shrink on a short screen (a phone on its side) so the caption and the
// hint keep their room.

type WindowProps = {
  /** Its width, at most, px. */
  width: number;
  /** A row, at most and at least, px; and the height kept clear above and below for the words. */
  row: number;
  rowMin: number;
  chrome: number;
  /** How many moments it holds before the oldest reaches the edge. */
  held: number;
  /** Its line, as "r, g, b". */
  ink: string;
};

type WindowState = { warmth: number; presence: number };

export const Window = kind<WindowProps, WindowState, WindowOut>({
  name: "Window",
  kind: "surface",
  names: ["the window", "窗", "context"],
  intent: "What I can hold at once: moments rise through it and go at its top edge. It warms while you hold on, and leaves with the last moment.",
  source: "app/dream/forget/kinds/window.ts",
  params: {
    width: { unit: "px", range: [160, 400] },
    row: { unit: "px", range: [50, 120], note: "a row, at most" },
    rowMin: { unit: "px", range: [30, 80], note: "a row, at least, on a short screen" },
    chrome: { unit: "px", range: [100, 300], note: "kept clear above and below for the caption and the hint" },
    held: { range: [1, 5], note: "moments it holds before the oldest reaches the edge" },
  },

  init: () => ({ warmth: 0, presence: 1 }),

  step(s, _p, { t }) {
    s.warmth += ((t.phase === "holding" ? 1 : 0) - s.warmth) * (1 - Math.exp(-t.dt * 4));
    s.presence += ((t.phase === "dust" ? 0 : 1) - s.presence) * (1 - Math.exp(-t.dt * 2));
  },

  frame(s, p, { layout }) {
    const held = Math.round(p.held);
    const row = Math.max(p.rowMin, Math.min(p.row, (layout.h - p.chrome) / (held + 1)));
    const width = Math.min(p.width, layout.w - 40);
    const height = row * (held + 1);
    return {
      box: { x: (layout.w - width) / 2, y: layout.h * 0.5 - height / 2, width, height },
      row,
      scale: row / p.row,
      held,
      warmth: s.warmth,
      presence: s.presence,
      ink: p.ink,
    };
  },

  draw(g, { box, warmth, presence, ink }) {
    if (presence <= 0.003) return;
    g.beginPath();
    g.roundRect(box.x, box.y, box.width, box.height, 18);
    if (warmth > 0.003) {
      g.fillStyle = `rgba(255, 196, 130, ${0.16 * warmth * presence})`;
      g.fill();
    }
    g.lineWidth = 1 + warmth;
    g.strokeStyle = `rgba(${ink}, ${(0.14 + 0.2 * warmth) * presence})`;
    g.stroke();
  },

  measure: ({ box, presence }) => (presence > 0.01 ? { rect: [box.x, box.y, box.width, box.height] } : null),
  inspect: (s) => ({ warmth: Math.round(s.warmth * 100) / 100 }),
});

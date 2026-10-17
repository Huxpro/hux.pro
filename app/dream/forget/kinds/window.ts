import { kind } from "stage";
import { blend, ease, MORPH } from "./morph";
import type { Axis, Box, WindowOut } from "./types";

// The window: what I can hold at once. Moments rise through it and go at its
// top edge. It warms while you hold on, and leaves with the last moment. Its
// rows shrink on a short screen (a phone on its side) so the caption and the
// hint keep their room; or it lies on its side (`axis="across"`), and the
// moments drift right to left and go at its left edge. When its shape
// changes, it moves to the new one rather than jumping (./morph.ts).

type WindowProps = {
  /** Its breadth across the way the moments go, at most, px (its width, upright). */
  width: number;
  /** A row, at most and at least, px; and the height kept clear above and below for the words. */
  row: number;
  rowMin: number;
  chrome: number;
  /** How many moments it holds before the oldest reaches the edge. */
  held: number;
  /** Which way the moments go. */
  axis: Axis;
  /** Its line, as "r, g, b". */
  ink: string;
};

type WindowState = {
  warmth: number;
  presence: number;
  /** The box as drawn now: on its way to the target while a morph runs. */
  shown: Box | null;
  /** Where a morph began, when it began, and what it was for. */
  from: Box | null;
  at: number;
  key: string;
};

/** Where the window belongs on this screen, with these props. */
function target(p: WindowProps, w: number, h: number) {
  const held = Math.round(p.held);
  const axis: Axis = p.axis === "across" ? "across" : "up";
  // Rows run along the axis; `width` is the window's other side.
  const room = axis === "up" ? h - p.chrome : w - 40;
  const row = Math.max(p.rowMin, Math.min(p.row, room / (held + 1)));
  const side = Math.min(p.width, axis === "up" ? w - 40 : h - p.chrome);
  const [width, height] = axis === "up" ? [side, row * (held + 1)] : [row * (held + 1), side];
  return { box: { x: (w - width) / 2, y: h * 0.5 - height / 2, width, height }, axis, row, held };
}

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
    axis: { note: '"up": moments rise through a tall window; "across": it lies on its side and they drift right to left' },
  },

  init: () => ({ warmth: 0, presence: 1, shown: null, from: null, at: 0, key: "" }),

  step(s, p, { t, layout }) {
    s.warmth += ((t.phase === "holding" ? 1 : 0) - s.warmth) * (1 - Math.exp(-t.dt * 4));
    s.presence += ((t.phase === "dust" ? 0 : 1) - s.presence) * (1 - Math.exp(-t.dt * 2));
    // A new shape: move to it from where it is drawn now.
    const to = target(p, layout.w, layout.h);
    const key = JSON.stringify(to);
    if (s.shown && key !== s.key) {
      s.from = { ...s.shown };
      s.at = t.now;
    }
    s.key = key;
    const e = s.from ? ease((t.now - s.at) / MORPH) : 1;
    s.shown = s.from ? blend(s.from, to.box, e) : to.box;
    if (e >= 1) s.from = null;
  },

  frame(s, p, { layout }) {
    const to = target(p, layout.w, layout.h);
    return {
      box: s.shown ?? to.box,
      axis: to.axis,
      row: to.row,
      scale: to.row / p.row,
      held: to.held,
      warmth: s.warmth,
      presence: s.presence,
      ink: p.ink,
      morphAt: s.from ? s.at : null,
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

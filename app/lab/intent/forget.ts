import type { Cue } from "stage";
import { MOMENT_NAMES } from "@/app/dream/forget/kinds/pictures";
import type { IntentNode, Tree, Words } from "./tree";

// =============================================================================
// /dream/forget's preset intents: what a person might mean that its props
// cannot say, written by hand as an intent tree (./tree.ts). A model may add
// to it; a person decides over it.
//
//   axis       which way the moments go: up a tall window, or right to left
//              through a wide one. Indexed by the screen's shape.
//   holding    held at the edge, a moment still wears away, or it waits.
//              The dream's meaning, so when the model is unsure it asks.
//   letgo      letting go: the rest goes at once (a tide), or one by one.
//   dust       what is left rises away, or settles near the window.
//   keep       for each moment: it goes like the rest, or it is kept, set
//              aside whole beside the window. Dragging one out keeps it.
// =============================================================================

/** A screen the dream is seen on: its size in CSS px. */
export interface Screen {
  id: string;
  w: number;
  h: number;
}

export const SCREENS: Screen[] = [
  { id: "phone", w: 390, h: 844 },
  { id: "tablet", w: 820, h: 1180 },
  { id: "square", w: 800, h: 800 },
  { id: "laptop", w: 1440, h: 900 },
  { id: "landscape", w: 844, h: 390 },
  { id: "wide", w: 2560, h: 1080 },
];

/** How tall a screen is for its width: the index `axis` crosses over along. */
export const tallness = (s: Screen) => s.h / s.w;

const MOMENTS_ZH = ["你的猫", "一个深夜", "我们俩", "一个家", "一个小太阳"];

const keep = (i: number): IntentNode => ({
  type: "keep",
  of: `moments#${i}`,
  words: { en: `Keep ${MOMENT_NAMES[i]}`, zh: `留住${MOMENTS_ZH[i]}` },
  kinds: {
    goes: { words: { en: "It goes", zh: "让它走" }, patch: { moments: { kept: [] } } },
    stays: { words: { en: "Kept", zh: "留住" }, patch: { moments: { kept: [i] } } },
  },
  prior: { goes: 0.9, stays: 0.1 },
  resolve: "switch",
  from: "preset",
});

export const PRESET: Tree = [
  {
    type: "axis",
    of: "window",
    words: { en: "Which way they go", zh: "往哪里走" },
    kinds: {
      up: { words: { en: "Up", zh: "向上" }, patch: { window: { axis: "up" } } },
      across: { words: { en: "Across", zh: "横向" }, patch: { window: { axis: "across" } } },
    },
    prior: { up: 0.6, across: 0.4 },
    resolve: "switch",
    index: { by: "tallness", base: "up" },
    from: "preset",
  },
  {
    type: "holding",
    of: "edge",
    words: { en: "Holding on", zh: "按住时" },
    kinds: {
      wears: { words: { en: "Wears away", zh: "仍会磨损" }, patch: { edge: { erode: 2.6, shed: 0.9 } } },
      keeps: { words: { en: "Waits", zh: "停住等你" }, patch: { edge: { erode: 600, shed: 0.06 } } },
    },
    prior: { wears: 0.6, keeps: 0.4 },
    resolve: "ask",
    question: {
      en: "When you hold on, does the moment at the edge still wear away?",
      zh: "按住的时候，窗沿上那个画面还会继续磨损吗？",
    },
    from: "preset",
  },
  {
    type: "letgo",
    of: "tide",
    words: { en: "Letting go", zh: "松开时" },
    kinds: {
      tide: { words: { en: "A tide", zh: "像退潮" }, patch: { tide: { stagger: 0.12 } } },
      oneByOne: { words: { en: "One by one", zh: "一个一个" }, patch: { tide: { stagger: 0.95 } } },
    },
    prior: { tide: 0.7, oneByOne: 0.3 },
    resolve: "switch",
    from: "preset",
  },
  {
    type: "dust",
    of: "dust",
    words: { en: "What is left", zh: "留下的" },
    kinds: {
      rises: { words: { en: "Rises", zh: "升起" }, patch: { dust: { rise: 1.3, drag: 0.7 } } },
      settles: { words: { en: "Settles", zh: "落下" }, patch: { dust: { rise: 0.45, drag: 1.8 } } },
    },
    prior: { rises: 0.6, settles: 0.4 },
    resolve: "switch",
    from: "preset",
  },
  ...MOMENT_NAMES.map((_, i) => keep(i)),
];

/** Each preset type's first cell, by type (the tests and the panel name them). */
export const KEY = {
  axis: "axis|window",
  holding: "holding|edge",
  letgo: "letgo|tide",
  dust: "dust|dust",
  keep: (i: number) => `keep|moments#${i}`,
};

/**
 * What a model said about the presets, given the scene's intent line and the
 * kinds' words: its distributions, a cache, never stored with the scene.
 * Written in this session by Claude reading the scene ("A conversation
 * remembered a moment at a time, each going to dust at the window's edge; it
 * happened anyway").
 */
export const BELIEFS: Record<string, { p: Record<string, number> }> = {
  [KEY.axis]: { p: { up: 0.3, across: 0.7 } },
  [KEY.holding]: { p: { wears: 0.52, keeps: 0.48 } },
  [KEY.letgo]: { p: { tide: 0.82, oneByOne: 0.18 } },
  [KEY.dust]: { p: { rises: 0.74, settles: 0.26 } },
};

/** A value reintent may leave to code: a kind, or code chooses within these bounds. */
export type Defer = { defer: true; base?: string; below?: string; not?: string[] };
export type Value = string | Defer | undefined;

/** The row a window upright would get here: under this, it is cramped. */
const CRAMPED_ROW = 64;

/**
 * Code's choice where reintent defers: the scene as written (a node's first
 * kind), and for `axis` where to cross over: upright while a row keeps 64 px.
 */
export function settle(node: IntentNode, v: Value, s: Screen): string {
  if (typeof v === "string") return v;
  const open = Object.keys(node.kinds).filter((k) => !v?.not?.includes(k));
  if (node.type === "axis") {
    if (!open.includes("up")) return v?.below ?? "across";
    const fits = (s.h - 180) / 4 >= CRAMPED_ROW;
    return fits ? (v?.base ?? "up") : (v?.below ?? "across");
  }
  return open[0];
}

/**
 * The same performance on every screen, on the stage's clock: hold on as the
 * first moment nears the edge, hold long enough to wear it away (or not), let
 * go. Then the dust, the words, and it starts over.
 */
export const SCRIPT: Cue[] = [
  { at: 2.4, down: [0.5, 0.9] },
  { at: 7.6, up: true },
];
export const LOOP = 5.5;

export type { Words };

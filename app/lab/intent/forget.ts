import type { Cue } from "stage";
import { MOMENT_NAMES } from "@/app/dream/forget/kinds/pictures";
import type { IntentNode, Tree, Words } from "./tree";

// =============================================================================
// /dream/forget's intent tree, as a strong model authored it: what a person
// might mean that its props cannot say, each intent with its vocabulary (what
// a person says and does that means each kind). This is the cache of that
// authoring, so the lab opens without a model; "re-author" asks the model to
// write it again from the scene (./tree.ts, /api/intent). A person decides
// over it; a weak model chooses within it; a strong model adds to it.
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

export { SCREENS, tallness, type Screen } from "./screens";
import type { Screen } from "./screens";

const MOMENTS_ZH = ["你的猫", "一个深夜", "我们俩", "一个家", "一个小太阳"];

/** Who wrote the cached tree. */
export const AUTHORED_BY = "claude (this session, cached)";

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
  say: { stays: ["keep", "keep it", "never let it go", "留住", "别走"], goes: ["let it go", "it goes", "让它走", "放手"] },
  gestures: { stays: [{ from: "self", outOf: "window" }], goes: [{ from: "self", into: "window" }] },
  from: "preset",
  by: AUTHORED_BY,
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
    say: { up: ["up", "upright", "stand it up", "向上", "竖着", "立起来"], across: ["across", "sideways", "lay it down", "横向", "横着", "躺下"] },
    gestures: { across: [{ from: "window", dir: "horizontal" }], up: [{ from: "window", dir: "vertical" }] },
    from: "preset",
    by: AUTHORED_BY,
  },
  {
    type: "holding",
    of: "edge",
    words: { en: "Holding on", zh: "按住时" },
    kinds: {
      wears: { words: { en: "Wears away", zh: "仍会磨损" }, patch: { edge: { wears: true } } },
      keeps: { words: { en: "Waits", zh: "停住等你" }, patch: { edge: { wears: false } } },
    },
    prior: { wears: 0.6, keeps: 0.4 },
    resolve: "ask",
    question: {
      en: "When you hold on, does the moment at the edge still wear away?",
      zh: "按住的时候，窗沿上那个画面还会继续磨损吗？",
    },
    say: { wears: ["wears away", "it still wears away", "仍会磨损", "还是会磨损"], keeps: ["waits", "wait for me", "停住等你", "等我"] },
    from: "preset",
    by: AUTHORED_BY,
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
    say: { tide: ["a tide", "all at once", "像退潮", "一下子"], oneByOne: ["one by one", "一个一个", "一个接一个"] },
    from: "preset",
    by: AUTHORED_BY,
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
    say: { rises: ["rises", "rise", "float away", "升起", "飘走"], settles: ["settles", "settle", "fall", "like snow", "落下", "像雪"] },
    gestures: { settles: [{ from: "dust", dir: "down" }], rises: [{ from: "dust", dir: "up" }] },
    from: "preset",
    by: AUTHORED_BY,
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

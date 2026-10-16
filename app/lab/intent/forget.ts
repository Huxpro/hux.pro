import type { Cue, Params } from "stage";
import { space } from "reintent";

// =============================================================================
// /dream/forget's intents: what a person might mean that its props cannot say.
//
// A prop says "the edge erodes a held moment in 2.6 s". An intent says what
// that is for, as a closed choice: when you hold on, does the moment at the
// edge still wear away, or does it wait? reintent decides each one per screen
// (a person's decision > their preference > a model sure enough > code), and
// `compile` turns the decisions into the scene's props. The scene file is
// untouched: these are set over it, on whichever screen is showing.
//
//   axis      which way the moments go: up a tall window, or right to left
//             through a wide one. Indexed by the screen's shape: up on tall
//             screens, across below a crossover a person can move.
//   holding   held at the edge, a moment still wears away, or it waits.
//             The dream's meaning, so when the model is unsure it asks.
//   letgo     letting go: the rest goes at once (a tide), or one by one.
//   dust      what is left rises away, or settles near the window.
// =============================================================================

export type Axis = "up" | "across";
export type Holding = "wears" | "keeps";
export type LetGo = "tide" | "oneByOne";
export type DustKind = "rises" | "settles";

export type IntentType = "axis" | "holding" | "letgo" | "dust";
export const INTENT_TYPES: IntentType[] = ["axis", "holding", "letgo", "dust"];

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

/** The scene's nodes the intents are about (subjects are references into its world). */
const WORLD = { window: { id: "window" }, edge: { id: "edge" }, tide: { id: "tide" }, dust: { id: "dust" } };
type Node = { id: string };

/** What each kind is, in words a model reads (the lab shows its own, in both languages). */
const WORDS: Record<string, string> = {
  up: "the moments rise up through a tall window and go at its top edge",
  across: "the window lies on its side; the moments drift right to left and go at its left edge",
  wears: "held at the edge, a moment still wears away: holding on slows forgetting, it does not stop it",
  keeps: "held at the edge, a moment waits, whole, for as long as you hold on",
  tide: "letting go, everything left goes at once, like a tide",
  oneByOne: "letting go, the rest go one by one, as they would have",
  rises: "the dust rises away and stays faint in the air",
  settles: "the dust settles near where the window was",
};

const node = (n: Node) => n.id;
const describe = (k: string) => WORDS[k];

export const TYPES = space({
  axis: {
    kinds: () => ["up", "across"],
    subjects: () => [WORLD.window],
    id: node,
    prior: () => ({ up: 0.6, across: 0.4 }),
    describe,
    resolve: "switch",
    index: { of: tallness, base: () => "up" },
  },
  holding: {
    kinds: () => ["wears", "keeps"],
    subjects: () => [WORLD.edge],
    id: node,
    prior: () => ({ wears: 0.6, keeps: 0.4 }),
    describe,
    resolve: "ask",
  },
  letgo: {
    kinds: () => ["tide", "oneByOne"],
    subjects: () => [WORLD.tide],
    id: node,
    prior: () => ({ tide: 0.7, oneByOne: 0.3 }),
    describe,
    resolve: "switch",
  },
  dust: {
    kinds: () => ["rises", "settles"],
    subjects: () => [WORLD.dust],
    id: node,
    prior: () => ({ rises: 0.6, settles: 0.4 }),
    describe,
    resolve: "switch",
  },
});

export const KINDS: Record<IntentType, string[]> = {
  axis: ["up", "across"],
  holding: ["wears", "keeps"],
  letgo: ["tide", "oneByOne"],
  dust: ["rises", "settles"],
};

/** Each type's one cell: `type|subject`. */
export const KEY: Record<IntentType, string> = {
  axis: "axis|window",
  holding: "holding|edge",
  letgo: "letgo|tide",
  dust: "dust|dust",
};

/**
 * What a model said about each, given the scene's intent line and WORDS: its
 * distributions, a cache, never stored with the scene. Written in this
 * session by Claude reading the scene ("A conversation remembered a moment at
 * a time, each going to dust at the window's edge; it happened anyway").
 */
export const BELIEFS = {
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
 * Code's choice where reintent defers: the dream as written, and for `axis`
 * where to cross over: upright while a row keeps 64 px, on its side below.
 */
export function settle(type: IntentType, v: Value, s: Screen): string {
  if (typeof v === "string") return v;
  const open = KINDS[type].filter((k) => !v?.not?.includes(k));
  if (type === "axis") {
    if (!open.includes("up")) return v?.below ?? "across";
    const fits = (s.h - 180) / 4 >= CRAMPED_ROW;
    return fits ? (v?.base ?? "up") : (v?.below ?? "across");
  }
  return open[0];
}

/** The scene's props for one screen's settled intents. */
export function compile(a: Record<IntentType, string>): Params {
  return {
    window: { axis: a.axis },
    edge: a.holding === "keeps" ? { erode: 600, shed: 0.06 } : { erode: 2.6, shed: 0.9 },
    tide: { stagger: a.letgo === "oneByOne" ? 0.95 : 0.12 },
    dust: a.dust === "settles" ? { rise: 0.45, drag: 1.8 } : { rise: 1.3, drag: 0.7 },
  };
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

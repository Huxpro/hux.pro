// =============================================================================
// The player, as a function of (state, t, the tree).
//
// It knows beats, not a dream: the tree's phases, in order, each held for its
// "hold", with a blink between (the lids close at a beat's end and open on
// the next), then the waking: the room, only the room, and the words. What
// each beat shows (where he is, the door, his gaze) is read from the tree
// through reintent (intents.ts says what the kinds mean); the drag's
// in-between is the player's own.
// =============================================================================

import { beat, timeline, type LanguageLayer, type TimelineValues } from "scene";
import { dragValue, realized, type DragPreview, type Pt, type Tree, type Value } from "intents";

export const TIMELINE = timeline({
  beats: {
    blink: beat(0, { over: 0.6, aka: ["眨眼", "a blink"], note: "两幕之间眨一下眼：一幕将尽时闭上，下一幕睁开 · between beats, a blink" }),
    line: beat(2.6, { aka: ["那句话", "the words"], note: "醒来之后，字出现 · awake, the words" }),
  },
  phases: {
    dream: { label: "梦 · the dream", aka: ["梦", "梦里", "the dream"] },
    awake: { label: "醒来 · awake", aka: ["醒了", "我醒了", "I woke"] },
  },
  inputs: {
    tap: { aka: ["轻触", "下一幕", "tap"], does: "梦里，下一幕；醒来后，再梦一次 · in the dream, the next beat; awake, dream it again" },
  },
});

export type Timeline = TimelineValues<typeof TIMELINE>;

// -----------------------------------------------------------------------------
// The tree, as the picture reads it.
// -----------------------------------------------------------------------------

export interface BeatView {
  id: string;
  label: { zh: string; en: string };
  line: string;
  where: { kind: string; at: Pt; scale: number; lean: number; inside: boolean; absent: boolean };
  door: number;
  eyes: number;
  hold: number;
}

export interface Read {
  beats: BeatView[];
  hatScale: number;
  tree: Tree;
  values: Record<string, Value>;
}

/** The instance he is drawn as, for where he is (the man's declared instances). */
export const instanceOf = (where: string) => (where === "inside" ? "wardrobe" : ["bedside", "foot", "window", "room"].includes(where) ? where : "room");

export function read(tree: Tree, values: Record<string, Value>, preview: DragPreview | null, focus: string | null): Read {
  const drag = preview ? dragValue(tree, values, preview, focus) : null;
  const beats = (tree.phases ?? []).flatMap(({ node: id }): BeatView[] => {
    const node = tree.nodes.find((n) => n.id === id);
    if (!node) return [];
    const r = (i: string) => realized(tree, values, id, i);
    const w = r("where");
    let where = {
      kind: values[`where|${id}`]?.kind ?? "room",
      at: (w.at as Pt | undefined) ?? [200, 712],
      scale: (w.scale as number | undefined) ?? 1.4,
      lean: (w.lean as number | undefined) ?? 0,
      inside: w.inside === true,
      absent: w.absent === true,
    };
    if (drag && drag.node === id && "at" in drag && drag.at) {
      const [y0, s0, y1, s1] = drag.gesture.depth ?? [0, where.scale, 1, where.scale];
      where = { ...where, at: drag.at, scale: Math.max(0.6, Math.min(2.1, s0 + ((drag.at[1] - y0) / (y1 - y0)) * (s1 - s0))), lean: 0, inside: false, absent: false };
    }
    return [{ id, label: node.label, line: node.prompt, where, door: (r("door").open as number) ?? 0, eyes: (r("gaze").eyes as number) ?? 1, hold: (r("hold").over as number) ?? 5 }];
  });
  return { beats, hatScale: (realized(tree, values, "man", "hat").hatScale as number) ?? 1.45, tree, values };
}

// -----------------------------------------------------------------------------
// State: which beat, since when.
// -----------------------------------------------------------------------------

export interface State {
  /** The beat playing (beats.length: awake). */
  i: number;
  /** When it began, on the scene's clock. */
  at: number;
  via: "start" | "tap" | "auto" | "replay" | "still";
}

export const initial: State = { i: 0, at: 0, via: "start" };

export type Action =
  | { type: "next"; t: number; n: number; via: "tap" | "auto" }
  | { type: "replay"; t: number }
  | { type: "still"; i: number; t: number; u: number }
  | { type: "play" };

export function reduce(s: State, a: Action): State {
  switch (a.type) {
    case "next":
      return s.i < a.n ? { i: s.i + 1, at: a.t, via: a.via } : s;
    case "replay":
      return { i: 0, at: a.t, via: "replay" };
    case "still":
      return { i: a.i, at: a.t - a.u, via: "still" };
    case "play":
      return s.via === "still" ? { ...s, via: "auto" } : s;
  }
}

// -----------------------------------------------------------------------------
// The view: what is drawn, at t.
// -----------------------------------------------------------------------------

export interface View {
  dream: boolean;
  beat: BeatView | null;
  man: { instance: string; at: Pt; scale: number; lean: number; inside: boolean; eyes: number } | null;
  doors: { left: number; right: number };
  lids: { closed: boolean; speed: number };
  caption: string | null;
  hint: boolean;
  line: boolean;
}

export function view(s: State, t: number, { beat: b }: Timeline, rd: Read): View {
  const n = rd.beats.length;
  const dream = s.i < n && n > 0;
  const u = Math.max(0, t - s.at);
  const cur = dream ? rd.beats[s.i] : null;
  const last = rd.beats[n - 1];
  const held = s.via === "still";
  if (!cur) {
    // Awake: the room, the door as the dream left it, and the words.
    const door = last?.door ?? 0;
    return { dream: false, beat: null, man: null, doors: { left: 0, right: door }, lids: { closed: false, speed: 0.25 }, caption: null, hint: false, line: u >= b.line.at };
  }
  const w = cur.where;
  return {
    dream: true,
    beat: cur,
    man: w.absent ? null : { instance: instanceOf(w.kind), at: w.at, scale: w.scale, lean: w.lean, inside: w.inside, eyes: cur.eyes },
    // In the wardrobe, the doors part around him; out of it, the right one stands as it was left.
    doors: w.inside ? { left: cur.door, right: cur.door } : { left: 0, right: cur.door },
    lids: { closed: !held && u > cur.hold - (b.blink.over ?? 0.6), speed: b.blink.over ?? 0.6 },
    caption: u > 0.4 || held ? cur.line : null,
    hint: s.i === 0 && s.via === "start" && !held,
    line: false,
  };
}

// -----------------------------------------------------------------------------
// Stills and words, from the tree: a dream told is checked like one written.
// -----------------------------------------------------------------------------

export function stillsOf(rd: Read) {
  return [
    ...rd.beats.map((b, i) => ({
      name: b.id,
      label: `${b.label.zh} · ${b.label.en}`,
      phase: "dream",
      i,
      expect: b.where.absent || b.where.inside ? ["wardrobe"] : [`man[${instanceOf(b.where.kind)}]`],
    })),
    { name: "awake", label: "醒来 · awake", phase: "awake", i: rd.beats.length, expect: ["wardrobe", "bed.blanket"] },
  ];
}

export function languageOf(rd: Read): LanguageLayer {
  const ref = (b: BeatView) => (b.where.absent ? "phase.dream" : `man[${instanceOf(b.where.kind)}]`);
  return {
    prompt: [...rd.beats.flatMap((b, i): LanguageLayer["prompt"] => [...(i ? ["。"] : []), [b.line, ref(b)]]), "。", ["醒了", "phase.awake"]],
    concepts: rd.beats.map((b) => ({
      words: { zh: b.label.zh, en: b.label.en },
      kind: { zh: `一幕 · ${b.hold} 秒`, en: `a beat · ${b.hold} s` },
      ref: ref(b),
      lands: `${b.id}.where = ${b.where.kind}`,
    })),
  };
}

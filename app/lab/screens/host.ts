// =============================================================================
// The camera host: Reintent's intents for how a scene composed for a phone
// is framed on any screen.
//
// A scene on packages/scene knows where every named thing is (its pick
// buffer's visible boxes). That is what a camera needs and a crop does not
// have: not "the middle of the picture", but "the man, his face, the door".
// So the framing on a screen is a few closed decisions, Reintent's way:
//
//   frame|dream     fill · whole           indexed by the screen's tallness: fill on
//                                          tall screens (crop, stepping back into the
//                                          room only as far as keeping needs); below
//                                          a crossover, the composed frame, whole and
//                                          letterboxed. Where it crosses is code's
//                                          (where filling would run past what is
//                                          drawn), until a person switches on some
//                                          screen, which moves it there.
//   keep|<thing>    whole · part · crop    must all of it stay in frame, enough of
//                                          it to tell (its face, its door), or may
//                                          it be cut? Asked when the model is unsure;
//                                          a person may say it once for everything.
//   focus|<still>   one of the things      what a crop centres on. Switched, not asked.
//
// Decisions are Reintent's (packages/reintent, vendored from airtalk#818);
// the solver below is code: deterministic, instant, never fails. A world is
// a still of the scene on one screen: what it shows, read back the same way.
// =============================================================================

import * as R from "@/packages/reintent/src/reintent.js";

export type Kind = string;
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface Screen {
  id: string;
  width: number;
  height: number;
}

/** One still of the scene, as the scene measured it. */
export interface Capture {
  still: string;
  frame: Box;
  /** Everything drawn, bleed included (the room runs past the frame). */
  extent: Box;
  /** Per entity on stage: what of it is visible, and its key part. */
  things: Record<string, { box: Box; key: Box | null }>;
}

/** A still on a screen: the camera's answer. */
export interface World {
  capture: Capture;
  screen: Screen;
  view: Box;
  /** fill as a plain crop, fill stepping back, or the whole frame letterboxed. */
  mode: "crop" | "step" | "whole";
  focus: string;
  /** What each thing ended up as: all of it in view, its key part, or cut. */
  shown: Record<string, Kind>;
}

// The things a still can hold, and the part of each that is enough to tell it.
export const THINGS = ["man", "wardrobe", "window", "bed"] as const;
export type Thing = (typeof THINGS)[number];
export const KEY_PART: Record<Thing, string | null> = {
  man: "eyes",
  wardrobe: "door.right",
  window: "moon",
  bed: null,
};

const tall = (s: Screen) => s.height / s.width;
const inside = (a: Box, b: Box, slack = 0.5) => a.x0 >= b.x0 - slack && a.y0 >= b.y0 - slack && a.x1 <= b.x1 + slack && a.y1 <= b.y1 + slack;
const union = (bs: Box[]): Box | null =>
  bs.length ? { x0: Math.min(...bs.map((b) => b.x0)), y0: Math.min(...bs.map((b) => b.y0)), x1: Math.max(...bs.map((b) => b.x1)), y1: Math.max(...bs.map((b) => b.y1)) } : null;
const pad = (b: Box, p: number): Box => ({ x0: b.x0 - p, y0: b.y0 - p, x1: b.x1 + p, y1: b.y1 + p });
const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));

// -----------------------------------------------------------------------------
// The types
// -----------------------------------------------------------------------------

/** Code's guess, before any model: keep him and the wardrobe enough to tell; the window and bed may go. */
const KEEP_PRIOR: Record<Thing, Record<string, number>> = {
  man: { whole: 0.4, part: 0.5, crop: 0.1 },
  wardrobe: { whole: 0.5, part: 0.4, crop: 0.1 },
  window: { whole: 0.1, part: 0.3, crop: 0.6 },
  bed: { whole: 0.2, crop: 0.8 },
};

type Subject = { id: string; thing?: Thing; still?: string; things?: Thing[] };

export const types = R.space({
  frame: {
    subjects: () => [{ id: "dream" }],
    id: (s: Subject) => s.id,
    kinds: () => ["fill", "whole"],
    prior: () => ({ fill: 0.6, whole: 0.4 }),
    describe: (k: Kind) => k,
    resolve: "switch",
    pref: false,
    // Tall screens (the phone it was composed for) crop; below the crossover, another kind.
    index: { of: (ctx: Screen) => tall(ctx), base: () => "fill" },
  },
  keep: {
    subjects: (w: Capture) => THINGS.filter((t) => w.things[t]).map((t) => ({ id: t, thing: t })),
    id: (s: Subject) => s.id,
    kinds: (s: Subject) => (KEY_PART[s.thing!] ? ["whole", "part", "crop"] : ["whole", "crop"]),
    prior: (s: Subject) => KEEP_PRIOR[s.thing!],
    describe: (k: Kind) => k,
    resolve: "ask",
    pref: true,
    check: (kind: Kind, w: World, s: Subject) => (w.shown[s.thing!] && rank(w.shown[s.thing!]) < rank(kind) ? `cut (${w.shown[s.thing!]})` : null),
  },
  focus: {
    subjects: (w: Capture) => [{ id: w.still, still: w.still, things: THINGS.filter((t) => w.things[t] && t !== "bed") }],
    id: (s: Subject) => s.id,
    kinds: (s: Subject) => s.things!,
    prior: (s: Subject) => Object.fromEntries(s.things!.map((t) => [t, 1 / s.things!.length])),
    describe: (k: Kind) => k,
    resolve: "switch",
    pref: false,
  },
});

/** whole > part > crop: how much of a thing a kind asks for. */
const rank = (k: Kind) => (k === "whole" ? 2 : k === "part" ? 1 : 0);

export type Cell = { key: string; type: "frame" | "keep" | "focus"; subject: Subject; kinds: Kind[]; prior: Record<string, number> };
export const cellsOf = (capture: Capture): Cell[] => R.cells(types, capture) as Cell[];

// -----------------------------------------------------------------------------
// What a model said, reading the dream (recorded: the Lab calls no model at
// view time). Sure about most; not about him: all of him, or his face?
// -----------------------------------------------------------------------------

export const MODEL_BELIEFS: Record<string, { p: Record<string, number> }> = {
  "frame|dream": { p: { fill: 0.62, whole: 0.38 } },
  "keep|man": { p: { whole: 0.48, part: 0.46, crop: 0.06 } },
  "keep|wardrobe": { p: { whole: 0.7, part: 0.28, crop: 0.02 } },
  "keep|window": { p: { crop: 0.62, part: 0.3, whole: 0.08 } },
  "keep|bed": { p: { crop: 0.85, whole: 0.15 } },
  "focus|gap": { p: { wardrobe: 0.56, man: 0.34, window: 0.1 } },
  "focus|bedside": { p: { man: 0.9, wardrobe: 0.07, window: 0.03 } },
  "focus|door": { p: { wardrobe: 0.5, man: 0.45, window: 0.05 } },
};

export interface Doc {
  decisions: Record<string, { pick: unknown; from: string }>;
  prefs: Record<string, { pick: Kind; from: string } | undefined>;
  beliefs: Record<string, { p: Record<string, number> }>;
}

export const EMPTY_DOC: Doc = { decisions: {}, prefs: {}, beliefs: MODEL_BELIEFS };

// -----------------------------------------------------------------------------
// The solver: an Assignment, a still and a screen → a world. Code: it settles
// whatever the decisions leave to it (a Defer), and never fails.
// -----------------------------------------------------------------------------

type Assignment = Record<string, unknown>;
const str = (v: unknown): Kind | null => (typeof v === "string" ? v : null);

/** What each thing must keep in view, under an assignment. Unsettled: enough to tell it. */
function needs(capture: Capture, a: Assignment): Box[] {
  const out: Box[] = [];
  for (const t of THINGS) {
    const thing = capture.things[t];
    if (!thing) continue;
    const k = str(a[`keep|${t}`]) ?? (KEY_PART[t] ? "part" : "crop");
    if (k === "whole") out.push(thing.box);
    else if (k === "part" && thing.key) out.push(thing.key);
  }
  return out;
}

function focusOf(capture: Capture, a: Assignment): Thing {
  const f = str(a[`focus|${capture.still}`]);
  if (f && capture.things[f]) return f as Thing;
  // Code's pick: him, when he is there to see; else the wardrobe.
  return capture.things.man?.key ? "man" : "wardrobe";
}

/** The largest window of the screen's shape inside the frame, placed to hold `need` around `focus`. */
function cropWindow(capture: Capture, screen: Screen, need: Box[], focus: Box): { view: Box; holds: boolean } {
  const F = capture.frame;
  const fw = F.x1 - F.x0;
  const fh = F.y1 - F.y0;
  const r = screen.width / screen.height;
  const w = Math.min(fw, fh * r);
  const h = w / r;
  const u = union(need);
  const fx = (focus.x0 + focus.x1) / 2;
  const fy = (focus.y0 + focus.y1) / 2;
  // Along each axis: keep every need inside if it can be, then centre the focus.
  const place = (lo0: number, size: number, span: number, nlo: number | null, nhi: number | null, c: number) => {
    let lo = lo0;
    let hi = lo0 + span - size;
    if (nlo !== null && nhi !== null) {
      lo = Math.max(lo, nhi - size);
      hi = Math.min(hi, nlo);
    }
    return { at: clamp(c - size / 2, lo, hi), ok: lo <= hi + 0.5 };
  };
  const x = place(F.x0, w, fw, u?.x0 ?? null, u?.x1 ?? null, fx);
  const y = place(F.y0, h, fh, u?.y0 ?? null, u?.y1 ?? null, fy);
  return { view: { x0: x.at, y0: y.at, x1: x.at + w, y1: y.at + h }, holds: x.ok && y.ok };
}

/** Step back from the crop until every need fits (a margin round it), into the scene's bleed. */
function fitWindow(capture: Capture, screen: Screen, need: Box[], focus: Box): Box {
  const crop = cropWindow(capture, screen, need, focus);
  if (crop.holds) return crop.view;
  const r = screen.width / screen.height;
  const u = pad(union(need)!, 0.04 * (capture.frame.y1 - capture.frame.y0));
  let w = Math.max(crop.view.x1 - crop.view.x0, u.x1 - u.x0);
  let h = w / r;
  if (h < u.y1 - u.y0) {
    h = u.y1 - u.y0;
    w = h * r;
  }
  const E = capture.extent;
  const fx = (focus.x0 + focus.x1) / 2;
  // Hold the needs; within that, stay on what is drawn; within that, centre the focus.
  const axis = (size: number, nlo: number, nhi: number, elo: number, ehi: number, c: number) => {
    const lo = nhi - size;
    const hi = nlo;
    const inE = clamp(c - size / 2, Math.max(lo, elo), Math.min(hi, ehi - size));
    return clamp(inE, lo, hi);
  };
  const x = axis(w, u.x0, u.x1, E.x0, E.x1, fx);
  const y = axis(h, u.y0, u.y1, E.y0, E.y1, (u.y0 + u.y1) / 2);
  return { x0: x, y0: y, x1: x + w, y1: y + h };
}

/** What a view shows of each thing. */
function shownIn(capture: Capture, view: Box): Record<string, Kind> {
  const out: Record<string, Kind> = {};
  for (const t of THINGS) {
    const thing = capture.things[t];
    if (!thing) continue;
    out[t] = inside(thing.box, view) ? "whole" : thing.key && inside(thing.key, view) ? "part" : "crop";
  }
  return out;
}

export function solve(capture: Capture, screen: Screen, a: Assignment): World {
  const need = needs(capture, a);
  const focus = focusOf(capture, a);
  const fbox = capture.things[focus]?.key ?? capture.things[focus]?.box ?? capture.frame;
  const v = a["frame|dream"];
  const crop = cropWindow(capture, screen, need, fbox);
  const stepped = crop.holds ? crop.view : fitWindow(capture, screen, need, fbox);
  let frame = str(v);
  if (!frame) {
    // Deferred: fill while filling stays on what is drawn (and is not ruled out); else the kind
    // below the crossover (the model's, or whole).
    const d = (v ?? {}) as { below?: Kind; not?: Kind[] };
    frame = !d.not?.includes("fill") && inside(stepped, capture.extent, 1) ? "fill" : (d.below ?? "whole");
  }
  const mode: World["mode"] = frame === "whole" ? "whole" : crop.holds ? "crop" : "step";
  const view = mode === "whole" ? { ...capture.frame } : stepped;
  // Letterboxed, the whole frame is in view.
  return { capture, screen, view, mode, focus, shown: mode === "whole" ? shownIn(capture, capture.frame) : shownIn(capture, view) };
}

/** What a world shows, per cell: Reintent's read-back. */
export function read(w: World): Record<string, Kind> {
  const out: Record<string, Kind> = { "frame|dream": w.mode === "whole" ? "whole" : "fill", [`focus|${w.capture.still}`]: w.focus };
  for (const [t, k] of Object.entries(w.shown)) out[`keep|${t}`] = k;
  return out;
}

export const holds = (w: World, key: string, kind: Kind) => read(w)[key] === kind;

// -----------------------------------------------------------------------------
// One tile: a still on a screen, under the doc.
// -----------------------------------------------------------------------------

export interface Tile {
  world: World;
  /** The Assignment in force, who has a say per cell, what it would be with no person's decisions. */
  a: Assignment;
  firm: Record<string, string>;
  /** Worlds a person could switch to here: one cell flipped, the rest frozen as shown. */
  alternatives: { key: string; type: string; kind: Kind; from: Kind; world: World; relaxed: string[] }[];
  /** Firm values this world breaks. */
  broken: string[];
  /** A person's decision changed this tile (vs. the model and code alone). */
  changed: boolean;
  cells: Cell[];
}

export function tile(doc: Doc, capture: Capture, screen: Screen, withAlternatives = false): Tile {
  const cs = cellsOf(capture);
  const { a, firm, dflt } = R.view(types, doc, cs, screen) as { a: Assignment; firm: Record<string, string>; dflt: Assignment };
  const world = solve(capture, screen, a);
  const base = solve(capture, screen, dflt);
  const alternatives = withAlternatives
    ? (R.alternatives(types, cs, a, world, {
        run: (b: Assignment) => solve(capture, screen, b),
        holds,
        relax: ["focus", "keep"],
        read,
      }) as Tile["alternatives"])
    : [];
  const broken = R.check(types, doc, cs, a, world, undefined) as string[];
  const changed = JSON.stringify(world.view) !== JSON.stringify(base.view) || world.mode !== base.mode;
  return { world, a, firm, alternatives, broken, changed, cells: cs };
}

// Reintent's reducers and readers, typed for this host.
export const decide = (doc: Doc, cs: Cell[], key: string, screen: Screen) => R.decide(types, doc, cs.find((c) => c.key === key)!, screen) as {
  value: unknown;
  from: string;
  p?: Record<string, number>;
  ask: boolean;
};
export const belief = (doc: Doc, cell: Cell) => R.belief(types, doc, cell) as Record<string, number>;
export const narrow = (doc: Doc, cell: Cell, kind: Kind, screen: Screen, opts?: { scope?: "here" | "all"; from?: string }) =>
  R.narrow(types, doc, cell, kind, screen, opts) as Doc;
export const forget = (doc: Doc, key: string) => R.forget(doc, key) as Doc;
export const questions = (doc: Doc, cs: Cell[], screen: Screen) => R.questions(types, doc, cs, screen) as Cell[];
export const TAU: number = R.TAU;

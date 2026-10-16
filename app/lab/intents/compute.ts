// =============================================================================
// COMPUTE: reintent over the tree, then the projection to coordinates.
//
// The tree's intents become reintent's cells (a type per intent name, the
// things that have it as subjects); a person's picks are its decisions, the
// model's p its beliefs; the context (the screen) is what an indexed type is
// read along. decide() says, per cell: the person's pick > a confident model
// > code (and, unsure on an intent that asks, a question). Then realize()
// turns the values into the scene's props: where he stands, how big the hat,
// how far the door. One direction: tree → values → coordinates → view.
// =============================================================================

import * as R from "reintent";
import type { Cell, Doc, TypeSpec } from "reintent";
import type { Context, Intent, Node, Realize, State } from "./tree";

type Subject = { id: string; node?: Node };

/** The frame: fill the screen on tall ones, the whole composition below a crossover (code's, until switched). */
const FRAME: TypeSpec = {
  subjects: () => [{ id: "scene" }],
  id: (s: Subject) => s.id,
  kinds: () => ["fill", "whole"],
  prior: () => ({ fill: 0.6, whole: 0.4 }),
  describe: (k: string) => k,
  resolve: "switch",
  pref: false,
  index: { of: (ctx: Context) => ctx.screen.height / ctx.screen.width, base: () => "fill" },
};

export function space(state: State) {
  const types: Record<string, TypeSpec> = { frame: FRAME };
  for (const n of state.tree.nodes)
    for (const [name, intent] of Object.entries(n.intents)) {
      if (types[name]) continue;
      types[name] = {
        subjects: (s: State) => s.tree.nodes.filter((x) => x.intents[name]).map((x) => ({ id: x.id, node: x })),
        id: (s: Subject) => s.id,
        kinds: (s: Subject) => Object.keys(s.node!.intents[name].kinds),
        // Code's prior: the first kind, the one the composition was drawn with.
        prior: (s: Subject) => {
          const ks = Object.keys(s.node!.intents[name].kinds);
          return Object.fromEntries(ks.map((k, i) => [k, i === 0 ? 0.6 : 0.4 / Math.max(1, ks.length - 1)]));
        },
        describe: (k: string) => k,
        resolve: intent.resolve,
        pref: false,
      };
    }
  const cells = R.cells(types, state);
  const doc: Doc = { decisions: {}, prefs: {}, beliefs: {} };
  for (const n of state.tree.nodes)
    for (const [name, i] of Object.entries(n.intents)) {
      const key = `${name}|${n.id}`;
      doc.beliefs![key] = { p: i.p };
      if (i.pick) doc.decisions![key] = { pick: i.pick, from: i.from };
    }
  if (state.tree.frame) doc.decisions!["frame|scene"] = state.tree.frame;
  return { types, cells, doc };
}

/** A person switched the framing on this screen: reintent moves the crossover to its shape. */
export function frameDecision(state: State, kind: string): NonNullable<State["tree"]["frame"]> {
  const { types, cells, doc } = space(state);
  const cell = cells.find((c) => c.key === "frame|scene")!;
  const next = R.narrow(types, doc, cell, kind, state.ctx, { from: "switched" });
  return next.decisions!["frame|scene"] as NonNullable<State["tree"]["frame"]>;
}
export type Source = "person" | "model" | "code" | "ask";

export interface Value {
  key: string;
  node: string;
  intent: string;
  kind: string;
  source: Source;
  from?: string;
  p: Record<string, number>;
  cell: Cell;
}

/** Every cell's value in this context, and who said it. A Defer is settled by code: the model's best guess. */
export function values(state: State) {
  const { types, cells, doc } = space(state);
  const out: Record<string, Value> = {};
  for (const c of cells) {
    const d = R.decide(types, doc, c, state.ctx);
    const p = R.belief(types, doc, c);
    const [intent, node] = c.key.split("|");
    let kind: string;
    let source: Source;
    if (typeof d.value === "string") {
      kind = d.value;
      source = doc.decisions![c.key] ? "person" : d.from === "inferred" ? "model" : "code";
    } else {
      // Code settles it. The frame: fill while the screen is at least squarish.
      kind = intent === "frame" ? (state.ctx.screen.height / state.ctx.screen.width >= 0.9 ? "fill" : ((d.value as { below?: string })?.below ?? "whole")) : (R.argmax(p) as string);
      source = d.ask ? "ask" : "code";
    }
    out[c.key] = { key: c.key, node, intent, kind, source, from: (doc.decisions![c.key]?.from as string) ?? undefined, p, cell: c };
  }
  const asks = cells.filter((c) => R.decide(types, doc, c, state.ctx).ask);
  return { values: out, asks, types, cells, doc };
}

// -----------------------------------------------------------------------------
// The projection: values → the scene's props.
// -----------------------------------------------------------------------------

export interface Picture {
  fit: "slice" | "meet";
  man: { place: string; at: readonly [number, number]; scale: number; lean: number; inside: boolean; hatScale: number; eyes: number };
  door: number;
  /** Things a model added after an event (a lamp): where, and on or off. */
  extra: { id: string; at: readonly [number, number]; scale: number; on: boolean }[];
}

const realizeOf = (state: State, node: string, intent: string, kind: string): Realize =>
  state.tree.nodes.find((n) => n.id === node)?.intents[intent]?.kinds[kind]?.realize ?? {};

export function realize(state: State, v: Record<string, Value>): Picture {
  const r = (node: string, intent: string) => (v[`${intent}|${node}`] ? realizeOf(state, node, intent, v[`${intent}|${node}`].kind) : {});
  const place = r("man", "place");
  const extra = state.tree.nodes
    .filter((n) => n.learned)
    .map((n) => {
      const at = r(n.id, "place");
      return { id: n.id, at: at.at ?? [330, 720], scale: at.scale ?? 1, on: r(n.id, "light").on ?? true };
    });
  return {
    fit: v["frame|scene"]?.kind === "whole" ? "meet" : "slice",
    man: {
      place: v["place|man"]?.kind ?? "wardrobe",
      at: place.at ?? [285.5, 640],
      scale: place.scale ?? 1,
      lean: place.lean ?? 0,
      inside: !!place.inside,
      hatScale: r("man", "hat").hatScale ?? 1,
      eyes: r("man", "gaze").eyes ?? 1,
    },
    door: r("wardrobe", "door").open ?? 0.14,
    extra,
  };
}

/** The kinds of an intent, in order. */
export const kindsOf = (i: Intent) => Object.keys(i.kinds);

// =============================================================================
// COMPUTE: reintent over the tree.
//
// Each intent name is a reintent type; the things that have it are its
// subjects; a person's picks are its decisions; the model's p its beliefs; the
// viewer's leanings (context) its preferences, which tilt what the author left
// open and never override what the author decided. decide() then says, per
// cell, what it is now and who said so: a person > a viewer's leaning (alone)
// > a confident model > code (and, unsure on an intent that asks, a question).
// =============================================================================

import * as R from "reintent";
import type { Cell, Doc, TypeSpec } from "reintent";
import { key, type Context, type State, type Tree } from "./tree";

export type Source = "person" | "viewer" | "model" | "code" | "ask";

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

export function space(tree: Tree, ctx: Context) {
  const types: Record<string, TypeSpec> = {};
  for (const n of tree.nodes)
    for (const [name, intent] of Object.entries(n.intents)) {
      if (types[name]) continue;
      types[name] = {
        subjects: (t: Tree) => t.nodes.filter((x) => x.intents[name]).map((x) => ({ id: x.id, node: x })),
        id: (s: { id: string }) => s.id,
        kinds: (s: { node: Tree["nodes"][number] }) => Object.keys(s.node.intents[name].kinds),
        // Code's prior: the first kind, the one the composition was drawn with.
        prior: (s: { node: Tree["nodes"][number] }) => {
          const ks = Object.keys(s.node.intents[name].kinds);
          return Object.fromEntries(ks.map((k, i) => [k, i === 0 ? 0.6 : 0.4 / Math.max(1, ks.length - 1)]));
        },
        describe: (k: string) => k,
        resolve: intent.resolve,
        pref: true,
      };
    }
  const cells = R.cells(types, tree);
  const doc: Doc = { decisions: {}, prefs: {}, beliefs: {} };
  for (const n of tree.nodes)
    for (const [name, i] of Object.entries(n.intents)) {
      doc.beliefs![key(n.id, name)] = { p: i.p };
      if (i.pick) doc.decisions![key(n.id, name)] = { pick: i.pick, from: i.from };
    }
  for (const [type, kind] of Object.entries(ctx.viewer)) doc.prefs![type] = { pick: kind, from: "viewer" };
  return { types, cells, doc };
}

/** Every cell's value now, and who said it. A Defer is settled by code: the model's best guess. */
export function values(state: Pick<State, "tree" | "ctx">) {
  const { types, cells, doc } = space(state.tree, state.ctx);
  const out: Record<string, Value> = {};
  const asks: Cell[] = [];
  // The same, without the viewer's leanings: a value they changed is theirs.
  const plain: Doc = { ...doc, prefs: {} };
  const settle = (dd: Doc, c: Cell) => {
    const d = R.decide(types, dd, c, state.ctx);
    return { d, kind: typeof d.value === "string" ? d.value : (R.argmax(R.belief(types, dd, c)) as string) };
  };
  for (const c of cells) {
    const { d, kind } = settle(doc, c);
    const p = R.belief(types, doc, c);
    const [intent, node] = c.key.split("|");
    let source: Source;
    if (doc.decisions![c.key]) source = "person";
    else if (doc.prefs![c.type] && settle(plain, c).kind !== kind) source = "viewer";
    else if (typeof d.value === "string") source = d.from === "inferred" ? "model" : "code";
    else source = d.ask ? "ask" : "code";
    if (d.ask) asks.push(c);
    out[c.key] = { key: c.key, node, intent, kind, source, from: (doc.decisions![c.key]?.from as string) ?? undefined, p, cell: c };
  }
  return { values: out, asks };
}

/** The value a host reads: the kind's realize fields, for a node's intent. */
export function realized(tree: Tree, vals: Record<string, Value>, node: string, intent: string): Record<string, unknown> {
  const v = vals[key(node, intent)];
  return (v && tree.nodes.find((n) => n.id === node)?.intents[intent]?.kinds[v.kind]?.realize) ?? {};
}

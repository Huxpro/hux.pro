// =============================================================================
// decide: the one rule. What a cell is now, and who said so.
//
//   person    a person's decision for this cell
//   rule      a person's rule for every cell of this intent
//   author    the program's own pick (a constant the author wrote)
//   derived   a relation the program wrote (derive / follows)
//   viewer    a viewer's leaning, where nothing above said and the model
//             had no belief, or the leaning tipped it
//   model     a model's belief, sure enough (margin ≥ TAU)
//   code      otherwise: the likeliest kind, offered with the others
//   ask       otherwise, on an intent that asks: the likeliest kind for now,
//             and a question for a person
//
// Kinds a person ruled out are out at every level. A belief inferred under
// another context is still used (the value does not jump while a model
// re-infers) and marked `stale`, for a host to send back to a model.
// =============================================================================

import { argmax, margin, normalize, type Dist } from "./intent";
import { cells, type Cell, type Key, type Program } from "./program";
import { contextKey, kindOf, kindsOf, type Context, type Doc } from "./doc";

/** How sure a belief must be (best minus second best) to act on without asking. */
export const TAU = 0.2;
/** How much a viewer's leaning weighs against a model's belief. */
export const LEAN_WEIGHT = 6;

export type Source = "person" | "rule" | "author" | "derived" | "viewer" | "model" | "code" | "ask";

export interface Value<K extends string = string, D = unknown> {
  key: Key;
  thing: string;
  intent: string;
  kind: K;
  data: D;
  source: Source;
  /** Unsure, on an intent that asks: a question for a person. */
  ask: boolean;
  /** The belief it rests on (after rulings-out and leanings). */
  p: Dist;
  /** The value rests on a belief inferred under another context. */
  stale: boolean;
  /** Every kind the cell has now, learned ones included, and those ruled out. */
  kinds: readonly string[];
  not: readonly string[];
  /** How the person's decision was made, when it is theirs. */
  from?: string;
}

/** Every cell's value. A cell a part did not declare this run (an `if` around its hook) has none. */
export function values(program: Program, doc: Doc, ctx: Context = {}): Record<Key, Value> {
  const all = cells(program);
  const byKey = new Map(all.map((c) => [c.key, c]));
  const memo = new Map<Key, Value | null>();
  const busy = new Set<Key>();
  const under = contextKey(ctx);

  const read = (key: Key): string | undefined => get(key)?.kind;

  function get(key: Key): Value | null {
    if (memo.has(key)) return memo.get(key)!;
    const c = byKey.get(key);
    // A relation that reaches back to itself reads nothing there.
    if (!c || busy.has(key)) return null;
    busy.add(key);
    const v = decide(c);
    busy.delete(key);
    memo.set(key, v);
    return v;
  }

  function decide(c: Cell): Value {
    const kinds = kindsOf(c, doc);
    const d = doc.decisions[c.key];
    const not = d && typeof d.pick === "object" ? d.pick.not.filter((k) => kinds.includes(k)) : [];
    const open = (k: string | undefined): k is string => !!k && kinds.includes(k) && !not.includes(k);
    const b = doc.beliefs[c.key] ?? (c.decl.p ? { p: c.decl.p as Dist, under: "", by: "author" } : null);
    const stale = !!b && b.under !== under;
    // Code's prior when no model said: the first kind, the one the program was drawn with.
    const prior: Dist = Object.fromEntries(kinds.map((k, i) => [k, i === 0 ? 0.6 : 0.4 / Math.max(1, kinds.length - 1)]));
    const rest = (p: Dist) => normalize(Object.fromEntries(Object.entries(p).filter(([k]) => !not.includes(k))), kinds);
    let p = rest(b ? b.p : prior);
    const base: Omit<Value, "kind" | "source" | "data"> = { key: c.key, thing: c.thing.id, intent: c.decl.name, ask: false, p, stale, kinds, not };
    // Stale matters only where the value rests on the belief.
    const firm = (src: Source) => src === "person" || src === "rule" || src === "author" || src === "derived";
    const value = (kind: string, source: Source, extra: Partial<Value> = {}): Value => ({ ...base, p, kind, source, stale: stale && !firm(source), data: kindOf(c, doc, kind)?.data, ...extra });

    if (d && typeof d.pick === "string" && kinds.includes(d.pick)) return value(d.pick, "person", { from: d.from });
    const rule = doc.rules[c.decl.name];
    if (rule && typeof rule.pick === "string" && open(rule.pick)) return value(rule.pick, "rule", { from: rule.from });
    if (open(c.decl.pick)) return value(c.decl.pick, "author");
    const derived = c.decl.follows ? read(c.decl.follows) : c.decl.derive?.(read);
    if (open(derived)) return value(derived, "derived");

    const lean = ctx.lean?.[c.decl.name];
    if (open(lean) && !b) return value(lean, "viewer");
    if (open(lean)) {
      const before = argmax(p);
      p = normalize(Object.fromEntries(kinds.map((k) => [k, (p[k] ?? 0) * (k === lean ? LEAN_WEIGHT : 1)])), kinds);
      if (margin(p) >= TAU) return value(argmax(p)!, argmax(p) === before ? "model" : "viewer");
    }
    const best = argmax(p) ?? kinds[0];
    if (b && margin(p) >= TAU) return value(best, "model");
    return c.decl.resolve === "ask" ? value(best, "ask", { ask: true }) : value(best, "code");
  }

  const out: Record<Key, Value> = {};
  for (const c of all) {
    const v = get(c.key);
    if (v) out[c.key] = v;
  }
  return out;
}

/** The cells to ask a person about now. */
export const questions = (vals: Record<Key, Value>) => Object.values(vals).filter((v) => v.ask);

/** The cells whose belief was inferred under another context: what a model should look at again. */
export const staleCells = (vals: Record<Key, Value>) => Object.values(vals).filter((v) => v.stale);

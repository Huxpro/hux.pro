// =============================================================================
// The doc: everything said about a program after it was written. Plain data,
// so it can be saved, shared, diffed and undone. Three writers, one each:
//
//   narrow    a person     a kind for a cell, kinds ruled out, or a rule for
//                          every cell of an intent (scope "all"); null forgets
//   believe   a model      a distribution over a cell's kinds, held under the
//                          context it was inferred in (a cache, never a fact)
//   learn     a model      a kind more on a cell: the vocabulary grows by use
//
// Code is the third writer of values, but it writes nothing here: it is the
// program (prior, derive, the author's pick).
//
// When the program itself changes (a model rewrote it), `reconcile` keeps each
// decision wherever its cell and kind still are, and parks the rest
// (`suspended`) rather than dropping them: put the kind back and the decision
// is back. React keeps state by key; here the key is the cell's path.
// =============================================================================

import { cells, nameOf, type Cell, type Key, type Program } from "./program";
import type { Dist, Kind } from "./intent";

export type Pick = string | { not: string[] };

export interface Decision {
  pick: Pick;
  /** Who made it ("person", "viewer", …) and how ("dragged", "said", "answered"…). */
  by: string;
  from?: string;
}

export interface Belief {
  p: Dist;
  /** The context it was inferred under (contextKey): another context makes it stale. */
  under: string;
  by: string;
}

export interface Doc {
  decisions: Record<Key, Decision>;
  /** A person's rule for every cell of an intent, by the intent's name. */
  rules: Record<string, Decision>;
  beliefs: Record<Key, Belief>;
  learned: Record<Key, Record<string, Kind<unknown>>>;
  /** Decisions the program no longer has a place for, kept for when it does. */
  suspended: Record<Key, Decision>;
}

export const EMPTY_DOC: Doc = { decisions: {}, rules: {}, beliefs: {}, learned: {}, suspended: {} };

/** What a cell is seen in. Changing it recomputes; it decides nothing. */
export interface Context {
  /** Everything said to the program as a whole ("make it more oppressive"): beliefs are held under it. */
  prompts?: readonly string[];
  /** A viewer's leanings, by intent name: they tilt what nobody decided, and never override. */
  lean?: Readonly<Record<string, string>>;
  /** The thing on screen now: what a sentence about nothing in particular is about. */
  focus?: string;
}

export const contextKey = (ctx: Context) => (ctx.prompts ?? []).join("\n");

const without = <T>(o: Record<string, T>, k: string) => {
  const next = { ...o };
  delete next[k];
  return next;
};

export function narrow(doc: Doc, key: Key, pick: Pick | null, opts: { scope?: "here" | "all"; by?: string; from?: string } = {}): Doc {
  const { scope = "here", by = "person", from } = opts;
  if (scope === "all") {
    const name = nameOf(key);
    return { ...doc, rules: pick === null ? without(doc.rules, name) : { ...doc.rules, [name]: { pick, by, from } } };
  }
  if (pick === null) return { ...doc, decisions: without(doc.decisions, key), suspended: without(doc.suspended, key) };
  const prev = doc.decisions[key]?.pick;
  // Ruling out adds to what was ruled out; a kind replaces whatever was there.
  const next: Pick = typeof pick === "object" && prev && typeof prev === "object" ? { not: [...new Set([...prev.not, ...pick.not])] } : pick;
  return { ...doc, decisions: { ...doc.decisions, [key]: { pick: next, by, from } }, suspended: without(doc.suspended, key) };
}

export function believe(doc: Doc, key: Key, p: Dist, opts: { under: string; by?: string }): Doc {
  return { ...doc, beliefs: { ...doc.beliefs, [key]: { p, under: opts.under, by: opts.by ?? "model" } } };
}

export function learn(doc: Doc, key: Key, name: string, kind: Kind<unknown>): Doc {
  return { ...doc, learned: { ...doc.learned, [key]: { ...doc.learned[key], [name]: kind } } };
}

// -----------------------------------------------------------------------------
// The program changed.
// -----------------------------------------------------------------------------

export interface Reconciled {
  doc: Doc;
  kept: Key[];
  suspended: Key[];
  restored: Key[];
}

/** The kinds a cell has: the program's, then those learned since. */
export function kindsOf(c: Cell, doc: Doc): string[] {
  return [...c.decl.of.order, ...Object.keys(doc.learned[c.key] ?? {}).filter((k) => !(k in c.decl.of.kinds))];
}

/** A kind of a cell, written or learned. */
export function kindOf(c: Cell, doc: Doc, k: string): Kind<unknown> | undefined {
  return (c.decl.of.kinds as Record<string, Kind<unknown>>)[k] ?? doc.learned[c.key]?.[k];
}

function kindsIn(program: Program, doc: Doc, key: Key): string[] | null {
  const c = cells(program).find((x) => x.key === key);
  return c ? kindsOf(c, doc) : null;
}

const holds = (kinds: string[] | null, d: Decision) => !!kinds && (typeof d.pick === "string" ? kinds.includes(d.pick) : d.pick.not.some((k) => kinds.includes(k)));

export function reconcile(doc: Doc, next: Program): Reconciled {
  const decisions: Doc["decisions"] = {};
  const suspended: Doc["suspended"] = {};
  const out: Reconciled = { doc, kept: [], suspended: [], restored: [] };
  for (const [key, d] of Object.entries(doc.decisions)) {
    if (holds(kindsIn(next, doc, key), d)) {
      decisions[key] = d;
      out.kept.push(key);
    } else {
      suspended[key] = d;
      out.suspended.push(key);
    }
  }
  for (const [key, d] of Object.entries(doc.suspended)) {
    if (decisions[key] || suspended[key]) continue;
    if (holds(kindsIn(next, doc, key), d)) {
      decisions[key] = d;
      out.restored.push(key);
    } else suspended[key] = d;
  }
  out.doc = { ...doc, decisions, suspended };
  return out;
}

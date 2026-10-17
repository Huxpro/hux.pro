// =============================================================================
// The program as data: what the parts declared the last time they ran. Each
// part is a thing; each `useIntent` in it is one of its intents. A cell is a
// thing's intent, named by the path `thing.intent`. Its identity is that path,
// never an order of calls, so a model rewriting a part keeps it, and a hook
// may sit under an `if`.
//
// Nobody writes this by hand: parts write it by running (part.ts), and the
// root keeps it (root.ts). It is what a model is shown and what `values`,
// `reconcile`, `words` and `observe` read.
// =============================================================================

import type { Dist, IntentType } from "./intent";

/** A cell's path: `thing.intent`. */
export type Key = string;

/** Another cell's kind now (undefined: it has none yet, or is not declared). */
export type Read = (key: Key) => string | undefined;

/** How an intent is declared: everything `useIntent` takes after its label and type. */
export interface IntentOptions<K extends string = string> {
  label?: string;
  /** Words that name the intent itself ("帽子", "开得多快"). */
  aka?: readonly string[];
  /** The model's belief over the kinds, as it wrote the part. */
  p?: Partial<Record<K, number>>;
  /** When nothing is sure enough: ask a person, or pick and offer the rest. */
  resolve?: "ask" | "switch";
  /** The author's own pick: a constant in the program, under a person's. */
  pick?: K;
  /** A relation, written as code: the kind it takes from other cells' kinds (one it does not have is ignored). */
  derive?: (read: Read) => string | undefined;
  /** Sugar for a derive that copies another cell of the same type. */
  follows?: Key;
  /** The paths it moves in the picture: for a host's inspector. */
  view?: readonly string[];
}

export interface IntentDecl<K extends string = string, D = unknown> extends IntentOptions<K> {
  name: string;
  of: IntentType<K, D>;
  aka: readonly string[];
  resolve: "ask" | "switch";
}

export interface ThingDecl {
  id: string;
  label?: string;
  aka: readonly string[];
  intents: IntentDecl<string, unknown>[];
}

export interface Program {
  id: string;
  things: ThingDecl[];
}

/** Why a declaration cannot be read: a kind its type does not have. */
export function check(key: Key, d: IntentDecl<string, unknown>): string[] {
  const out: string[] = [];
  if (d.of.order.length < 2) out.push(`${key}: fewer than two kinds`);
  for (const k of Object.keys(d.p ?? {})) if (!(k in d.of.kinds)) out.push(`${key}: p names "${k}", not a kind`);
  if (d.pick !== undefined && !(d.pick in d.of.kinds)) out.push(`${key}: picks "${d.pick}", not a kind`);
  return out;
}

// -----------------------------------------------------------------------------
// Cells: one per (thing, intent).
// -----------------------------------------------------------------------------

export interface Cell {
  key: Key;
  thing: ThingDecl;
  decl: IntentDecl<string, unknown>;
}

export function cells(program: Program): Cell[] {
  return program.things.flatMap((thing) => thing.intents.map((decl) => ({ key: `${thing.id}.${decl.name}`, thing, decl })));
}

export function cellOf(program: Program, key: Key): Cell | undefined {
  return cells(program).find((c) => c.key === key);
}

export const nameOf = (key: Key) => key.slice(key.indexOf(".") + 1);

/**
 * The program's shape, as text: what changes when a model rewrites a part
 * (a cell, a kind, a belief), not what changes every run (a derive's closure).
 */
export function signature(program: Program): string {
  return JSON.stringify(
    program.things.map((t) => [t.id, t.intents.map((i) => [i.name, i.of.order, i.p ?? null, i.resolve, i.pick ?? null, i.follows ?? null, !!i.derive, i.label ?? null, i.aka])]),
  );
}

export type { Dist };

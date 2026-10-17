// =============================================================================
// The program: what a model (or an engineer) writes. Things, and on each the
// intents a person might want otherwise. Written in TSX, it evaluates to data:
//
//   /** @jsxImportSource reintent-core */
//   <Scene id="wardrobe">
//     <Thing id="man" aka={["他", "男人"]}>
//       <Intent name="hat" of={Size} p={{ big: 0.52, absurd: 0.44 }} resolve="ask" />
//     </Thing>
//   </Scene>
//
// A declaration is an element, not a hook: it has to be read (by a model, by
// `questions`, by a reviewer) without running anything. Code reads a cell's
// value through the root (`values`, or `useIntent` in a React host). A cell is
// a thing's intent, named by the path `thing.intent`; its identity is that
// path, never an order of calls, so a model rewriting the program keeps it.
// =============================================================================

import type { Dist, IntentType } from "./intent";

/** A cell's path: `thing.intent`. */
export type Key = string;

/** Another cell's kind now (undefined: it has none, or does not apply). */
export type Read = (key: Key) => string | undefined;

export interface IntentDecl<K extends string = string, D = unknown> {
  $: "intent";
  name: string;
  of: IntentType<K, D>;
  label?: string;
  /** Words that name the intent itself ("帽子", "开得多快"). */
  aka: readonly string[];
  /** The model's belief over the kinds, as it wrote the program. */
  p?: Partial<Record<K, number>>;
  /** When nothing is sure enough: ask a person, or pick and offer the rest. */
  resolve: "ask" | "switch";
  /** The author's own pick: a constant in the program, under a person's. */
  pick?: K;
  /** A relation, written as code: the kind it takes from other cells' kinds. */
  derive?: (read: Read) => K | undefined;
  /** Sugar for a derive that copies another cell of the same type. */
  follows?: Key;
  /** Whether the cell means anything, given other cells (absent: always). */
  when?: (read: Read) => boolean;
  /** The paths it moves in the picture: for a host's inspector. */
  view?: readonly string[];
}

export interface ThingDecl {
  $: "thing";
  id: string;
  label?: string;
  aka: readonly string[];
  /** Which library drawing it is, for the host. */
  draws?: string;
  intents: IntentDecl<string, unknown>[];
}

export interface Program {
  $: "program";
  id: string;
  title?: string;
  /** The words it was written from. */
  prompt?: string;
  /** Who wrote it ("model:strong", "person"…), and which version this is. */
  by?: string;
  version?: string;
  things: ThingDecl[];
}

// -----------------------------------------------------------------------------
// The components. Each is a function from props to a declaration; nesting is
// how a thing gets its intents. Any function returning these is a component
// too (a dream's <Beat>), and evaluating the tree is the whole compile.
// -----------------------------------------------------------------------------

export type Decl = Program | ThingDecl | IntentDecl<string, unknown> | null | undefined | false | readonly Decl[];
type Children = Decl;

const flat = (c: Children): (Program | ThingDecl | IntentDecl<string, unknown>)[] =>
  !c ? [] : Array.isArray(c) ? (c as readonly Decl[]).flatMap(flat) : [c as Program | ThingDecl | IntentDecl<string, unknown>];

export interface IntentProps<K extends string, D> {
  name: string;
  of: IntentType<K, D>;
  label?: string;
  aka?: readonly string[];
  p?: Partial<Record<NoInfer<K>, number>>;
  resolve?: "ask" | "switch";
  pick?: NoInfer<K>;
  derive?: (read: Read) => NoInfer<K> | undefined;
  follows?: Key;
  when?: (read: Read) => boolean;
  view?: readonly string[];
}

export function Intent<K extends string, D>({ aka = [], resolve = "switch", ...props }: IntentProps<K, D>): IntentDecl<K, D> {
  return { $: "intent", aka, resolve, ...props };
}

export function Thing({ id, label, aka = [], draws, children }: { id: string; label?: string; aka?: readonly string[]; draws?: string; children?: Children }): ThingDecl {
  const intents = flat(children).filter((d): d is IntentDecl<string, unknown> => d.$ === "intent");
  return { $: "thing", id, label, aka, draws, intents };
}

export function Scene({ children, ...props }: { id: string; title?: string; prompt?: string; by?: string; version?: string; children?: Children }): Program {
  const things = flat(children).filter((d): d is ThingDecl => d.$ === "thing");
  const program: Program = { $: "program", ...props, things };
  const problems = check(program);
  if (problems.length) throw new Error(`reintent: ${problems.join("; ")}`);
  return program;
}

/**
 * A program out of its TSX. Every JSX expression is typed `JSX.Element`
 * whatever its component returns, so this is where it becomes a `Program`
 * again (and is checked to be one).
 */
export function toProgram(decl: Decl): Program {
  if (!decl || Array.isArray(decl) || (decl as Program).$ !== "program") throw new Error("reintent: a program is a <Scene>");
  return decl as Program;
}

/** What makes a program unreadable: a path twice, a kind it does not have, a relation to nothing. */
export function check(program: Program): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of program.things) {
    if (seen.has(t.id)) out.push(`thing "${t.id}" twice`);
    seen.add(t.id);
    const names = new Set<string>();
    for (const i of t.intents) {
      const key = `${t.id}.${i.name}`;
      if (names.has(i.name)) out.push(`${key} twice`);
      names.add(i.name);
      if (i.of.order.length < 2) out.push(`${key}: fewer than two kinds`);
      for (const k of Object.keys(i.p ?? {})) if (!(k in i.of.kinds)) out.push(`${key}: p names "${k}", not a kind`);
      if (i.pick !== undefined && !(i.pick in i.of.kinds)) out.push(`${key}: picks "${i.pick}", not a kind`);
    }
  }
  const keys = new Set(cells(program).map((c) => c.key));
  for (const c of cells(program)) if (c.decl.follows && !keys.has(c.decl.follows)) out.push(`${c.key} follows ${c.decl.follows}, which is not a cell`);
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

export type { Dist };

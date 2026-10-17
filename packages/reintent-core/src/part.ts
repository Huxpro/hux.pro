// =============================================================================
// Parts: intents in, the world out.
//
//   const Man = part("man", { aka: ["他"] }, ({ pose }: { pose: Pose }) => {
//     const hat = useIntent("hat", Size, { p: { big: 0.52, absurd: 0.44 }, resolve: "ask" });
//     const stand = useIntent("stand", Place);
//     return <Figure at={stand.data.at} hatScale={hat.data.hatScale} {...pose} />;
//   });
//
// A part is a thing; each `useIntent` in it declares one of its intents and
// returns its value now (World = f(intents), as UI = f(state)). What a part
// returns is the host's business: JSX for a React host, anything at all for
// another. The hooks here are the core's own: they need a run (collect), not
// React, and they are known by their label, not by the order they are called
// in. So a hook may sit under an `if` (a cell that means something only
// sometimes), and a model may rewrite a part without moving anyone's
// decisions.
//
// A run is pure: `collect` reads (root.evaluate, root.view) and returns what
// the part declared and read, and declares nothing. Whoever commits holds it:
// `runPart` at once (headless), a React host in a layout effect (./react).
//
// Reading another part's cell (`useCell`, `read` in a derive) is reading
// sideways: until that part is held and flushed, there is nothing to read,
// and the reader runs again after (render() loops until the parts settle).
// =============================================================================

import type { Value } from "./decide";
import type { Effect } from "./effect";
import type { IntentType } from "./intent";
import { keyOf, type Root, type Scope, type ThingInfo } from "./root";
import type { IntentDecl, IntentOptions, Key, Read } from "./program";

export interface Part<P = Record<string, never>, R = unknown> {
  id: string;
  label?: string;
  aka?: readonly string[];
  render: (props: P) => R;
}

export function part<P = Record<string, never>, R = unknown>(id: string, meta: Omit<ThingInfo, "id">, render: (props: P) => R): Part<P, R> {
  return { id, ...meta, render };
}

/** What a run of a part came to: its world, what it declared, and every cell it read. */
export interface Run<R> {
  out: R;
  thing: ThingInfo;
  decls: IntentDecl<string, unknown>[];
  reads: Key[];
}

interface RunFrame {
  root: Root;
  thing: ThingInfo;
  scope?: Scope;
  decls: IntentDecl<string, unknown>[];
  /** This run's own values, as it declared them. */
  own: Record<Key, Value>;
  reads: Set<Key>;
}

let current: RunFrame | null = null;

function frame(): RunFrame {
  if (!current) throw new Error("reintent: a hook outside a part (run it with runPart, render, or a host binding)");
  return current;
}

/** Run a part without declaring anything: what it returns, declares and reads. */
export function collect<P, R>(root: Root, p: Part<P, R>, props: P, opts: { id?: string; scope?: Scope } = {}): Run<R> {
  const thing: ThingInfo = { id: opts.id ?? p.id, label: p.label, aka: p.aka };
  const f: RunFrame = { root, thing, scope: opts.scope, decls: [], own: {}, reads: new Set() };
  const prev = current;
  current = f;
  try {
    const out = p.render(props);
    return { out, thing, decls: f.decls, reads: [...f.reads] };
  } finally {
    current = prev;
  }
}

/** Run a part and hold what it declared, at once (no host to commit for it). */
export function runPart<P, R>(root: Root, p: Part<P, R>, props: P, id = p.id): R {
  const r = collect(root, p, props, { id });
  root.hold(`run:${id}`, r.thing, r.decls);
  return r.out;
}

/** Declare an intent of this part, and read its value now. */
export function useIntent<K extends string, D>(label: string, of: IntentType<K, D>, opts: IntentOptions<NoInfer<K>> = {}): Value<K, D> {
  const f = frame();
  if (f.decls.some((d) => d.name === label)) throw new Error(`reintent: ${keyOf(f.thing.id, label)} declared twice in one run`);
  const decl: IntentDecl<K, D> = { ...opts, name: label, of, aka: opts.aka ?? [], resolve: opts.resolve ?? "switch" };
  const v = f.root.evaluate(f.thing, decl, f.scope, f.decls);
  const key = keyOf(f.thing.id, label);
  f.decls.push(decl as unknown as IntentDecl<string, unknown>);
  f.own[key] = v;
  f.reads.add(key);
  return v;
}

/** An intent whose kind is a relation to other cells (code is its writer, under a person's). */
export function useDerived<K extends string, D>(label: string, of: IntentType<K, D>, derive: (read: Read) => string | undefined, opts: Omit<IntentOptions<NoInfer<K>>, "derive"> = {}): Value<K, D> {
  return useIntent(label, of, { ...opts, derive });
}

/** Another part's cell, read sideways. Undefined until that part is held and flushed. */
export function useCell<K extends string, D>(key: Key, of?: IntentType<K, D>): Value<K, D> | undefined {
  void of;
  const f = frame();
  f.reads.add(key);
  return (f.own[key] ?? f.root.view(f.scope)[key]) as Value<K, D> | undefined;
}

/** A lazy effect's world for the values now: eager until a model's is written. */
export function useLazy<W>(fx: Effect<W>) {
  const f = frame();
  return fx.get({ ...f.root.view(f.scope), ...f.own });
}

/**
 * Run parts with no host until what they declare and read settles (a part
 * that read a cell before it was declared runs again). Their outputs, last run.
 */
export function render(root: Root, parts: readonly (Part<Record<string, never>, unknown> | [Part<never, unknown>, unknown, string?])[], maxPasses = 4): unknown[] {
  let out: unknown[] = [];
  for (let pass = 0; pass < maxPasses; pass++) {
    const before = root.get();
    out = parts.map((x) => (Array.isArray(x) ? runPart(root, x[0] as Part<unknown, unknown>, x[1], x[2]) : runPart(root, x, {} as Record<string, never>)));
    root.flush();
    if (root.get() === before) break;
  }
  return out;
}

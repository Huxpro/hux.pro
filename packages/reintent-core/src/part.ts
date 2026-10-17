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
// another. The hooks are the core's own: they need a frame (runPart), not
// React, and they are known by their label, not by the order they are called
// in. So a hook may sit under an `if` (a cell that means something only
// sometimes), and a model may rewrite a part without moving anyone's
// decisions.
//
// Reading another part's cell (`useCell`, `read` in a derive) is reading
// sideways: until that part has run, there is nothing to read, and the flush
// after the run makes the reader run again.
// =============================================================================

import type { Value } from "./decide";
import type { Effect } from "./effect";
import type { IntentType } from "./intent";
import type { IntentOptions, Key, Read } from "./program";
import type { Frame, Root, ThingInfo } from "./root";

export interface Part<P = Record<string, never>, R = unknown> {
  id: string;
  label?: string;
  aka?: readonly string[];
  render: (props: P) => R;
}

export function part<P = Record<string, never>, R = unknown>(id: string, meta: Omit<ThingInfo, "id">, render: (props: P) => R): Part<P, R> {
  return { id, ...meta, render };
}

let current: Frame | null = null;

function frame(): Frame {
  if (!current) throw new Error("reintent: a hook outside a part (run it with runPart, render, or a host binding)");
  return current;
}

/** Run a part once, its hooks registering with `root`. `id` names this instance (default: the part's own). */
export function runPart<P, R>(root: Root, p: Part<P, R>, props: P, id = p.id): R {
  const prev = current;
  const f = root.frame({ id, label: p.label, aka: p.aka });
  current = f;
  try {
    return p.render(props);
  } finally {
    f.end();
    current = prev;
  }
}

/** Declare an intent of this part, and read its value now. */
export function useIntent<K extends string, D>(label: string, of: IntentType<K, D>, opts: IntentOptions<NoInfer<K>> = {}): Value<K, D> {
  return frame().intent({ ...opts, name: label, of, aka: opts.aka ?? [], resolve: opts.resolve ?? "switch" });
}

/** An intent whose kind is a relation to other cells (code is its writer, under a person's). */
export function useDerived<K extends string, D>(label: string, of: IntentType<K, D>, derive: (read: Read) => string | undefined, opts: Omit<IntentOptions<NoInfer<K>>, "derive"> = {}): Value<K, D> {
  return useIntent(label, of, { ...opts, derive });
}

/** Another part's cell, read sideways. Undefined until that part has run. */
export function useCell<K extends string, D>(key: Key, of?: IntentType<K, D>): Value<K, D> | undefined {
  void of;
  return frame().value(key) as Value<K, D> | undefined;
}

/** A lazy effect's world for the values now: eager until a model's is written. */
export function useLazy<W>(fx: Effect<W>) {
  return fx.get(frame().values());
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

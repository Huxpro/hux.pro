// =============================================================================
// effect: values → a world, two ways.
//
//   eager   code: instant, always there (a placeholder, a drawing from a library)
//   lazy    a model: later, better (a drawing, a line of narration, a sound)
//
// A lazy result is cached under the kinds of the cells it depends on, as they
// were when it was asked for. It is shown only while those kinds hold; one
// written for other kinds is kept, not shown, so undoing a decision brings
// its drawing back. A miss shows the eager world and asks for a lazy one,
// once per assignment, the first time included.
// =============================================================================

import type { Key } from "./program";
import type { Value } from "./decide";

export type Under = Record<Key, string>;

export interface Written<W> {
  world: W;
  under: Under;
}

export interface Effect<W> {
  /** The world for these values: written, or eager while one is pending. */
  get(values: Record<Key, Value>): { world: W; source: "written" | "eager"; pending: boolean };
  /** Every world written so far, newest first. */
  written(): readonly Written<W>[];
  /** A written world arrived. */
  subscribe(fn: () => void): () => void;
}

export function effect<W>(o: {
  /** The cells it depends on: its cache is keyed by their kinds. */
  deps: readonly Key[];
  eager(under: Under): W;
  lazy?(under: Under): Promise<W | null>;
  /** Worlds written before (saved ones): newest first. */
  initial?: readonly Written<W>[];
}): Effect<W> {
  let cache: Written<W>[] = [...(o.initial ?? [])];
  const asked = new Set<string>();
  const subs = new Set<() => void>();
  const underOf = (vals: Record<Key, Value>): Under => Object.fromEntries(o.deps.flatMap((k) => (vals[k] ? [[k, vals[k].kind]] : [])));
  const same = (a: Under, b: Under) => o.deps.every((k) => a[k] === b[k]);
  return {
    get(vals) {
      const under = underOf(vals);
      const hit = cache.find((w) => same(w.under, under));
      if (hit) return { world: hit.world, source: "written", pending: false };
      const id = JSON.stringify(under);
      if (o.lazy && !asked.has(id)) {
        asked.add(id);
        o.lazy(under).then(
          (world) => {
            if (world === null) return;
            cache = [{ world, under }, ...cache];
            subs.forEach((fn) => fn());
          },
          () => asked.delete(id),
        );
      }
      return { world: o.eager(under), source: "eager", pending: !!o.lazy && asked.has(id) };
    },
    written: () => cache,
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

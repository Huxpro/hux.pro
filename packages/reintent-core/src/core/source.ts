/* eslint-disable @typescript-eslint/no-explicit-any -- ported as written (Huxpro/airtalk#845) */
/**
 * Where what writers said is kept. The core reads through `Source`; a host can back it with its
 * own document (a Yjs tree, YSML). `createSource` is a plain in-memory one.
 *
 * Writes are idempotent: writing a value sets it, writing `undefined` clears it. A person's
 * decision at the deck scope is written by the intent's name and read by every intent of that
 * name (`write('fit', 'human', 'fill', { scope: 'deck' })`). There is no
 * undo here: undo is the host's history going back to an earlier value.
 */
import type { Dist, Said, Scope, Writer } from './value';

/**
 * One intent's stored values. `path` is the intent's identity (`Slide:gallery/Row:g0,g1,g2#arrange`).
 * `learned`: kinds a model added after the program was written (kind → what the host keeps about it).
 */
export type Entry = { human?: Said<unknown>; model?: Said<Dist>; learned?: Record<string, unknown> };

export type Change = { path?: string; name?: string; scope?: string };

export interface Source {
  get(path: string): Entry | undefined;
  /** A person's decision about every intent of this name in the deck. */
  deck(name: string): Said<unknown> | undefined;
  /** Whether what is inside this scope is held elsewhere and not loaded here. */
  unknown(scope: string): boolean;
  /** Paths a person has decided. */
  decided(): string[];
  subscribe(fn: (c: Change) => void): () => void;
}

export interface WritableSource extends Source {
  /** `target` is an intent's path, or with `{ scope: 'deck' }` an intent's name (a person's only). */
  write(target: string, by: Writer, value: unknown, opts?: { scope?: Scope }): void;
  /** A kind a model learned for this intent (`undefined` forgets it): the program's kinds grow by use. */
  learn(path: string, kind: string, about: unknown): void;
  setUnknown(scope: string, unknown: boolean): void;
  /** Several writes, one notification each after all of them. */
  batch(fn: () => void): void;
  snapshot(): { entries: Record<string, Entry>; deck: Record<string, unknown> };
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function createSource(init: { entries?: Record<string, Entry>; deck?: Record<string, unknown> } = {}) {
  const entries = new Map(Object.entries(structuredClone(init.entries ?? {})));
  const deck = new Map(Object.entries(structuredClone(init.deck ?? {})));
  const unknownScopes = new Set<string>();
  const subs = new Set<(c: Change) => void>();
  let queue: Change[] | null = null;
  const emit = (c: Change) => (queue ? queue.push(c) : subs.forEach((f) => f(c)));

  const src: WritableSource = {
    get: (path) => entries.get(path),
    deck: (name) => deck.get(name) as Said<unknown> | undefined,
    unknown: (scope) => [...unknownScopes].some((s) => scope === s || scope.startsWith(s + '/')),
    decided: () => [...entries].filter(([, e]) => e.human !== undefined).map(([p]) => p),
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    write(target, by, value, opts = {}) {
      if (opts.scope === 'deck') {
        if (by !== 'human') throw new Error('only a person decides for the whole deck');
        if (same(deck.get(target), value)) return;
        if (value === undefined) deck.delete(target);
        else deck.set(target, value);
        emit({ name: target });
        return;
      }
      const path = target;
      const e = { ...entries.get(path) };
      if (same(e[by], value)) return;
      if (value === undefined) delete e[by];
      else e[by] = value as any;
      if (Object.keys(e).length) entries.set(path, e);
      else entries.delete(path);
      emit({ path });
    },
    learn(path, kind, about) {
      const e = { ...entries.get(path) };
      const learned = { ...e.learned };
      if (same(learned[kind], about)) return;
      if (about === undefined) delete learned[kind];
      else learned[kind] = about;
      if (Object.keys(learned).length) e.learned = learned;
      else delete e.learned;
      if (Object.keys(e).length) entries.set(path, e);
      else entries.delete(path);
      emit({ path });
    },
    setUnknown(scope, unknown) {
      if (unknownScopes.has(scope) === unknown) return;
      if (unknown) unknownScopes.add(scope);
      else unknownScopes.delete(scope);
      emit({ scope });
    },
    batch(fn) {
      const outer = queue;
      queue = outer ?? [];
      try {
        fn();
      } finally {
        if (!outer) {
          const q = queue;
          queue = null;
          q.forEach((c) => subs.forEach((f) => f(c)));
        }
      }
    },
    snapshot: () => ({ entries: Object.fromEntries(entries), deck: Object.fromEntries(deck) }),
  };
  return src;
}

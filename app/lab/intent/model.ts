"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { batch, cells, computed, effect, intents, same, signal, untracked } from "reintent";
import type { Params } from "stage";
import { BELIEFS, PRESET, settle, tallness, type Screen, type Value } from "./forget";
import { compile, keyOf, typesOf, type IntentNode, type Tree } from "./tree";

// =============================================================================
// The Intent Lab's state, one way round:
//
//   state     the intent tree (data), a person's decisions and preferences,
//             a model's beliefs. Changed only by `dispatch(action)`.
//   compute   reintent on signals: each node's kind on a screen is a
//             computed over its decision, preference, belief and the screen;
//             a screen's props are a computed over its nodes (compile).
//   view      React reads computeds with `useValue`; a screen re-renders only
//             when its own value changes.
//
// Actions are what any event comes to: a gesture a recognizer knows, a
// prompt a model read, an answer, an undo. ./events.ts makes them.
// =============================================================================

export type Decision = { pick: unknown; from?: string };
type Read<T> = () => T;

/** How a person (or a model, on their behalf) came to a decision. */
export type From = "switched" | "asked" | "dragged" | "prompted";

export type Action =
  /** A kind for one node, here (an indexed node moves its crossover to this screen). */
  | { type: "decide"; key: string; kind: string; from: From; screen: Screen }
  | { type: "forget"; key: string }
  /** A model's distributions: weighed under any person's decision, never over it. */
  | { type: "believe"; beliefs: { key: string; p: Record<string, number> }[] }
  /** A node a model wrote (replacing one about the same thing), and optionally its kind here. */
  | { type: "add"; node: IntentNode; kind?: string; from?: From; screen?: Screen }
  /** A whole new tree. Decisions about nodes it keeps stay. */
  | { type: "replace"; tree: Tree };

/** Who has the say over a value on a screen. */
export type Who = "person" | "pref" | "model" | "code";

export interface IntentView {
  key: string;
  node: IntentNode;
  /** What reintent said: a kind, or a Defer for code. */
  raw: Value;
  /** The kind it comes to on this screen. */
  kind: string;
  who: Who;
  /** How a person decided it, when one did. */
  how?: string;
  /** A model said what, code said where (an indexed node left on `auto`). */
  where?: "code" | "person";
  asks: boolean;
}

function createStore() {
  const decisions = new Map<string, ReturnType<typeof signal>>();
  const decision = (key: string) => {
    if (!decisions.has(key)) decisions.set(key, signal(undefined));
    return decisions.get(key)!;
  };
  const prefs = new Map<string, ReturnType<typeof signal>>();
  const pref = (type: string) => {
    if (!prefs.has(type)) prefs.set(type, signal(undefined));
    return prefs.get(type)!;
  };
  const decided = signal(new Set<string>());
  const touch = (key: string, on: boolean) => {
    const next = new Set(decided.peek() as Set<string>);
    if (on) next.add(key);
    else next.delete(key);
    decided.set(next);
  };
  return {
    decision,
    pref,
    decided,
    decide: (key: string, d: Decision) => batch(() => (decision(key).set(d), touch(key, true))),
    forget: (key: string) => batch(() => (decision(key).set(undefined), touch(key, false))),
    prefer: (type: string, d: Decision | undefined) => pref(type).set(d),
    /** Every decision now, as stored. */
    snapshot: (): Record<string, Decision> =>
      Object.fromEntries(
        [...(decided() as Set<string>)].map((k) => [k, decision(k)() as Decision]).filter(([, d]) => d),
      ),
    restore(snap: Record<string, Decision>) {
      batch(() => {
        for (const [k, s] of decisions) s.set(snap[k]);
        for (const [k, d] of Object.entries(snap)) decision(k).set(d);
        decided.set(new Set(Object.keys(snap)));
      });
    },
  };
}

type Beliefs = Record<string, { p: Record<string, number> }>;
type Snapshot = { tree: Tree; beliefs: Beliefs; decisions: Record<string, Decision> };

const indexOf = (_by: "tallness", ctx: unknown) => tallness(ctx as Screen);

export function createLab(preset: Tree = PRESET, beliefsAtFirst: Beliefs = BELIEFS) {
  const store = createStore();
  const tree = signal(preset);
  const beliefs = signal(beliefsAtFirst);
  const history = signal([] as Snapshot[]);

  // reintent over the tree as it is now: rebuilt when the tree or a belief changes; the decisions are the store's.
  const core = computed(() => {
    const t = tree() as Tree;
    const T = typesOf(t, indexOf);
    const cs = cells(T, {});
    const I = intents(T, { cells: cs, source: store, beliefs: beliefs() as Beliefs, key: (s: Screen) => s.id });
    return { I, byKey: new Map(t.map((n) => [keyOf(n), n])) };
  });
  type Core = { I: ReturnType<typeof intents>; byKey: Map<string, IntentNode> };

  const memo = new Map<string, Read<unknown>>();
  const per = <T,>(name: string, s: Screen, make: () => Read<T>) => {
    const id = `${name}|${s.id}`;
    if (!memo.has(id)) memo.set(id, make());
    return memo.get(id) as Read<T>;
  };

  /** One node on one screen: its kind, who said it, whether to ask. */
  const view = (key: string, s: Screen): Read<IntentView | null> =>
    per(`view:${key}`, s, () =>
      computed(
        (): IntentView | null => {
          const { I, byKey } = core() as Core;
          const node = byKey.get(key);
          if (!node) return null;
          const x = I.intent(key);
          const raw = x.at(s)() as Value;
          const firm = x.firm() as string | undefined;
          const d = x.decision() as Decision | undefined;
          const believed = !!(beliefs() as Beliefs)[key];
          const named = typeof raw === "string" || !!(raw as { below?: string } | undefined)?.below;
          const who: Who = firm === "person" ? "person" : firm === "pref" ? "pref" : believed && named ? "model" : "code";
          const at = (d?.pick as { at?: unknown } | undefined)?.at;
          return {
            key,
            node,
            raw,
            kind: settle(node, raw, s),
            who,
            ...(d ? { how: d.from } : {}),
            ...(node.index ? { where: typeof at === "number" ? "person" : "code" } : {}),
            asks: x.asks(s)() as boolean,
          };
        },
        { equals: same },
      ),
    );

  /** A screen's props: the scene's, with every node's kind compiled over them. */
  const params = (s: Screen): Read<Params> =>
    per("params", s, () =>
      computed(
        () => {
          const t = tree() as Tree;
          const chosen: Record<string, string> = {};
          for (const n of t) {
            const v = view(keyOf(n), s)();
            if (v) chosen[keyOf(n)] = v.kind;
          }
          return compile(t, chosen);
        },
        { equals: same },
      ),
    );

  const keys = computed(() => (tree() as Tree).map(keyOf), { equals: same }) as Read<string[]>;
  const questions = (s: Screen) =>
    per("questions", s, () => computed(() => keys().filter((k) => view(k, s)()?.asks), { equals: same })) as Read<string[]>;

  const record = () =>
    history.set([
      ...(history.peek() as Snapshot[]),
      { tree: tree.peek() as Tree, beliefs: beliefs.peek() as Beliefs, decisions: untracked(store.snapshot) },
    ]);

  /** The reducer: every change to the state is one of these. */
  function dispatch(a: Action) {
    record();
    batch(() => {
      if (a.type === "decide") {
        (untracked(core) as Core).I.intent(a.key).resolve(a.kind, a.screen, { from: a.from });
      } else if (a.type === "forget") store.forget(a.key);
      else if (a.type === "believe") {
        const next = { ...(beliefs.peek() as Beliefs) };
        for (const b of a.beliefs) next[b.key] = { p: b.p };
        beliefs.set(next);
      } else if (a.type === "add") {
        const key = keyOf(a.node);
        tree.set([...(tree.peek() as Tree).filter((n) => keyOf(n) !== key), a.node]);
        // A node rewritten: what was decided about the old one no longer names its kinds.
        store.forget(key);
      } else if (a.type === "replace") tree.set(a.tree);
    });
    // The new node's kind, decided against reintent as rebuilt for it.
    if (a.type === "add" && a.kind && a.screen) {
      (untracked(core) as Core).I.intent(keyOf(a.node)).resolve(a.kind, a.screen, { from: a.from ?? "prompted" });
    }
  }

  return {
    store,
    tree: tree as Read<Tree>,
    keys,
    view,
    params,
    questions,
    dispatch,
    history: history as Read<Snapshot[]>,
    undo() {
      const h = history.peek() as Snapshot[];
      if (!h.length) return;
      const last = h[h.length - 1];
      batch(() => {
        tree.set(last.tree);
        beliefs.set(last.beliefs);
        store.restore(last.decisions);
      });
      history.set(h.slice(0, -1));
    },
    reset() {
      record();
      batch(() => {
        tree.set(preset);
        beliefs.set(beliefsAtFirst);
        store.restore({});
      });
    },
    /** What would be stored: a person's decisions, nothing else. */
    stored: computed(() => store.snapshot(), { equals: same }) as Read<Record<string, Decision>>,
    /** The nodes a model wrote: stored too, beside the scene, until a person forgets them. */
    written: computed(() => (tree() as Tree).filter((n) => n.from === "model"), { equals: same }) as Read<Tree>,
  };
}

export type Lab = ReturnType<typeof createLab>;

/** A signal or computed, read by a component: it re-renders when that value changes. */
export function useValue<T>(read: Read<T>): T {
  const subscribe = useCallback((notify: () => void) => effect(() => (read(), notify())), [read]);
  return useSyncExternalStore(subscribe, () => untracked(read) as T, () => untracked(read) as T);
}

/** One lab for the page's life. */
export function useLab() {
  const [lab] = useState(() => createLab());
  return lab;
}

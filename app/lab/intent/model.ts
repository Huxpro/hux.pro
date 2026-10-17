"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { batch, cells, computed, effect, intents, same, signal, untracked } from "reintent";
import type { Params } from "stage";
import { BELIEFS, PRESET, settle, tallness, type Screen, type Value } from "./forget";
import { compile, keyOf, learn, typesOf, type Gesture, type IntentNode, type Tree } from "./tree";
export type { Gesture };

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
  /** A whole new tree (a model re-authored it), and its beliefs. Decisions stay where their node and kind still exist. */
  | { type: "replace"; tree: Tree; beliefs?: Record<string, { p: Record<string, number> }> }
  /** A phrase or gesture that means a kind, learned from a model's answer: the next time, a short path. */
  | { type: "learn"; key: string; kind: string; phrase?: string; gesture?: Gesture };

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

/** A direction the model already sees: one intent flipped to a kind it is not now, and how likely the model thinks it. */
export interface Direction {
  key: string;
  node: IntentNode;
  kind: string;
  p: number;
  /** The likelihood is a model's belief (else code's prior). */
  believed: boolean;
}

/** Code's choice where reintent defers: a dream's own (forget's crosses its window over), or the scene as written. */
export type Settle = (node: IntentNode, v: Value, s: Screen) => string;

export function createLab(
  preset: Tree = PRESET,
  beliefsAtFirst: Beliefs = BELIEFS,
  decisionsAtFirst: Record<string, Decision> = {},
  settleWith: Settle = settle,
) {
  const store = createStore();
  store.restore(decisionsAtFirst);
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
            kind: settleWith(node, raw, s),
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

  /**
   * The directions the model already sees on a screen: every intent's kinds
   * but the one it is now, by how likely the model holds each (its belief
   * where it has one, code's prior where not), likeliest first. One flip
   * each; everything else as it is.
   */
  const directions = (s: Screen) =>
    per("directions", s, () =>
      computed(
        (): Direction[] => {
          const { I } = core() as Core;
          const out: Direction[] = [];
          for (const key of keys()) {
            const v = view(key, s)();
            if (!v) continue;
            const p = I.belief(key) as Record<string, number>;
            const believed = !!(beliefs() as Beliefs)[key];
            for (const kind of Object.keys(v.node.kinds)) if (kind !== v.kind) out.push({ key, node: v.node, kind, p: p[kind] ?? 0, believed });
          }
          return out.sort((a, b) => b.p - a.p || Number(b.believed) - Number(a.believed));
        },
        { equals: same },
      ),
    ) as Read<Direction[]>;
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
        const was = (tree.peek() as Tree).find((n) => keyOf(n) === key);
        // An intent extended stays where it was; a new one goes last.
        tree.set(was ? (tree.peek() as Tree).map((n) => (n === was ? a.node : n)) : [...(tree.peek() as Tree), a.node]);
        // What was decided about it still holds, unless a kind it named is gone.
        if (was && Object.keys(was.kinds).some((k) => !(k in a.node.kinds))) store.forget(key);
      } else if (a.type === "replace") {
        // A re-authored tree keeps what was learned (the old vocabulary, for kinds it still has) and the
        // intents added for this person's events, unless it covers the same thing itself.
        const old = new Map((tree.peek() as Tree).map((n) => [keyOf(n), n]));
        const keys = new Set(a.tree.map(keyOf));
        const merged = a.tree.map((n) => {
          const was = old.get(keyOf(n));
          if (!was) return n;
          let out = n;
          for (const kind of Object.keys(n.kinds)) {
            for (const phrase of was.say?.[kind] ?? []) out = learn(out, kind, { phrase });
            for (const gesture of was.gestures?.[kind] ?? []) out = learn(out, kind, { gesture });
          }
          return out;
        });
        const next = [...merged, ...[...old.values()].filter((n) => n.from === "model" && !keys.has(keyOf(n)))];
        tree.set(next);
        if (a.beliefs) beliefs.set(a.beliefs);
        const byKey = new Map(next.map((n) => [keyOf(n), n]));
        for (const [key, d] of Object.entries(untracked(store.snapshot) as Record<string, Decision>)) {
          const node = byKey.get(key);
          const pick = d.pick as string | { base?: string; below?: string | null };
          const kinds = typeof pick === "string" ? [pick] : [pick.base, pick.below].filter((k): k is string => !!k);
          if (!node || kinds.some((k) => !(k in node.kinds))) store.forget(key);
        }
      } else if (a.type === "learn") {
        tree.set((tree.peek() as Tree).map((n) => (keyOf(n) === a.key ? learn(n, a.kind, a) : n)));
      }
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
    directions,
    /**
     * What every screen would be if this happened: the state forked, the action
     * applied to the fork, nothing committed. A preview reads it.
     */
    whatIf(a: Action): (s: Screen) => Params {
      const fork = createLab(tree.peek() as Tree, beliefs.peek() as Beliefs, untracked(store.snapshot) as Record<string, Decision>, settleWith);
      fork.dispatch(a);
      return (s: Screen) => fork.params(s)();
    },
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

/** One lab for the page's life (the page keys it by dream). */
export function useLab(preset?: Tree, beliefs?: Beliefs, settleWith?: Settle) {
  const [lab] = useState(() => createLab(preset, beliefs, {}, settleWith));
  return lab;
}

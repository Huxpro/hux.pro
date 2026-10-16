"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { batch, cells, computed, effect, intents, same, signal, untracked } from "reintent";
import type { Params } from "stage";
import { BELIEFS, INTENT_TYPES, KEY, TYPES, compile, settle, type IntentType, type Screen, type Value } from "./forget";

// =============================================================================
// The Intent Lab's three layers, as in airtalk's reintent lab (v3):
//
//   data      what people decided: one signal per cell, and per type for a
//             preference. The only state that would be stored.
//   compute   reintent on signals: an intent's value on a screen is a
//             computed over the decision, the preference, the model's belief
//             and the screen; a screen's props are a computed over its four.
//   view      React reads computeds with `useValue`; a screen re-renders only
//             when its own value changes.
// =============================================================================

export type Decision = { pick: unknown; from?: string };
type Read<T> = () => T;

/** Who has the say over a value on a screen. */
export type Who = "person" | "pref" | "model" | "code";

export interface IntentView {
  type: IntentType;
  /** What reintent said: a kind, or a Defer for code. */
  raw: Value;
  /** The kind it comes to on this screen. */
  kind: string;
  who: Who;
  /** A model said what, code said where (an indexed type on `auto`). */
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

const whoOf = (from: string | undefined, firm: string | undefined): Who =>
  firm === "person" ? "person" : firm === "pref" ? "pref" : from === "inferred" ? "model" : "code";

export function createLab() {
  const store = createStore();
  const cs = cells(TYPES, {});
  const I = intents(TYPES, { cells: cs, source: store, beliefs: BELIEFS, key: (s: Screen) => s.id });
  const history = signal([] as Record<string, Decision>[]);
  const record = () => history.set([...(history.peek() as Record<string, Decision>[]), untracked(store.snapshot)]);

  const memo = new Map<string, Read<unknown>>();
  const per = <T,>(name: string, s: Screen, make: () => Read<T>) => {
    const id = `${name}|${s.id}`;
    if (!memo.has(id)) memo.set(id, make());
    return memo.get(id) as Read<T>;
  };

  /** One intent on one screen: its value, who said it, whether to ask. */
  const view = (type: IntentType, s: Screen): Read<IntentView> =>
    per(`view:${type}`, s, () =>
      computed(
        (): IntentView => {
          const x = I.intent(KEY[type]);
          const raw = x.at(s)() as Value;
          const firm = x.firm() as string | undefined;
          const d = x.decision() as Decision | undefined;
          const from = fromOf(type, raw, d);
          const pickAt = (d?.pick as { at?: unknown } | undefined)?.at;
          return {
            type,
            raw,
            kind: settle(type, raw, s),
            who: whoOf(from, firm),
            ...(type === "axis" ? { where: typeof pickAt === "number" ? "person" : "code" } : {}),
            asks: x.asks(s)() as boolean,
          };
        },
        { equals: same },
      ),
    );

  /** A screen's props: the scene's, with its four intents compiled over them. */
  const params = (s: Screen): Read<Params> =>
    per("params", s, () =>
      computed(
        () => compile(Object.fromEntries(INTENT_TYPES.map((t) => [t, view(t, s)().kind])) as Record<IntentType, string>),
        { equals: same },
      ),
    );

  return {
    store,
    history: history as Read<Record<string, Decision>[]>,
    view,
    params,
    questions: (s: Screen) => I.questions(s) as Read<{ key: string; type: IntentType }[]>,
    /** A person chose `kind` for `type` on screen `s`. */
    choose(type: IntentType, kind: string, s: Screen, from: "switched" | "asked" = "switched") {
      record();
      I.intent(KEY[type]).resolve(kind, s, { from });
    },
    forget(type: IntentType) {
      record();
      I.intent(KEY[type]).forget();
    },
    undo() {
      const h = history.peek() as Record<string, Decision>[];
      if (!h.length) return;
      store.restore(h[h.length - 1]);
      history.set(h.slice(0, -1));
    },
    reset() {
      record();
      store.restore({});
    },
    /** What would be stored: a person's decisions, nothing else. */
    stored: computed(() => store.snapshot(), { equals: same }) as Read<Record<string, Decision>>,
  };
}

/**
 * Who said a value, from the value itself and the decision: reintent's
 * `decide` names it (`resolved`, `inferred`, `code`, `unsure`); its `from` is
 * read the same way here without asking it twice.
 */
function fromOf(type: IntentType, raw: Value, d: Decision | undefined): string {
  if (d) return d.from ?? "resolved";
  if (typeof raw === "string") return "inferred";
  // A Defer: on an indexed type, a model's sure belief named the low end.
  return type === "axis" && raw?.below ? "inferred" : "code";
}

export type Lab = ReturnType<typeof createLab>;

/** A signal or computed, read by a component: it re-renders when that value changes. */
export function useValue<T>(read: Read<T>): T {
  const subscribe = useCallback((notify: () => void) => effect(() => (read(), notify())), [read]);
  return useSyncExternalStore(subscribe, () => untracked(read) as T, () => untracked(read) as T);
}

/** One lab for the page's life. */
export function useLab() {
  const [lab] = useState(createLab);
  return lab;
}

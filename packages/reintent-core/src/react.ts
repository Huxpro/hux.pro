// =============================================================================
// The React binding: Reintent as a React state library. The core never
// imports this; a host that renders with React does.
//
//   <ReintentRoot root={root}>
//     <Thing id="man" aka={["他"]}>
//       <ManFigure />        any component: useIntent("hat", Size, …) inside
//     </Thing>
//     <WardrobeView />       const WardrobeView = reactPart(Wardrobe)
//   </ReintentRoot>
//
// Render reads, commit declares, as React wants:
//
//   render   a hook's value is root.evaluate(thing, its declaration, scope):
//            pure, so a render React throws away leaves nothing behind
//   commit   a layout effect holds the declaration (root.hold); unmounting
//            releases it. Holds and releases are flushed once the commit is
//            over: a program that changed is reconciled and published
//   update   each hook subscribes to its own cell (useSyncExternalStore over
//            values that keep their identity while unchanged), so a change to
//            one cell re-renders only what read it
//
// Two ways to declare:
//
//   useIntent   a React hook, in any component under a <Thing>. React's rules
//               of hooks apply: not under an `if`
//   reactPart   a part (part.ts) as a component. It runs with the core's own
//               hooks, known by label, so a hook under an `if` is fine there;
//               the component subscribes to the cells the part read
//
// <Thing> composes paths (a <Thing id="beat:2"> around a <Thing id="man">
// is `beat:2/man`); a part names its own thing and does not compose (give it
// a `partId` to name another). <Scope> gives a subtree its own focus or
// viewer's leaning: its values are computed under it.
// =============================================================================

import { createContext, createElement, useContext, useId, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { Value } from "./decide";
import type { IntentType } from "./intent";
import { collect, type Part } from "./part";
import type { IntentDecl, IntentOptions, Key } from "./program";
import { keyOf, type Root, type Scope, type Snapshot, type ThingInfo } from "./root";

const RootContext = createContext<Root | null>(null);
const ThingContext = createContext<ThingInfo | null>(null);
const ScopeContext = createContext<Scope | undefined>(undefined);

export function ReintentRoot({ root, children }: { root: Root; children?: ReactNode }) {
  return createElement(RootContext.Provider, { value: root }, children);
}

export function useRoot(): Root {
  const root = useContext(RootContext);
  if (!root) throw new Error("reintent: no <ReintentRoot> above");
  return root;
}

/** The path a thing has here: its own id under any <Thing> around it. */
const pathOf = (parent: ThingInfo | null, id: string) => (parent ? `${parent.id}/${id}` : id);

/** A thing: every useIntent under it (outside a nearer <Thing>) is one of its intents. */
export function Thing({ id, label, aka, children }: { id: string; label?: string; aka?: readonly string[]; children?: ReactNode }) {
  const parent = useContext(ThingContext);
  const path = pathOf(parent, id);
  const akaKey = JSON.stringify(aka ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- aka by value, not identity
  const info = useMemo<ThingInfo>(() => ({ id: path, label, aka }), [path, label, akaKey]);
  return createElement(ThingContext.Provider, { value: info }, children);
}

/** A subtree's own part of the context: what it focuses on, how its viewer leans. */
export function Scope({ focus, lean, children }: Scope & { children?: ReactNode }) {
  const outer = useContext(ScopeContext);
  const leanKey = JSON.stringify(lean ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- lean by value, not identity
  const scope = useMemo<Scope>(() => ({ focus: focus ?? outer?.focus, lean: { ...outer?.lean, ...lean } }), [focus, outer, leanKey]);
  return createElement(ScopeContext.Provider, { value: scope }, children);
}

/** The published snapshot. Re-renders on every change: prefer useIntent / useCell. */
export function useSnapshot(root?: Root): Snapshot {
  const near = useContext(RootContext);
  const r = root ?? near;
  if (!r) throw new Error("reintent: no <ReintentRoot> above");
  return useSyncExternalStore(r.subscribe, r.get, r.get);
}

/** Declare an intent of the nearest <Thing>, and read its value. A React hook: React's rules apply. */
export function useIntent<K extends string, D>(label: string, of: IntentType<K, D>, opts: IntentOptions<NoInfer<K>> = {}): Value<K, D> {
  const root = useRoot();
  const thing = useContext(ThingContext);
  if (!thing) throw new Error(`reintent: useIntent("${label}") outside a <Thing>`);
  const scope = useContext(ScopeContext);
  const holder = `hook:${useId()}`;
  const decl: IntentDecl<K, D> = { ...opts, name: label, of, aka: opts.aka ?? [], resolve: opts.resolve ?? "switch" };
  const value = useSyncExternalStore(
    root.subscribe,
    () => root.evaluate(thing, decl, scope),
    () => root.evaluate(thing, decl, scope),
  );
  // Declared at commit, every commit (a re-run with the same shape is quiet); released on unmount.
  useLayoutEffect(() => root.hold(holder, thing, [decl as unknown as IntentDecl<string, unknown>]));
  useLayoutEffect(() => () => root.release(holder), [root, holder]);
  return value;
}

/** A cell read sideways, from anywhere under the root: undefined until its thing is declared. */
export function useCell<K extends string, D>(key: Key, of?: IntentType<K, D>): Value<K, D> | undefined {
  void of;
  const root = useRoot();
  const scope = useContext(ScopeContext);
  const get = () => root.view(scope)[key] as Value<K, D> | undefined;
  return useSyncExternalStore(root.subscribe, get, get);
}

/**
 * The values of `keys` as one stable array: the same array while each value is
 * the same object, so a part re-renders only when a cell it read changed.
 */
function useCells(root: Root, keys: { current: readonly Key[] }, scope: Scope | undefined) {
  const cache = useRef<{ keys: readonly Key[]; vals: (Value | undefined)[] } | null>(null);
  const get = () => {
    const view = root.view(scope);
    const vals = keys.current.map((k) => view[k]);
    const c = cache.current;
    // By content: every run brings a new array of the same keys.
    if (c && c.keys.length === keys.current.length && c.keys.every((k, i) => k === keys.current[i]) && c.vals.every((v, i) => v === vals[i])) return c.vals;
    cache.current = { keys: keys.current, vals };
    return vals;
  };
  return useSyncExternalStore(root.subscribe, get, get);
}

/** Run a part in this component: its world returned, its declarations held at commit. */
export function usePart<P, R>(p: Part<P, R>, props: P, id = p.id): R {
  const root = useRoot();
  const scope = useContext(ScopeContext);
  const holder = `part:${useId()}`;
  const reads = useRef<readonly Key[]>([]);
  // Subscribed to what the last run read; a change elsewhere does not run it again.
  useCells(root, reads, scope);
  // A part names its own thing: it does not compose under a <Thing> it happens to be drawn in.
  const run = collect(root, p, props, { id, scope });
  useLayoutEffect(() => {
    reads.current = run.reads;
    root.hold(holder, run.thing, run.decls);
  });
  useLayoutEffect(() => () => root.release(holder), [root, holder]);
  return run.out;
}

/** A part as a React component; `partId` names the thing when one part is drawn as several things (`beat:2/man`). */
export function reactPart<P extends object>(p: Part<P, ReactNode>) {
  function PartView(props: P & { partId?: string }) {
    return usePart(p, props, props.partId ?? p.id);
  }
  PartView.displayName = `Part(${p.id})`;
  return PartView;
}

export { keyOf };

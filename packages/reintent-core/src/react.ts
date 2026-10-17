// =============================================================================
// The React binding: parts as React components, a root as an external store.
// The core never imports this; a host that renders with React does.
//
//   <ReintentRoot root={root}>
//     <ManView pose={…} />          const ManView = reactPart(Man)
//   </ReintentRoot>
//
// A part runs inside its component's render, so it may use React's hooks as
// well as the core's. After each commit the root is flushed: a program that
// changed (a part rewritten, an `if` gone the other way, a part unmounted) is
// reconciled, and every part reading the root runs again.
// =============================================================================

import { createContext, createElement, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { Value } from "./decide";
import type { IntentType } from "./intent";
import { runPart, type Part } from "./part";
import type { Key } from "./program";
import type { Root, Snapshot } from "./root";

const RootContext = createContext<Root | null>(null);

export function ReintentRoot({ root, children }: { root: Root; children?: ReactNode }) {
  return createElement(RootContext.Provider, { value: root }, children);
}

export function useRoot(): Root {
  const root = useContext(RootContext);
  if (!root) throw new Error("reintent: no <ReintentRoot> above");
  return root;
}

export function useSnapshot(root?: Root): Snapshot {
  const near = useContext(RootContext);
  const r = root ?? near;
  if (!r) throw new Error("reintent: no <ReintentRoot> above");
  return useSyncExternalStore(r.subscribe, r.get, r.get);
}

/** Run a part in this component: its intents declared, its world returned. */
export function usePart<P, R>(p: Part<P, R>, props: P, id = p.id): R {
  const root = useRoot();
  // Subscribed: the part runs again on every change to the doc, the context or the program.
  useSnapshot(root);
  const out = runPart(root, p, props, id);
  // Gone when unmounted; kept if it mounts again before the flush (strict mode's remount).
  useEffect(() => {
    root.keep(id);
    return () => root.drop(id);
  }, [root, id]);
  useEffect(() => root.flush());
  return out;
}

/** A part as a React component; `partId` names an instance when one part is drawn many times. */
export function reactPart<P extends object>(p: Part<P, ReactNode>) {
  function PartView(props: P & { partId?: string }) {
    return usePart(p, props, props.partId ?? p.id);
  }
  PartView.displayName = `Part(${p.id})`;
  return PartView;
}

/** A cell, read sideways from anywhere under the root: undefined until its part has run. */
export function useCell<K extends string, D>(key: Key, of?: IntentType<K, D>): Value<K, D> | undefined {
  void of;
  return useSnapshot().values[key] as Value<K, D> | undefined;
}

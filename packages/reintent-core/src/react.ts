// =============================================================================
// The React binding: a root as an external store. The core never imports
// this; a host that renders with React does.
// =============================================================================

import { useSyncExternalStore } from "react";
import type { Value } from "./decide";
import type { IntentType } from "./intent";
import type { Key } from "./program";
import type { Root, Snapshot } from "./root";

export function useSnapshot(root: Root): Snapshot {
  return useSyncExternalStore(root.subscribe, root.get, root.get);
}

/** A cell's value, typed by its intent: `useIntent(root, "man.hat", Size).data.hatScale`. */
export function useIntent<K extends string, D>(root: Root, key: Key, of?: IntentType<K, D>): Value<K, D> | undefined {
  void of;
  return useSnapshot(root).values[key] as Value<K, D> | undefined;
}

"use client";

import { useSyncExternalStore } from "react";

// =============================================================================
// Home edit-mode store
//
// The widget grid owns jiggle edit mode, but the bottom of the home screen is
// shared with the command bar (systems/command/fab.tsx). On phones the bar
// fades out while the grid is being edited so the edit controls can sit at
// the bottom, so the two surfaces need one bit of shared state. A module
// store keeps it out of the provider tree — the masonry writes, the bar reads.
// =============================================================================

let editing = false;
const listeners = new Set<() => void>();

export function setHomeEditing(next: boolean): void {
  if (editing === next) return;
  editing = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => editing;
const getServerSnapshot = () => false;

/** True while the home widget grid is in jiggle edit mode. */
export function useHomeEditing(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

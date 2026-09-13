"use client";

import { useSyncExternalStore } from "react";

// =============================================================================
// Home edit-mode store
//
// The widget grid owns jiggle edit mode, but the bottom of the home screen is
// shared with the command bar (systems/command/fab.tsx). iOS swaps the dock
// for a "Done" button while the home screen is being edited; we do the same,
// so the two surfaces need one bit of shared state. A module store keeps it
// out of the provider tree — the masonry writes, the command bar reads.
// =============================================================================

/**
 * Shared Framer `layoutId` between the command bar and the edit-mode "Done"
 * pill: both occupy the bottom-centre slot of the home screen, one at a time,
 * so the swap animates as a single pill changing shape rather than two
 * unrelated fades.
 */
export const HOME_BOTTOM_PILL = "home-bottom-pill";

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

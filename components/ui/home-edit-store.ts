"use client";

import { useSyncExternalStore } from "react";

// =============================================================================
// Home edit-mode store
//
// The widget grid owns jiggle edit mode, but the bottom of the home screen is
// shared with the command bar (systems/command/fab.tsx) — or, when the DevTool
// liquid-tab switch is on, the phone tab bar (systems/tabbar). On phones the
// chrome fades out while the grid is being edited so the edit controls can
// sit at the bottom, so the two surfaces need one bit of shared state. A
// module store keeps it out of the provider tree — the masonry writes, the
// bar reads.
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

// -----------------------------------------------------------------------------
// The hand-off between the command bar and the edit controls on phones.
//
// They share the bottom of the screen, so the swap is sequenced rather than
// crossfaded: the outgoing one leaves first, the incoming one arrives once
// it has gone. Both sides read the same numbers so the two directions mirror
// each other (bar out → Done in; Done out → bar in).
// -----------------------------------------------------------------------------

export const HANDOFF = {
  /** The outgoing surface fades out. */
  out: 0.15,
  /** The incoming surface waits for the outgoing one, then eases in. */
  in: 0.22,
  delay: 0.15,
} as const;

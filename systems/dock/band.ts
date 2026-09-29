"use client";

import { useSyncExternalStore } from "react";

// =============================================================================
// The shared band — one strip at the top of the screen, never two.
//
// A bar pinned by a page (PageLayout `pinnedActions`: the /works and /prompt
// toolbars) and the Dock's pills used to stack: pills at the top, the bar
// pinned under them, two floating strips of glass eating twice the height.
// Now they share one band. The bar pins at the pills' own height, and when it
// rises to meet them the pills make room the way the Dynamic Island's
// activities do when there are several: they shrink to their minimal
// presentation — a circle showing only what leads them — and stand at the end
// of the page column, and the bar gives up exactly that width. Everything
// stays in the band's Y; the space is found in X.
//
// The page's bar is not in the Dock's tree, so this is a module store, like
// notices. The pinned slot (components/ui/pinned-slot.tsx) says when the bar
// has met the band; the Dock reads it.
//
// The hand-over has two beats, so nothing is seen sliding across the screen:
// `switching` — the pills fade out where they are — then `shared` flips and
// they fade back in, in their other form and place. Centre pill ⇄ end circle
// is a different place, not a journey between two.
// =============================================================================

export interface BandState {
  /** The bar holds the band; the pills are circles at the column's end. */
  shared: boolean;
  /** Between the two forms: the pills are out of sight while they re-form. */
  switching: boolean;
}

/** The first beat — the pills' own hide transition, and a frame to spare. */
export const BAND_SWITCH_MS = 200;

let state: BandState = { shared: false, switching: false };
let target = false;
let timer: number | undefined;
const listeners = new Set<() => void>();

function emit(next: BandState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The pinned slot's word on whether its bar has met the band. */
export function setBandShared(next: boolean) {
  if (next === target) return;
  target = next;
  window.clearTimeout(timer);
  emit({ ...state, switching: true });
  timer = window.setTimeout(() => {
    emit({ shared: target, switching: false });
  }, BAND_SWITCH_MS);
}

export function useBand(): BandState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

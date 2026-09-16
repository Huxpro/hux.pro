"use client";

import { useEffect, useSyncExternalStore } from "react";

// =============================================================================
// Surface stack — which sheets are open, in the order they opened.
//
// iOS stacks sheets: presenting one from another sends the first back a step
// (smaller, dimmer, a little higher) and brings it forward again when the one
// on top goes. That is a relationship between surfaces, not a property of any
// one of them, so it lives here rather than in either sheet.
//
// A module-level store instead of a provider: the surfaces mount in different
// subtrees of the root layout, and a store needs no wrapper to reach them all.
// =============================================================================

/**
 * How long a surface takes to arrive, leave, change detent or step back. Base
 * UI leaves every drawer animation to CSS, so this is the site's own number
 * rather than a library's: the motion in globals.css reads it through
 * `--surface-duration`, and a hand-off waits exactly this long.
 */
export const SURFACE_TRANSITION_MS = 500;

/** The one curve every surface motion shares, so nothing drifts. */
export const SURFACE_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

let stack: readonly string[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => stack;
const EMPTY: readonly string[] = [];
const getServerSnapshot = () => EMPTY;

function push(id: string) {
  if (stack.includes(id)) return;
  stack = [...stack, id];
  emit();
}

function remove(id: string) {
  if (!stack.includes(id)) return;
  stack = stack.filter((s) => s !== id);
  emit();
}

/**
 * Registers a sheet while `active`, and reports whether another sheet has
 * opened on top of it since. Deregisters on close (not on unmount), so the one
 * behind comes forward in step with the top sheet's exit rather than after it.
 */
export function useSurfaceStack(id: string, active: boolean): { behind: boolean } {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!active) return;
    push(id);
    return () => remove(id);
  }, [id, active]);

  const index = current.indexOf(id);
  return { behind: index !== -1 && index < current.length - 1 };
}

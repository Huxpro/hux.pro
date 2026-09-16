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
 * `--surface-duration`.
 */
export const SURFACE_TRANSITION_MS = 500;

/** The curve a surface travels on — arriving, leaving, changing detent. */
export const SURFACE_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * The curve a surface steps back on while another rises over it. Background
 * motion: it starts gently, so the frame it leads the arriving sheet by is
 * invisible, and ends with it. See "Secondary surface motion" in globals.css.
 */
export const SURFACE_RECEDE_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

interface Entry {
  id: string;
  /** The sheet this one renders inside, when it is a Base UI nested drawer. */
  nestedIn?: string;
}

let stack: readonly Entry[] = [];
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
const EMPTY: readonly Entry[] = [];
const getServerSnapshot = () => EMPTY;

function push(entry: Entry) {
  if (stack.some((e) => e.id === entry.id)) return;
  stack = [...stack, entry];
  emit();
}

function remove(id: string) {
  if (!stack.some((e) => e.id === id)) return;
  stack = stack.filter((e) => e.id !== id);
  emit();
}

/**
 * Registers a sheet while `active`, and reports how many sheets have opened on
 * top of it since. Deregisters on close (not on unmount), so the one behind
 * comes forward in step with the top sheet's exit rather than after it.
 *
 * `behind` counts every sheet above, nested or not: it is what makes the sheet
 * inert and dims it. `depth` leaves out the sheets nested in this one — Base
 * UI already counts those on the parent popup as `--nested-drawers`, live with
 * their swipe — so a shell can add the two without counting a sheet twice.
 */
export function useSurfaceStack(
  id: string,
  active: boolean,
  nestedIn?: string
): { behind: boolean; depth: number } {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!active) return;
    push({ id, nestedIn });
    return () => remove(id);
  }, [id, active, nestedIn]);

  const index = current.findIndex((e) => e.id === id);
  if (index === -1) return { behind: false, depth: 0 };
  const above = current.slice(index + 1);
  return {
    behind: above.length > 0,
    depth: above.filter((e) => e.nestedIn !== id).length,
  };
}

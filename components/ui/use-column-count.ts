"use client";

import { useSyncExternalStore } from "react";

// =============================================================================
// useColumnCount — how many grid columns the viewport has right now.
//
// The grid's CSS decides the column count per breakpoint (1 / sm 2 / lg 3 /
// roomy 3 or 4 — see `sortable-grid.tsx`); the drag and resize maths, and the
// effective size each widget is told, need the same number in JS. These media
// queries mirror Tailwind's `sm` / `lg` and the `roomy` variant in
// `globals.css` exactly — keep them in step.
//
// On the server the answer is one column. Every widget's default footprint is
// one column wide, so the server render is the same at every width; saved
// wider footprints are applied on mount, alongside the saved order, exactly as
// the order always has been.
// =============================================================================

const QUERIES = {
  sm: "(min-width: 40rem)",
  lg: "(min-width: 64rem)",
  roomy: "(min-width: 96rem) and (min-height: 1000px)",
} as const;

function subscribe(onChange: () => void): () => void {
  const lists = Object.values(QUERIES).map((q) => window.matchMedia(q));
  for (const l of lists) l.addEventListener("change", onChange);
  return () => {
    for (const l of lists) l.removeEventListener("change", onChange);
  };
}

function readStep(): 0 | 1 | 2 | 3 {
  if (window.matchMedia(QUERIES.roomy).matches) return 3;
  if (window.matchMedia(QUERIES.lg).matches) return 2;
  if (window.matchMedia(QUERIES.sm).matches) return 1;
  return 0;
}

const getServerStep = (): 0 => 0;

/**
 * @param roomyColumns columns at the `roomy` step — 4 with enough widgets to
 *   fill a fourth column, 3 otherwise (the grid decides; see `gridScale`).
 */
export function useColumnCount(roomyColumns: 3 | 4): number {
  const step = useSyncExternalStore(subscribe, readStep, getServerStep);
  return [1, 2, 3, roomyColumns][step];
}

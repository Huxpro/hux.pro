"use client";

import { useEffect, useState } from "react";

// =============================================================================
// Surface presentation — how a secondary surface shows itself, per viewport.
//
// The site has a growing set of secondary surfaces (the wallpaper picker, the
// music playlist, whatever comes next). Each one wants a different shape at a
// different size, and the right shape is a property of the VIEWPORT, not of the
// feature — so it belongs in one place rather than re-decided per component:
//
//   sheet   — action sheet climbing from the bottom edge.  Phone.
//   panel   — floating panel against the trailing edge.    Tablet.
//   window  — centred, draggable window that morphs in.    Desktop.
//
// A feature declares its presentation as a breakpoint map and stops thinking
// about it:
//
//   presentation={{ base: "sheet", sm: "panel", lg: "window" }}
//
// Anything omitted inherits the next breakpoint down, so `{ base: "sheet" }` is
// a sheet everywhere and a one-word change moves a surface between shapes.
// =============================================================================

export type SurfaceMode = "sheet" | "panel" | "window";

/**
 * Breakpoints match Tailwind's, so a surface and the content inside it respond
 * at the same widths rather than a few pixels apart.
 */
export const SURFACE_BREAKPOINTS = { sm: 640, lg: 1024 } as const;

export interface SurfacePresentation {
  /** Below `sm`. Required — it is the fallback every other key inherits from. */
  base: SurfaceMode;
  /** From 640px. Defaults to `base`. */
  sm?: SurfaceMode;
  /** From 1024px. Defaults to `sm`, then `base`. */
  lg?: SurfaceMode;
}

/** What most secondary surfaces want: bottom sheet → side panel → window. */
export const ADAPTIVE_PRESENTATION: SurfacePresentation = {
  base: "sheet",
  sm: "panel",
  lg: "window",
};


function resolve(presentation: SurfacePresentation, width: number): SurfaceMode {
  if (width >= SURFACE_BREAKPOINTS.lg) {
    return presentation.lg ?? presentation.sm ?? presentation.base;
  }
  if (width >= SURFACE_BREAKPOINTS.sm) {
    return presentation.sm ?? presentation.base;
  }
  return presentation.base;
}

/**
 * The mode to render right now.
 *
 * Starts at `base` so SSR and the first client render agree, then settles on
 * the real viewport in an effect — the same hydration-safe shape the ambient
 * settings use. Tracked live via matchMedia, so a resize or a rotation moves
 * an already-open surface into its new shape rather than waiting for a reopen.
 */
export function useSurfaceMode(presentation: SurfacePresentation): SurfaceMode {
  const [mode, setMode] = useState<SurfaceMode>(presentation.base);

  const { base, sm, lg } = presentation;
  useEffect(() => {
    const queries = [
      window.matchMedia(`(min-width: ${SURFACE_BREAKPOINTS.sm}px)`),
      window.matchMedia(`(min-width: ${SURFACE_BREAKPOINTS.lg}px)`),
    ];
    const sync = () => setMode(resolve({ base, sm, lg }, window.innerWidth));
    sync();
    for (const q of queries) q.addEventListener("change", sync);
    return () => {
      for (const q of queries) q.removeEventListener("change", sync);
    };
  }, [base, sm, lg]);

  return mode;
}

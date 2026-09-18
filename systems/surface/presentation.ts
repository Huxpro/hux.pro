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
//   popover — a card hanging off the button that opened it. Desktop, for a
//             surface that belongs to one control rather than to the page.
//
// A feature declares its presentation as a breakpoint map and stops thinking
// about it:
//
//   presentation={{ base: "sheet", sm: "panel", lg: "window" }}
//
// Anything omitted inherits the next breakpoint down, so `{ base: "sheet" }` is
// a sheet everywhere and a one-word change moves a surface between shapes.
// =============================================================================

export type SurfaceMode = "sheet" | "panel" | "window" | "popover";

/**
 * Breakpoints match Tailwind's, so a surface and the content inside it respond
 * at the same widths rather than a few pixels apart.
 */
export const SURFACE_BREAKPOINTS = { sm: 640, lg: 1024 } as const;

/** A value per breakpoint. Anything omitted inherits the next breakpoint down. */
export interface BreakpointMap<T> {
  /** Below `sm`. Required — it is the fallback every other key inherits from. */
  base: T;
  /** From 640px. Defaults to `base`. */
  sm?: T;
  /** From 1024px. Defaults to `sm`, then `base`. */
  lg?: T;
}

export type SurfacePresentation = BreakpointMap<SurfaceMode>;

/** What most secondary surfaces want: bottom sheet → side panel → window. */
export const ADAPTIVE_PRESENTATION: SurfacePresentation = {
  base: "sheet",
  sm: "panel",
  lg: "window",
};

/**
 * What a surface owned by a single button wants — the Books "Aa" menu: a sheet
 * under the thumb on a phone, and from `sm` up a popover hanging off the button
 * itself. A surface using this passes `anchor`.
 */
export const ANCHORED_PRESENTATION: SurfacePresentation = {
  base: "sheet",
  sm: "popover",
};

function resolve<T>(map: BreakpointMap<T>, width: number): T {
  if (width >= SURFACE_BREAKPOINTS.lg) {
    return map.lg ?? map.sm ?? map.base;
  }
  if (width >= SURFACE_BREAKPOINTS.sm) {
    return map.sm ?? map.base;
  }
  return map.base;
}

/**
 * The value for the viewport right now.
 *
 * Starts at `base` so SSR and the first client render agree, then settles on
 * the real viewport in an effect — the same hydration-safe shape the ambient
 * settings use. Tracked live via matchMedia, so a resize or a rotation moves
 * an already-open surface into its new shape rather than waiting for a reopen.
 *
 * Generic over the value so a surface that is not an AdaptiveSurface (the
 * command palette, whose wide shape is its own popover) can declare its own
 * vocabulary against the same breakpoints.
 */
export function useBreakpointValue<T>(
  map: BreakpointMap<T>,
  { immediate = false }: { immediate?: boolean } = {},
): T {
  const [value, setValue] = useState<T>(() =>
    // `immediate` is for a surface that never renders on the server — an app
    // window, which only exists once someone has opened one. Settling in the
    // effect instead would mount the phone shape for a commit first, and a
    // shape carries an app with it: an iframe committed, fetched and thrown
    // away before the right one mounts.
    immediate && typeof window !== "undefined"
      ? resolve(map, window.innerWidth)
      : map.base,
  );

  const { base, sm, lg } = map;
  useEffect(() => {
    const queries = [
      window.matchMedia(`(min-width: ${SURFACE_BREAKPOINTS.sm}px)`),
      window.matchMedia(`(min-width: ${SURFACE_BREAKPOINTS.lg}px)`),
    ];
    const sync = () => setValue(resolve({ base, sm, lg }, window.innerWidth));
    sync();
    for (const q of queries) q.addEventListener("change", sync);
    return () => {
      for (const q of queries) q.removeEventListener("change", sync);
    };
  }, [base, sm, lg]);

  return value;
}

/** The shape to render right now. */
export function useSurfaceMode(
  presentation: SurfacePresentation,
  options?: { immediate?: boolean },
): SurfaceMode {
  return useBreakpointValue(presentation, options);
}

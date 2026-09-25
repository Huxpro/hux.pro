"use client";

import { createContext, useContext } from "react";
import type { WindowInstance } from "../lib/types";

// =============================================================================
// Host window — what a window's body can know about the window it is in
//
// A system app's body is this site's own React, so it can ask: am I in the
// dock, what shape am I (a window or a phone's sheet), and at what z-index is
// my window painted. The theater needs the last one — its stage stands at its
// window's level rather than inside it (window-layer.tsx).
// =============================================================================

export interface HostWindow {
  win: WindowInstance;
  /** The window's z-index in the root stacking context (0 for a sheet). */
  zIndex: number;
  shape: "window" | "sheet";
}

const HostWindowContext = createContext<HostWindow | null>(null);

export const HostWindowProvider = HostWindowContext.Provider;

/** The window this body is in, or null outside one. */
export function useHostWindow(): HostWindow | null {
  return useContext(HostWindowContext);
}

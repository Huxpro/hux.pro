"use client";

import { useSyncExternalStore } from "react";

/**
 * Safe Area Lab — human-in-the-loop bisection of the iOS Safari
 * safe-area clipping heuristic. Each flag isolates one suspect in the
 * command palette's takeover; all defaults match current behavior, so
 * nothing changes until a flag is flipped from the devtool panel.
 * Persisted in localStorage; applied live.
 */

export interface PaletteLabFlags {
  /** iOS: `document.body.style.overflow = "hidden"` while open. */
  bodyScrollLock: boolean;
  /** iOS: absolute + top:scrollY + 100dvh container (off → fixed inset-0). */
  dvhContainer: boolean;
  /** Scrim backdrop-filter blur. */
  scrimBlur: boolean;
  /** Scrim background dim (bg-background/60). */
  scrimDim: boolean;
  /** Scrim touch-action: none. */
  scrimTouchNone: boolean;
  /** Panel backdrop-blur-xl (off → opaque popover background). */
  panelBlur: boolean;
  /** Declare viewport-fit=cover, disabling Safari's edge-to-edge guessing. */
  viewportFitCover: boolean;
}

export const PALETTE_LAB_DEFAULTS: PaletteLabFlags = {
  bodyScrollLock: true,
  dvhContainer: true,
  scrimBlur: true,
  scrimDim: true,
  scrimTouchNone: true,
  panelBlur: true,
  viewportFitCover: false,
};

const STORAGE_KEY = "hux_palette_lab";
const CHANGE_EVENT = "hux:palette-lab";

let cache: PaletteLabFlags | null = null;

function read(): PaletteLabFlags {
  if (typeof window === "undefined") return PALETTE_LAB_DEFAULTS;
  if (cache) return cache;
  let next: PaletteLabFlags;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    next = { ...PALETTE_LAB_DEFAULTS, ...stored };
  } catch {
    next = { ...PALETTE_LAB_DEFAULTS };
  }
  cache = next;
  return next;
}

export function getPaletteLab(): PaletteLabFlags {
  return read();
}

export function setPaletteLabFlag<K extends keyof PaletteLabFlags>(
  key: K,
  value: PaletteLabFlags[K]
): void {
  cache = { ...read(), [key]: value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Storage unavailable — the event still updates this session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(callback: () => void) {
  const onChange = () => {
    cache = null;
    callback();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function usePaletteLab(): PaletteLabFlags {
  return useSyncExternalStore(subscribe, read, () => PALETTE_LAB_DEFAULTS);
}

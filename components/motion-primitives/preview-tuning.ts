"use client";

import { useSyncExternalStore } from "react";

// =============================================================================
// Magnetic-preview tuning
//
// Runtime-tunable timings for the cursor preview's "warmth" dwell, shared by
// the Cursor component (which reads them at pointer-event time) and the devtool
// sliders (which write them). Kept as a tiny module store rather than React
// context because Cursor only needs the *current* value when an event fires —
// it never has to re-render when the value changes.
// =============================================================================

export interface PreviewTuning {
  /** Dwell (ms) before the first preview opens from a cold start. */
  openDelay: number;
  /** Grace window (ms) after a preview closes during which the next one opens
   *  instantly (warmth). */
  graceMs: number;
}

export const PREVIEW_TUNING_DEFAULTS: Readonly<PreviewTuning> = Object.freeze({
  openDelay: 150,
  graceMs: 300,
});

const STORAGE_KEY = "hux_preview_tuning";

let current: PreviewTuning = { ...PREVIEW_TUNING_DEFAULTS };
const listeners = new Set<() => void>();

// Hydrate from localStorage once on the client so tuned values survive reloads.
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<PreviewTuning>;
      current = {
        openDelay:
          typeof parsed.openDelay === "number"
            ? parsed.openDelay
            : current.openDelay,
        graceMs:
          typeof parsed.graceMs === "number"
            ? parsed.graceMs
            : current.graceMs,
      };
    }
  } catch {
    // Corrupt/blocked storage — fall back to defaults.
  }
}

export function getPreviewTuning(): PreviewTuning {
  return current;
}

export function setPreviewTuning(patch: Partial<PreviewTuning>): void {
  current = { ...current, ...patch };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Ignore persistence failures (private mode, quota, etc.).
    }
  }
  listeners.forEach((cb) => cb());
}

export function resetPreviewTuning(): void {
  setPreviewTuning({ ...PREVIEW_TUNING_DEFAULTS });
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** React-subscribed view of the tuning — use in the devtool sliders. */
export function usePreviewTuning(): PreviewTuning {
  return useSyncExternalStore(
    subscribe,
    getPreviewTuning,
    () => PREVIEW_TUNING_DEFAULTS
  );
}

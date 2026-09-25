"use client";

import { useSyncExternalStore } from "react";

// =============================================================================
// Unified windows — one window system for everything the site opens
//
// A design direction, behind one switch while it is explored. With it on, the
// built-in features that each grew a surface of their own — the music
// playlist, the wallpaper picker, the theater's modal and PiP — open as app
// windows instead: the same frame, pill, menu, z-order and dock an app gets.
// A fullscreen page (writing, prompt, works) can shrink into one too. See
// docs/system-windows.md, "Unified windows".
//
// A module-level store rather than a provider, because the systems that read
// it (music, ambient, theater) sit *outside* WindowProvider in the tree.
// Persisted in localStorage so a reload keeps the direction you were trying.
// =============================================================================

export const UNIFIED_WINDOWS_KEY = "hux_windows_unified";

const listeners = new Set<() => void>();
let cached: boolean | null = null;

function read(): boolean {
  if (cached !== null) return cached;
  try {
    cached = window.localStorage.getItem(UNIFIED_WINDOWS_KEY) === "1";
  } catch {
    cached = false;
  }
  return cached;
}

export function isUnifiedWindows(): boolean {
  if (typeof window === "undefined") return false;
  return read();
}

export function setUnifiedWindows(on: boolean): void {
  cached = on;
  try {
    if (on) window.localStorage.setItem(UNIFIED_WINDOWS_KEY, "1");
    else window.localStorage.removeItem(UNIFIED_WINDOWS_KEY);
  } catch {
    /* private mode: the switch still holds for this visit */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== UNIFIED_WINDOWS_KEY) return;
    cached = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Whether the unified-windows direction is on. False on the server. */
export function useUnifiedWindows(): boolean {
  return useSyncExternalStore(subscribe, isUnifiedWindows, () => false);
}

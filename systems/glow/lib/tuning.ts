"use client";

import { useSyncExternalStore } from "react";

// =============================================================================
// Glow tuning — the devtool's knobs on the light, saved.
//
// Three numbers, set from the devtool's Glow module and kept in localStorage
// (`hux_glow`), so a taste decision survives reloads:
//
//   strength       every glow on the site, × this — the light's overall volume
//   aboutStrength  the About's ring, × this (on top of `strength`)
//   aboutDepth     how far the About's ring reaches in, as a fraction of the
//                  room it has: the gutter between the screen's edge and the
//                  words (wide on a desk, a few dozen px on a phone)
//
// The renderer reads `strength` from here every frame (`glowTuning()`), so a
// slider drag changes every lit glow at once without re-rendering anything.
// Components read the About's pair with `useGlowTuning()`.
// =============================================================================

export interface GlowTuning {
  strength: number;
  aboutStrength: number;
  aboutDepth: number;
}

export const GLOW_TUNING_DEFAULTS: GlowTuning = {
  strength: 1,
  aboutStrength: 1,
  aboutDepth: 0.2,
};

const KEY = "hux_glow";

let state: GlowTuning = GLOW_TUNING_DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...GLOW_TUNING_DEFAULTS, ...(JSON.parse(raw) as Partial<GlowTuning>) };
  } catch {
    /* storage blocked or malformed: defaults */
  }
}

/** The current tuning, for code that reads it per frame. */
export function glowTuning(): GlowTuning {
  load();
  return state;
}

export function setGlowTuning(patch: Partial<GlowTuning>) {
  load();
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage blocked: the change still holds for this page */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The tuning, as React state: re-renders when a knob moves. */
export function useGlowTuning(): GlowTuning {
  return useSyncExternalStore(subscribe, glowTuning, () => GLOW_TUNING_DEFAULTS);
}

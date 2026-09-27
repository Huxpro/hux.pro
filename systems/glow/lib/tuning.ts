"use client";

import { useSyncExternalStore } from "react";
import type { GlowMotion } from "../components/glow";

// =============================================================================
// Glow tuning — the devtool's knobs on the light, saved.
//
// Set from the devtool's Glow module and kept in localStorage (`hux_glow`),
// so a taste decision survives reloads:
//
//   strength       every glow on the site, × this — the light's overall volume
//   aboutStrength  the About's ring, × this (on top of `strength`)
//   aboutDesk      where the About's light ends, as a share of the narrower
//   aboutPhone     gutter between the screen's edge and the words
//                  (<EdgeGlow>'s `depth`, one number: the light stands as
//                  high off every edge). 1 just touches the words. One per
//                  layout, the About having two (a centred group on a desk,
//                  the whole screen on a phone — the `sm` breakpoint).
//   aboutMotion    how the About's ring lives: flow (the default), rotate,
//                  pulse — to judge the motions on the one ring that matters.
//
// The desk's default is the ring as it first shipped (a reach of 3.8% of the
// screen's short side, 18–38px), restated: at 1440×900 a 34px reach ends
// 152px in, 1.3× the narrower gutter (117px, top and bottom). On a phone
// the first ring (an 18px reach, ending 80px in) was 2.2× its 36px gutter,
// its tail well over the words; 1.4 (50px) keeps it off most of them.
//
// The renderer reads `strength` from here every frame (`glowTuning()`), so a
// slider drag changes every lit glow at once without re-rendering anything.
// Components read the rest with `useGlowTuning()`.
// =============================================================================

export interface GlowTuning {
  strength: number;
  aboutStrength: number;
  aboutDesk: number;
  aboutPhone: number;
  /** How the About's ring lives while it is up (<Glow motion>). */
  aboutMotion: GlowMotion;
}

export const GLOW_TUNING_DEFAULTS: GlowTuning = {
  strength: 1,
  aboutStrength: 1,
  aboutDesk: 1.3,
  aboutPhone: 1.4,
  aboutMotion: "flow",
};

const MOTIONS: readonly GlowMotion[] = ["flow", "rotate", "pulse"];

const KEY = "hux_glow";

let state: GlowTuning = GLOW_TUNING_DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      // Only the knobs there are, each of its own type: a shape saved by an
      // older build (a depth pair) falls back to the default.
      const saved = JSON.parse(raw) as Record<string, unknown>;
      const next = { ...GLOW_TUNING_DEFAULTS };
      for (const k of ["strength", "aboutStrength", "aboutDesk", "aboutPhone"] as const) {
        const v = saved[k];
        if (typeof v === "number") next[k] = v;
      }
      if (MOTIONS.includes(saved.aboutMotion as GlowMotion)) {
        next.aboutMotion = saved.aboutMotion as GlowMotion;
      }
      state = next;
    }
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

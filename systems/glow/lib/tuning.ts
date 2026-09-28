"use client";

import { useSyncExternalStore } from "react";
import type { GlowMotion } from "../components/glow";
import type { GlowHarmony } from "./harmony";

// The rules, repeated here so this module needs nothing at runtime from
// harmony.ts (which reads the tuning): kept in step with GLOW_HARMONIES.
const GLOW_HARMONIES: readonly GlowHarmony[] = [
  "auto",
  "analogous",
  "complementary",
  "split",
  "triadic",
  "siri",
];

// =============================================================================
// Glow tuning — the devtool's knobs on the light, saved.
//
// Set from the devtool's Glow module and kept in localStorage (`hux_glow_v2`),
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
//   harmony        where every glow's colours come from: Siri's fixed
//                  palette (the default), or the wallpaper's dominant colour
//                  by a colour-wheel rule (lib/harmony.ts).
//   aboutBaseline  advanced: the light the ring keeps where no wave, arc or
//                  lobe is, whatever the motion: 5% by default. Null would
//                  be each motion's own (GLOW_BASELINE).
//
// Both layouts default to a depth of 1.4: the light's tail ends 40% past
// the narrower gutter, over the edge of the words but off most of them.
//
// Stored under a versioned key: when the defaults move, the version does,
// so a browser that saved the old ones starts again from the new.
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
  /** Advanced: the About's baseline (<Glow baseline>); null is the motion's own. */
  aboutBaseline: number | null;
  /** Where every glow's colours come from: the wallpaper, by a rule (lib/harmony.ts). */
  harmony: GlowHarmony;
}

export const GLOW_TUNING_DEFAULTS: GlowTuning = {
  strength: 1,
  aboutStrength: 1,
  aboutDesk: 1.4,
  aboutPhone: 1.4,
  aboutMotion: "flow",
  aboutBaseline: 0.05,
  harmony: "siri",
};

const MOTIONS: readonly GlowMotion[] = ["flow", "rotate", "pulse"];

const KEY = "hux_glow_v2";

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
      for (const k of ["strength", "aboutStrength", "aboutDesk", "aboutPhone", "aboutBaseline"] as const) {
        const v = saved[k];
        if (typeof v === "number") next[k] = v;
      }
      if (GLOW_HARMONIES.includes(saved.harmony as GlowHarmony)) {
        next.harmony = saved.harmony as GlowHarmony;
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

/** Called whenever a knob moves. */
export function subscribeGlowTuning(listener: () => void) {
  return subscribe(listener);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The tuning, as React state: re-renders when a knob moves. */
export function useGlowTuning(): GlowTuning {
  return useSyncExternalStore(subscribe, glowTuning, () => GLOW_TUNING_DEFAULTS);
}

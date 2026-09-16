"use client";

import { dismissToast, showCustomToast } from "@/components/ui/system-sonner";
import { useTheme } from "@/services";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { SOLAR_HANDOVER, sunEventFor, type SolarTheme } from "../lib/solar-theme";
import { useSolarTheme } from "../provider";
import { SolarThemeToast } from "./solar-theme-toast";

// ---------------------------------------------------------------------------
// The theme follows the sun.
//
// One rule: the switch is a *crossing watched live*. This component remembers
// which side of the day it last saw (`seenRef`) and only acts when that
// changes while it is mounted — so arriving after dark does nothing, and
// sitting on the page through dusk does. That is the whole of "in the same
// session": the sun may interrupt you, it may not greet you.
//
// *When* it crosses is the sun's own crossing, which is the middle of the
// day's long animation rather than its end (lib/solar-theme.ts). *How* is the
// middle of a short one:
//
//   beginThemeHandover(next)  the sky starts moving to the new theme on a
//                             longer crossfade; the chrome stays put.
//   + chromeAtMs              halfway through it, the chrome changes — one
//                             commit, inside a view transition, so the page
//                             crossfades as one composited image (the 200ms a
//                             route change uses). A transition per element
//                             would cost ~1.2s of style recalculation on a
//                             page this size — measured — against ~60ms for
//                             this. The cut has motion either side of it to
//                             hide in, which is the whole point of the middle.
//   + skyMs                   the sky settles, and the notice lands.
//
// What it applies is a session override on the theme (services/theme.tsx), not
// the saved Appearance preference. The preference is untouched, an explicit
// choice ends the override, closing the tab forgets it, and turning the
// setting off takes it with it — a behaviour that is off leaves nothing behind.
//
// The clock it reads is the ambient one, which is also the devtool's: the Sky
// module's dawn → dusk autoplay crosses both ends for real as it sweeps, and
// the theme follows it exactly when — and only when — the setting says it
// should.
//
// The effect re-runs on plenty it does not care about (the theme it just set,
// a weather refetch). That is deliberate: every path out of a non-crossing is
// an early return, so a re-run costs a comparison, and the alternative —
// holding those values in a ref — buys nothing but a way to read a stale one.
// ---------------------------------------------------------------------------

const TOAST_ID = "solar-theme";
const TOAST_DURATION_MS = 5_000;

/**
 * Commit the theme as one crossfade of the whole page where the browser can
 * do it on the compositor, and as a plain change where it cannot (Firefox,
 * reduced motion). `flushSync` because the callback must leave the DOM in its
 * new state before it returns — React's own update would land a frame late,
 * and the browser would capture the change it was meant to animate.
 */
function commitTheme(apply: () => void, animate: boolean) {
  const start = animate
    ? (document as Document & {
        startViewTransition?: (cb: () => void) => unknown;
      }).startViewTransition
    : undefined;
  if (!start) {
    apply();
    return;
  }
  start.call(document, () => flushSync(apply));
}

export function SolarThemeSync() {
  const { followSun, sunTheme, beginThemeHandover } = useSolarTheme();
  const { theme, preference, override, setThemeOverride } = useTheme();
  const reducedMotion = useReducedMotion() ?? false;

  /** The last reading this session has accounted for; a crossing is a change of it. */
  const seenRef = useRef<SolarTheme | null>(null);
  /** The handover in flight, so a second crossing (autoplay) replaces it. */
  const timersRef = useRef<number[]>([]);
  /**
   * The theme as of this render, for the commit at the end of the lead to
   * check against. Someone may pick a theme while the sky is leading — the
   * palette is one keystroke away — and theirs wins over the sun's. The
   * preference is watched alongside the theme because choosing the theme the
   * page is already in moves only that.
   */
  const pickedRef = useRef({ theme, preference });
  useEffect(() => {
    pickedRef.current = { theme, preference };
  }, [theme, preference]);

  useEffect(() => {
    // Off: the sun drives nothing, and an override it left behind goes with
    // it. Keeping `seen` in step means switching back on cannot fire for a
    // crossing that happened while it was off.
    if (!followSun) {
      seenRef.current = sunTheme;
      if (override) {
        setThemeOverride(null);
        dismissToast(TOAST_ID);
      }
      return;
    }

    // No location or no forecast yet: the sun has no opinion.
    if (sunTheme === null) return;

    const seen = seenRef.current;
    seenRef.current = sunTheme;

    // First reading of the session — which side of the day we opened on, not
    // a change. Nothing switches. An override restored from the tab's session
    // is settled here instead: kept while the sun still agrees with it,
    // dropped once the sun has moved on without us (a reload hours later).
    if (seen === null) {
      if (override) setThemeOverride(override === sunTheme ? sunTheme : null);
      return;
    }

    if (seen === sunTheme) return;

    // A crossing, watched live: dawn or dusk has just finished.
    const changed = theme !== sunTheme;
    const event = sunEventFor(sunTheme);
    const notice = () =>
      showCustomToast(<SolarThemeToast event={event} theme={sunTheme} />, {
        id: TOAST_ID,
        duration: TOAST_DURATION_MS,
      });

    // The preference is already painting this; nothing to stage, nothing to say.
    if (!changed) {
      setThemeOverride(sunTheme);
      return;
    }

    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];

    if (reducedMotion) {
      setThemeOverride(sunTheme);
      notice();
      return;
    }

    // The sky starts; the chrome changes in the middle of it.
    const picked = { theme, preference };
    beginThemeHandover(sunTheme);
    timersRef.current.push(
      window.setTimeout(() => {
        // Someone picked a theme while the sky was moving: call the whole
        // thing off, sky included, rather than overruling them a beat later.
        if (
          pickedRef.current.theme !== picked.theme ||
          pickedRef.current.preference !== picked.preference
        ) {
          beginThemeHandover(null);
          return;
        }
        commitTheme(() => setThemeOverride(sunTheme), true);
        // The notice waits for the sky to settle, so it is not another thing
        // moving while the change is still landing.
        timersRef.current.push(
          window.setTimeout(notice, SOLAR_HANDOVER.skyMs - SOLAR_HANDOVER.chromeAtMs)
        );
      }, SOLAR_HANDOVER.chromeAtMs)
    );
  }, [
    followSun,
    sunTheme,
    theme,
    preference,
    override,
    reducedMotion,
    setThemeOverride,
    beginThemeHandover,
  ]);

  useEffect(
    () => () => {
      for (const id of timersRef.current) window.clearTimeout(id);
    },
    []
  );

  return null;
}

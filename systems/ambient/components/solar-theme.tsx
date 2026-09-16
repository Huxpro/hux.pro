"use client";

import { dismissToast, showCustomToast } from "@/components/ui/system-sonner";
import { useTheme } from "@/services";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { SOLAR_HANDOVER_MS, sunEventFor, type SolarTheme } from "../lib/solar-theme";
import { useSolarTheme } from "../provider";
import { SolarThemeToast } from "./solar-theme-toast";

// ---------------------------------------------------------------------------
// The theme follows the sun.
//
// One rule: the switch is a *crossing watched live*. This component remembers
// which side of the day it last saw (`seenRef`) and only acts when that
// changes while it is mounted — so arriving after dark does nothing, and
// sitting on the page through sunset does. That is the whole of "in the same
// session": the sun may interrupt you, it may not greet you.
//
// *When* it crosses is the end of the sunrise / sunset window rather than the
// sun's own crossing, so the dusk you were watching in Light finishes in Light
// (lib/solar-theme.ts). *How* is staged: `beginThemeHandover()` slows the sky's
// crossfade and holds the chrome back, so the sky moves first and the text and
// cards dissolve after it. The notice lands once that has settled — by then
// there is nothing to announce but what already happened.
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
/** The notice waits out the handover, so it describes a change already made. */
const TOAST_AFTER_HANDOVER_MS = 200;

export function SolarThemeSync() {
  const { followSun, sunTheme, beginThemeHandover } = useSolarTheme();
  const { theme, override, setThemeOverride } = useTheme();
  const reducedMotion = useReducedMotion() ?? false;

  /** The last reading this session has accounted for; a crossing is a change of it. */
  const seenRef = useRef<SolarTheme | null>(null);
  /** The pending notice, so a second crossing (autoplay) never stacks two. */
  const noticeRef = useRef<number | null>(null);

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
    if (!reducedMotion && changed) beginThemeHandover();
    setThemeOverride(sunTheme);
    // The preference was already painting this; there is nothing to announce.
    if (!changed) return;

    const event = sunEventFor(sunTheme);
    const show = () =>
      showCustomToast(<SolarThemeToast event={event} theme={sunTheme} />, {
        id: TOAST_ID,
        duration: TOAST_DURATION_MS,
      });

    if (reducedMotion) {
      show();
      return;
    }
    if (noticeRef.current) window.clearTimeout(noticeRef.current);
    noticeRef.current = window.setTimeout(
      show,
      SOLAR_HANDOVER_MS + TOAST_AFTER_HANDOVER_MS
    );
  }, [
    followSun,
    sunTheme,
    theme,
    override,
    reducedMotion,
    setThemeOverride,
    beginThemeHandover,
  ]);

  useEffect(() => () => {
    if (noticeRef.current) window.clearTimeout(noticeRef.current);
  }, []);

  return null;
}

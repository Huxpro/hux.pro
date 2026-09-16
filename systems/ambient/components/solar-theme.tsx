"use client";

import { dismissToast, showCustomToast } from "@/components/ui/system-sonner";
import { useLocale, useTheme } from "@/services";
import { useEffect, useRef } from "react";
import { formatClockTime } from "../lib/format";
import { sunEventFor, type SolarTheme } from "../lib/solar-theme";
import { useAmbientTime, useSolarTheme } from "../provider";
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
// What it applies is a session override on the theme (services/theme.tsx), not
// the saved Appearance preference, and the notice says so. The preference is
// untouched, an explicit choice ends the override, and closing the tab forgets
// it. Turning the setting off takes any override with it, so a behaviour that
// is off leaves nothing behind.
//
// The clock it reads is the ambient one, which is also the devtool's: the Sky
// module's dawn → dusk autoplay crosses sunrise and sunset for real as it
// sweeps, and the theme follows it exactly when — and only when — the setting
// says it should.
//
// The effect below re-runs on plenty it does not care about (the theme it just
// set, a weather refetch, the locale). That is deliberate: every path out of a
// non-crossing is an early return, so a re-run costs a comparison, and the
// alternative — holding those values in a ref — buys nothing but a way to read
// a stale one.
// ---------------------------------------------------------------------------

const TOAST_ID = "solar-theme";
const TOAST_DURATION_MS = 8_000;

export function SolarThemeSync() {
  const { followSun, setFollowSun, sunTheme } = useSolarTheme();
  const { theme, override, setThemeOverride } = useTheme();
  const { sunriseMs, sunsetMs } = useAmbientTime();
  const { locale } = useLocale();

  /** The last reading this session has accounted for; a crossing is a change of it. */
  const seenRef = useRef<SolarTheme | null>(null);

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

    // A crossing, watched live: the sun just rose, or just set.
    const event = sunEventFor(sunTheme);
    const changed = theme !== sunTheme;
    setThemeOverride(sunTheme);
    // The preference was already painting this; there is nothing to announce.
    if (!changed) return;

    const eventMs = event === "sunrise" ? sunriseMs : sunsetMs;
    showCustomToast(
      <SolarThemeToast
        event={event}
        theme={sunTheme}
        timeLabel={formatClockTime(eventMs, locale, "")}
        onUndo={() => {
          setThemeOverride(null);
          dismissToast(TOAST_ID);
        }}
        onTurnOff={() => {
          // The effect clears the override the moment this setting lands.
          setFollowSun(false);
          dismissToast(TOAST_ID);
        }}
      />,
      { id: TOAST_ID, duration: TOAST_DURATION_MS }
    );
  }, [
    followSun,
    sunTheme,
    theme,
    override,
    sunriseMs,
    sunsetMs,
    locale,
    setThemeOverride,
    setFollowSun,
  ]);

  return null;
}

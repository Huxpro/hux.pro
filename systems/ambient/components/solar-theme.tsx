"use client";

import { t, useLocale, useSunThemeSlot, useTheme } from "@/services";
import { showNotice } from "@/systems/dock";
import { useReducedMotion } from "framer-motion";
import { Sunrise, Sunset } from "lucide-react";
import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { SOLAR_HANDOVER, type SolarTheme } from "../lib/solar-theme";
import { useSolarTheme } from "../provider";

// ---------------------------------------------------------------------------
// Follow the Sun — the Appearance that is Light while the sun is up and Dark
// once it is down (services/theme.tsx).
//
// The theme service paints the sun's answer; this is what hands it in. It
// keeps the answer current under every Appearance, so choosing Follow the Sun
// lands on it at once — but only under Follow the Sun does handing it in move
// anything, and there it moves it in one of two ways:
//
//   the first answer of a visit  Follow the Sun has been trusting the system
//              until the forecast lands. If the sun disagrees, the page
//              crossfades to it once, quietly: this is the page arriving, not
//              an event.
//   a crossing  the sun has just risen or set with the page open. *When* is the
//              sun's own crossing, the middle of the day's long animation
//              rather than its end; *how* is the middle of a short one — the
//              sky moves, and the chrome cuts halfway through it, so the cut
//              has motion either side of it to hide in. Both are
//              `SOLAR_HANDOVER` in lib/solar-theme.ts; this file only runs the
//              clock. Then a small notice says what happened.
//
// The chrome's half is one commit inside a view transition: the page
// crossfades as a single composited image, the 200ms a route change already
// uses. A transition per element would cost ~1.2s of style recalculation on a
// page this size — measured — against ~60ms for this.
//
// The clock it reads is the ambient one, which is also the devtool's: the Sky
// module's play runs the day past both crossings for real, and the theme
// follows it exactly when the Appearance says it should.
//
// The effect re-runs on plenty it does not care about (the theme it just set,
// a weather refetch). That is deliberate: every path out of a non-change is an
// early return, so a re-run costs a comparison, and the alternative — holding
// those values in a ref — buys nothing but a way to read a stale one.
// ---------------------------------------------------------------------------

// The notice (a Dock notice, systems/dock). Nobody touched anything, so it
// says so — but quietly: one line at the top, not a card with buttons. By the
// time it lands the change has already dissolved in over two seconds, so there
// is nothing to confirm and nothing to undo in a hurry. Which event, which
// mode, and why — the Appearance it is following, which is where to change it.
const NOTICE_ID = "solar-theme";
const NOTICE_DURATION_MS = 5_000;

/**
 * Commit the theme as one crossfade of the whole page where the browser can do
 * it on the compositor, and as a plain change where it cannot (Firefox).
 * `flushSync` because the callback must leave the DOM in its new state before
 * it returns — React's own update would land a frame late, and the browser
 * would capture the change it was meant to animate.
 */
function commitTheme(apply: () => void) {
  if (typeof document.startViewTransition !== "function") {
    apply();
    return;
  }
  document.startViewTransition(() => flushSync(apply));
}

export function SolarThemeSync() {
  const { sunTheme, beginThemeHandover } = useSolarTheme();
  const { theme, preference } = useTheme();
  const { sunTheme: shown, setSunTheme } = useSunThemeSlot();
  const { locale } = useLocale();
  const reducedMotion = useReducedMotion() ?? false;

  /** The handover in flight, cleared whenever one ends or is called off. */
  const timersRef = useRef<number[]>([]);
  /** Where the handover in flight is going, so a re-run does not start it again. */
  const landingRef = useRef<SolarTheme | null>(null);

  useEffect(() => {
    const callOff = () => {
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
      landingRef.current = null;
      beginThemeHandover(null);
    };
    // No location or no forecast yet: the sun has no opinion, and what was
    // handed in last stands.
    if (sunTheme === null) return;

    // A handover in flight is called off, sky included, when someone picks
    // another Appearance while the sky is moving — the palette is one
    // keystroke away, and theirs wins over the sun's — or when the sun turns
    // back before it lands (the devtool's clock, scrubbed back across the line).
    if (landingRef.current !== null && (landingRef.current !== sunTheme || preference !== "sun")) {
      callOff();
    }
    if (shown === sunTheme || landingRef.current === sunTheme) return;

    // Not following: keep the answer current, where nobody sees it.
    if (preference !== "sun") {
      setSunTheme(sunTheme);
      return;
    }

    // The first answer of the visit, replacing the system's stand-in.
    if (shown === null) {
      if (theme === sunTheme || reducedMotion) setSunTheme(sunTheme);
      else commitTheme(() => setSunTheme(sunTheme));
      return;
    }

    // A crossing, watched live: the sun has just risen or just set.
    const notice = () =>
      showNotice({
        id: NOTICE_ID,
        icon: sunTheme === "light" ? Sunrise : Sunset,
        title: t(locale, sunTheme === "light" ? "solarThemeToLight" : "solarThemeToDark"),
        note: t(locale, "solarThemeNote"),
        duration: NOTICE_DURATION_MS,
      });

    if (reducedMotion) {
      setSunTheme(sunTheme);
      notice();
      return;
    }

    // The sky starts now; the two beats are read off the handover.
    landingRef.current = sunTheme;
    beginThemeHandover(sunTheme);
    timersRef.current = [
      window.setTimeout(() => commitTheme(() => setSunTheme(sunTheme)), SOLAR_HANDOVER.chromeAtMs),
      // The notice waits for the sky to settle, so it is not one more thing
      // moving while the change is still landing.
      window.setTimeout(() => {
        timersRef.current = [];
        landingRef.current = null;
        notice();
      }, SOLAR_HANDOVER.skyMs),
    ];
  }, [sunTheme, shown, theme, preference, reducedMotion, locale, setSunTheme, beginThemeHandover]);

  useEffect(
    () => () => {
      for (const id of timersRef.current) window.clearTimeout(id);
    },
    []
  );

  return null;
}

import type { SunEvent } from "./sun";

// =============================================================================
// The theme the sun implies — and when it changes hands.
//
// At the sun's own crossing, which is the *middle* of the long animation, not
// its end. Sunrise and sunset are ±45 min windows here (lib/phase.ts) and the
// sky spends all of both moving; the moment it moves fastest is the middle.
// A theme change is a cut however gently it is painted, and a cut lands softest
// inside motion — at the end of the window the sky has settled again, and the
// same cut stands out against it.
//
//   dark ─────┬──── sunrise ────┬───── light ─────┬──── sunset ────┬───── dark
//         rise-45      ▲     rise+45          set-45      ▲     set+45
//                      └ here                             └ here
//
// So the theme is simply light between sunrise and sunset — and everything
// about *how* it changes hands is in SOLAR_HANDOVER below.
// =============================================================================

export type SolarTheme = "light" | "dark";

/**
 * Which theme the sun implies at `nowMs`, or null when the sun times are not
 * known yet (no weather data, or a latitude with no sunrise that day). Null
 * means "the sun has no opinion", and nothing switches.
 */
export function solarThemeAt(params: {
  nowMs: number;
  sunriseMs?: number;
  sunsetMs?: number;
}): SolarTheme | null {
  const { nowMs, sunriseMs, sunsetMs } = params;
  if (!Number.isFinite(nowMs)) return null;
  if (!Number.isFinite(sunriseMs) || !Number.isFinite(sunsetMs)) return null;

  const rise = sunriseMs as number;
  const set = sunsetMs as number;
  if (rise === set) return null;

  // The ordinary day: sunrise, then sunset. Daylight is between them.
  if (rise < set) return nowMs >= rise && nowMs < set ? "light" : "dark";
  // Sunset before sunrise (a forecast that straddles midnight): night is the
  // stretch between them instead, and everything outside it is day.
  return nowMs >= set && nowMs < rise ? "dark" : "light";
}

/** Which event a crossing to `theme` was: getting light is a sunrise. */
export function sunEventFor(theme: SolarTheme): SunEvent {
  return theme === "light" ? "sunrise" : "sunset";
}

/**
 * The handover. The sun's crossing is the middle of the day's long animation;
 * this is the middle of the short one.
 *
 *   0ms ──────────── the sky starts moving to the new theme: the wallpaper
 *                    stack crossfades over `skyMs` instead of its usual 0.7s.
 *                    (Under the Sky style the shader eases its veil and
 *                    exposure on its own time constants, ~1.5s, so it arrives
 *                    early and waits — the CSS stack is what sets the pace.)
 *   chromeAtMs ───── halfway through it, the chrome changes — one commit,
 *                    inside a view transition, so the page crossfades as a
 *                    single composited image (the 200ms a route change uses).
 *                    The sky is at its most in-between right here, which is
 *                    the whole point: the cut has motion to hide in, on both
 *                    sides of it.
 *   skyMs ────────── the sky settles, and the notice says what happened.
 */
export const SOLAR_HANDOVER = {
  /** The sky's crossfade into the new theme. */
  skyMs: 3000,
  /** Where in it the chrome's instant switch lands: the middle. */
  chromeAtMs: 1500,
} as const;

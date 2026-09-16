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

  // The ordinary day: sunrise, then sunset, daylight between them. Reversed at
  // a latitude whose forecast day starts in daylight — then night is the
  // stretch between them instead.
  if (rise < set) return nowMs >= rise && nowMs < set ? "light" : "dark";
  return nowMs >= set && nowMs < rise ? "dark" : "light";
}

/**
 * The handover — the one description of it, in one place, because three
 * timelines in three files drifted apart the first time.
 *
 *   0          the sky starts moving to the new theme: the wallpaper stack
 *              crossfades over `skyMs` instead of its usual 0.7s, and the
 *              Sky's shader is put on the same clock (`setThemeEase`, so its
 *              veil and exposure stop arriving early on their own taus).
 *   chromeAtMs halfway through, the chrome changes — one commit, inside a view
 *              transition, so the page crossfades as a single composited image
 *              (the 200ms a route change uses). The sky is at its most
 *              in-between right here, which is the whole point: the cut has
 *              motion to hide in, on both sides of it.
 *   skyMs      the sky settles, and the notice says what happened.
 */
export const SOLAR_HANDOVER = {
  /** The sky's crossfade into the new theme, both engines. */
  skyMs: 3000,
  /** Where in it the chrome's instant switch lands: the middle. */
  chromeAtMs: 1500,
} as const;

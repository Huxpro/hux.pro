import { DEFAULT_SUN_EVENT_WINDOW_MINUTES, type SunEvent } from "./sun";

// =============================================================================
// The theme the sun implies — and how it hands over.
//
// Not at the horizon: at the end of the show. Sunrise and sunset are ±45 min
// windows here (lib/phase.ts), and the sky spends all of both animating. Cut
// the theme at the sun's crossing and you cut that animation in half — the
// dusk you were watching in Light finishes in Dark. So the theme holds through
// the window and changes when the window closes: it follows the *phase*, and
// changes exactly where the phase does, sunrise → morning and sunset →
// evening. Written as a clock rule, that is the same boundaries shifted by the
// window:
//
//   dark ─────┬─ sunrise ─┬───── light ──────┬─ sunset ─┬───── dark
//         rise-45      rise+45           set-45      set+45
//             └ still dark ┘                  └ still light ┘
//
// The handover itself is staged (SOLAR_HANDOVER): the sky moves first and
// slowly, and the chrome comes last, so the change reads as the light going
// rather than a switch being thrown.
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
  /** Half-width of the sunrise / sunset windows the theme waits out. */
  windowMinutes?: number;
}): SolarTheme | null {
  const { nowMs, sunriseMs, sunsetMs } = params;
  if (!Number.isFinite(nowMs)) return null;
  if (!Number.isFinite(sunriseMs) || !Number.isFinite(sunsetMs)) return null;

  const windowMs =
    (params.windowMinutes ?? DEFAULT_SUN_EVENT_WINDOW_MINUTES) * 60_000;
  // The end of each window — where the phase changes, and with it the theme.
  const rise = (sunriseMs as number) + windowMs;
  const set = (sunsetMs as number) + windowMs;
  if (rise === set) return null;

  // The ordinary day: dawn ends, then dusk ends. Daylight is between them.
  if (rise < set) return nowMs >= rise && nowMs < set ? "light" : "dark";
  // Dusk before dawn (a forecast that straddles midnight): night is the
  // stretch between them instead, and everything outside it is day.
  return nowMs >= set && nowMs < rise ? "dark" : "light";
}

/** Which event a crossing to `theme` was: getting light is a sunrise. */
export function sunEventFor(theme: SolarTheme): SunEvent {
  return theme === "light" ? "sunrise" : "sunset";
}

/**
 * The handover, in order. The theme changes in one tick — everything derived
 * from it stays in agreement — and what is staged is the *painting* of it:
 *
 *   0ms ──────────── the sky. A slower crossfade than the usual push, and
 *                    under the Sky style the shader is already easing its
 *                    veil and exposure over about the same stretch.
 *   chromeDelayMs ── the chrome. Text, cards, borders dissolve into the new
 *                    theme once the sky is most of the way there.
 *   ...+chromeMs ─── settled, and the notice says what happened.
 *
 * The two chrome numbers are also written to <html> as custom properties, so
 * the CSS rule behind `data-theme-shift` (app/globals.css) is timed from here
 * rather than from a second copy of them.
 */
export const SOLAR_HANDOVER = {
  /** The wallpaper stack's crossfade for this one change. */
  skyMs: 1800,
  /** How long the chrome holds the outgoing theme while the sky moves. */
  chromeDelayMs: 1200,
  /** How long the chrome takes to dissolve once it starts. */
  chromeMs: 1000,
} as const;

/** End to end: the sky starts, the chrome finishes. */
export const SOLAR_HANDOVER_MS =
  SOLAR_HANDOVER.chromeDelayMs + SOLAR_HANDOVER.chromeMs;

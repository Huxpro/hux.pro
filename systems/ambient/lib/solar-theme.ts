import type { SunEvent } from "./sun";

// =============================================================================
// The theme the sun implies.
//
// One rule, and it is the obvious one: between sunrise and sunset the world is
// light, outside it dark. No window, no easing — the gradient already spends
// ±45 minutes crossing dawn and dusk (lib/phase.ts); the theme is the moment
// the sun itself is at the horizon, so the flip lands in the middle of a sky
// that is already changing rather than against a settled one.
//
// This says nothing about whether to apply it. <SolarThemeSync /> watches this
// value cross while the page is open — that crossing, not the value, is what
// the switch is made of.
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

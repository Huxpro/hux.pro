import { currentThemeMetadata } from "../../lib/root";

// =============================================================================
// Haptics — the few moments Android's launcher answers with the motor.
//
// Launcher3 plays a `LONG_PRESS` effect when a widget comes off the grid, a
// `CLOCK_TICK` each time a resize crosses a cell (the texture of the drag),
// and a light confirm when it is set down. The web has one primitive —
// `navigator.vibrate(ms)` — so each constant is a duration tuned to feel like
// the Pixel effect it stands for: a crisp click, not a buzz.
//
// Only in a theme with `haptics` (Android), and only where there is a finger: a desktop has no
// motor, and Glass is iOS, where Safari exposes none. Silently nothing
// elsewhere — haptics are a second channel, never the only one.
// =============================================================================

export type Haptic = "long-press" | "tick" | "confirm";

const MS: Record<Haptic, number> = {
  "long-press": 12,
  tick: 4,
  confirm: 8,
};

export function haptic(kind: Haptic) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  if (!currentThemeMetadata().haptics) return;
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  try {
    navigator.vibrate(MS[kind]);
  } catch {
    // Blocked without a user activation: nothing to feel, nothing to do.
  }
}

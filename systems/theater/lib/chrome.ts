import { cn } from "@/lib/utils";

// =============================================================================
// Theater / talks chrome — the pieces only playback uses.
//
// The glass material itself is not theater's: the frosted track, the lifted
// pill, the clustered toolbars and their on-dark twins live in `lib/glass.ts`,
// shared with music, the widgets and the wallpaper picker. What stays here is
// what nothing outside talks would want.
// =============================================================================

/**
 * Page veil under the theater stage. Same frosted glass as WidgetShell and
 * Live Activity (`bg-glass` + `backdrop-blur-xl`), a notch lighter than their
 * fill so a full-page wash doesn't black out the homepage.
 *
 * "A notch lighter" is an opacity modifier on the token rather than a literal
 * card alpha, and it is the only one of its kind: it keeps the relationship
 * that matters — 80% of whatever the widget glass is — so the veil follows the
 * Tinted/Clear setting with the cards instead of staying a Tinted-strength wash
 * over a Clear page. In Tinted that is exactly the 40% it was tuned to.
 */
export const THEATER_BACKDROP = cn("bg-glass/80 backdrop-blur-xl");

/**
 * Card press: a thumbnail / cover sinks slightly under the finger and springs
 * back on release (Featured Talks thumbs, the theater playlist rail).
 */
export const PRESS_CARD = cn(
  "pressable transition-[opacity,transform] duration-200 active:scale-[0.97]",
);

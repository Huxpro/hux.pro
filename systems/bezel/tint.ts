// =============================================================================
// Bezel — what colour the frame is.
//
// ONE colour, decided when the page loads and never touched again until the
// next load. That is the whole contract, and it is ryOS's: a static
// `background-color` on <html> and <body>, and nothing that re-resolves it
// when the theme flips, the wallpaper changes or a setting moves.
//
// Everything else was tried first and each attempt was another heuristic for
// Safari to disagree with on a phone — a tint that followed the theme, a
// band thick enough to be sampled, a theme-color kept in step. What Safari
// actually does is simpler than any of them (measured on iOS 26.5): it tints
// its chrome from `position: fixed` content at the edge of the viewport, and
// when there is none, from the root background. So the frame colour lives on
// the root background, the locked document keeps fixed content off the edges,
// and the chrome has exactly one thing to copy.
//
// The boot script in app/layout.tsx resolves the stored tint with the rules
// below and writes the result; changing the setting takes effect on the next
// load. It cannot import at runtime, so it interpolates these constants.
// =============================================================================

/** The host page's own ground, per theme. `dark` borrows its dark half. */
export interface BezelGround {
  light: string;
  dark: string;
}

/**
 * What colour the frame is.
 *
 *   black   the default, and ryOS's. Both iOS generations honour it exactly.
 *   dark    the page's dark ground, in both themes — a fixed colour, not one
 *           that follows the theme.
 *   #rrggbb anything else.
 *
 * There is deliberately no tint that follows the theme. It was the one that
 * kept changing on a phone, because following the theme means re-resolving
 * after load, and after load is exactly when the colour must not move.
 */
export type BezelTint = "black" | "dark" | `#${string}`;

/** The named tints, in the order a picker should offer them. */
export const BEZEL_TINTS = ["black", "dark"] as const;

export const BEZEL_BLACK = "#000000";

const HEX = /^#[0-9a-f]{6}$/i;
/** The source of truth for the boot script's own copy of this test. */
export const BEZEL_HEX_PATTERN = "^#[0-9a-fA-F]{6}$";

/** Whether a string is a `#rrggbb` literal, i.e. a custom tint. */
export function isBezelHex(value: string): value is `#${string}` {
  return HEX.test(value);
}

export function isBezelTint(value: unknown): value is BezelTint {
  if (typeof value !== "string") return false;
  return (BEZEL_TINTS as readonly string[]).includes(value) || isBezelHex(value);
}

/** The tint as a colour a browser can paint. */
export function resolveBezelTint(tint: BezelTint, ground: BezelGround): string {
  if (tint === "black") return BEZEL_BLACK;
  if (tint === "dark") return ground.dark;
  return tint;
}

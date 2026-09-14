// =============================================================================
// Bezel — what colour the frame is.
//
// Split from the component because three consumers need the answer at three
// different times: the CSS that paints the frame, whatever sets `theme-color`,
// and a boot script that runs before first paint and cannot import at runtime,
// so it interpolates these constants into its own source instead. One resolver
// means they cannot drift.
// =============================================================================

/** The host page's own ground, per theme. What `dark` and `theme` borrow from. */
export interface BezelGround {
  light: string;
  dark: string;
}

/**
 * What colour the frame is.
 *
 *   dark    the ground's dark half, in both themes. The frame is chrome and
 *           chrome is dark, so a light page still sits in a dark bezel.
 *   black   ryOS's black. Both iOS generations honour it exactly (measured on
 *           26.5 and 18.5); the older note that Safari refuses a black tint
 *           does not reproduce on either.
 *   theme   follows the ground, so the frame matches the page instead of
 *           framing it.
 *   #rrggbb anything else.
 */
export type BezelTint = "dark" | "black" | "theme" | `#${string}`;

/** The named tints, in the order a picker should offer them. */
export const BEZEL_TINTS = ["dark", "black", "theme"] as const;

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
export function resolveBezelTint(
  tint: BezelTint,
  ground: BezelGround,
  theme: "light" | "dark"
): string {
  if (tint === "black") return BEZEL_BLACK;
  if (tint === "theme") return ground[theme];
  if (tint === "dark") return ground.dark;
  return tint;
}

// =============================================================================
// Letterbox — the frame's colour and thickness.
//
// Three places have to agree on these, and they run at three different times:
// the CSS that paints the bands, the corners and the page ground; the provider
// effect that sets `theme-color`; and the boot script in app/layout.tsx, which
// has to have the answer before first paint and cannot import at runtime. This
// module is what they all read, so they cannot drift. It deliberately imports
// nothing.
//
// Everything here is applied through two custom properties on <html>, set by
// the boot script and then owned by the provider. CSS reads them; nothing has
// to be recompiled to change a colour.
// =============================================================================

/** Custom property carrying the frame colour. */
export const LETTERBOX_COLOR_VAR = "--letterbox";
/** Custom property carrying the band thickness, as a CSS length. */
export const LETTERBOX_BAND_VAR = "--letterbox-band";

/** The page's own ground, per theme. What `theme` tint borrows from. */
export const PAGE_GROUND = { light: "#ffffff", dark: "#1a1a1a" } as const;

/**
 * What colour the frame is.
 *
 *   dark    the dark ground in both themes. The frame is chrome and chrome is
 *           dark, so a light page still sits in a dark bezel. The default.
 *   black   ryOS's black. Both iOS generations honour it exactly (measured on
 *           26.5 and 18.5); the older note that Safari refuses a black tint
 *           does not reproduce on either.
 *   theme   follows the page ground, so the frame matches the page instead of
 *           framing it: white in light, dark in dark.
 *   #rrggbb anything else.
 */
export type LetterboxTint = "dark" | "black" | "theme" | `#${string}`;

/** The named tints, in the order the devtool offers them. */
export const LETTERBOX_TINTS = ["dark", "black", "theme"] as const;

const HEX = /^#[0-9a-f]{6}$/i;

/** Whether a string is a `#rrggbb` literal, i.e. a custom tint. */
export function isLetterboxHex(value: string): value is `#${string}` {
  return HEX.test(value);
}

export function isLetterboxTint(value: unknown): value is LetterboxTint {
  if (typeof value !== "string") return false;
  return (
    (LETTERBOX_TINTS as readonly string[]).includes(value) ||
    isLetterboxHex(value)
  );
}

/** The tint as a colour a browser can paint. */
export function resolveLetterboxColor(
  tint: LetterboxTint,
  theme: "light" | "dark"
): string {
  if (tint === "black") return "#000000";
  if (tint === "theme") return PAGE_GROUND[theme];
  if (tint === "dark") return PAGE_GROUND.dark;
  return tint;
}

/**
 * The band's thickness floor, and it is not cosmetic.
 *
 * Safari reports every safe-area inset as zero in portrait — its own chrome
 * already occupies the notch and home-indicator bands — so a frame sized from
 * `env()` alone has no thickness there and the wallpaper runs to the edge of
 * the web view. The band is also what colours Safari's chrome on iOS 26, which
 * is glass and tints from a strip of the page's edge about 6px tall: 4px and
 * 5px bands do not register, 6px and up do (measured on 26.5). Below the floor
 * the frame and the chrome stop matching. For no frame at all, turn the
 * letterbox off rather than thinning it to nothing.
 */
export const LETTERBOX_BAND_MIN = 6;
export const LETTERBOX_BAND_MAX = 64;
/** Clears the sampling strip with room to spare, and costs almost no page. */
export const DEFAULT_LETTERBOX_BAND = 8;

export const LETTERBOX_RADIUS_MIN = 0;
export const LETTERBOX_RADIUS_MAX = 64;
/** ryOS ships 12; a phone's own corners are far larger, and 24 reads as one. */
export const DEFAULT_LETTERBOX_RADIUS = 24;

export const DEFAULT_LETTERBOX_TINT: LetterboxTint = "dark";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

export function clampLetterboxBand(px: number): number {
  return clamp(px, LETTERBOX_BAND_MIN, LETTERBOX_BAND_MAX);
}

export function clampLetterboxRadius(px: number): number {
  return clamp(px, LETTERBOX_RADIUS_MIN, LETTERBOX_RADIUS_MAX);
}

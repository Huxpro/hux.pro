// =============================================================================
// Bezel — how thick the frame is, and the box it leaves for the page.
//
// The frame's colour and thickness travel as two custom properties on the root
// element rather than as props, because they have to be right before React
// exists: a boot script sets them so the very first painted frame is already
// framed, and everything downstream — the bands, the corners, the page's own
// background, the caller's inset layers — reads the same two values. `<Bezel>`
// keeps them in step afterwards.
// =============================================================================

/** Custom property carrying the frame colour. */
export const BEZEL_COLOR_VAR = "--bezel";
/** Custom property carrying the band thickness, as a CSS length. */
export const BEZEL_BAND_VAR = "--bezel-band";
/** Class the root element carries while a bezel is up. */
export const BEZEL_CLASS = "bezel";

/**
 * The band's thickness floor, and it is not cosmetic.
 *
 * Safari reports every safe-area inset as zero in portrait — its own chrome
 * already occupies the notch and home-indicator bands — so a frame sized from
 * `env()` alone has no thickness there and the page runs to the edge of the
 * web view. The band is also what colours Safari's chrome on iOS 26, which is
 * glass and tints from a strip of the page's edge about 6px tall: 4px and 5px
 * bands do not register, 6px and up do (measured on 26.5). Below the floor the
 * frame and the chrome stop matching. For no frame at all, unmount the bezel
 * rather than thinning it to nothing.
 */
export const BEZEL_BAND_MIN = 6;
export const BEZEL_BAND_MAX = 64;
/** Clears the sampling strip with room to spare, and costs almost no page. */
export const DEFAULT_BEZEL_BAND = 8;

export const BEZEL_RADIUS_MIN = 0;
export const BEZEL_RADIUS_MAX = 64;
/** ryOS ships 12; a phone's own corners are far larger, and 24 reads as one. */
export const DEFAULT_BEZEL_RADIUS = 24;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

export function clampBezelBand(px: number): number {
  return clamp(px, BEZEL_BAND_MIN, BEZEL_BAND_MAX);
}

export function clampBezelRadius(px: number): number {
  return clamp(px, BEZEL_RADIUS_MIN, BEZEL_RADIUS_MAX);
}

/**
 * The fallback in each `var()` is what applies for the one frame before the
 * boot script runs, and anywhere a bezel is rendered without one.
 */
const BAND = `var(${BEZEL_BAND_VAR}, ${DEFAULT_BEZEL_BAND}px)`;

/** The top band's height: the safe area, never thinner than the band. */
export const BEZEL_BAND_TOP = `max(env(safe-area-inset-top, 0px), ${BAND})`;
/** The bottom band's height. */
export const BEZEL_BAND_BOTTOM = `max(env(safe-area-inset-bottom, 0px), ${BAND})`;

/**
 * The side bands take the safe area as it comes, with no floor. In portrait it
 * is zero and the page runs edge to edge, which is the look the frame was
 * drawn for. In landscape it is the notch: 62px on an iPhone 17 Pro, on the
 * side the Dynamic Island is on and on the other side to match. Without them
 * the page runs under the island. There is no chrome to tint out there, so
 * nothing wants a floor.
 */
export const BEZEL_BAND_LEFT = "env(safe-area-inset-left, 0px)";
/** The right band's width. */
export const BEZEL_BAND_RIGHT = "env(safe-area-inset-right, 0px)";

/**
 * The box the page gets to paint in: inside the bands. Spread onto anything
 * the bezel is meant to contain — a fixed background layer, a ground colour —
 * on top of `fixed inset-0`. It reads the same custom property the frame does,
 * so the two can never disagree.
 */
export const BEZEL_INSET = {
  top: BEZEL_BAND_TOP,
  bottom: BEZEL_BAND_BOTTOM,
  left: BEZEL_BAND_LEFT,
  right: BEZEL_BAND_RIGHT,
} as const;

/**
 * Put the frame's colour and thickness on the root element. `<Bezel>` calls
 * this itself; it is exported for the pre-paint path, where a boot script has
 * to do the same thing before any of this module is loaded.
 *
 * The plain `background-color` alongside the custom property is deliberate: it
 * is what paints the frame in the moment before the stylesheet arrives, and
 * being inline it would otherwise go stale and outrank the stylesheet's rule
 * once the colour changed.
 */
export function applyBezelVars(
  root: HTMLElement,
  { color, band }: { color: string; band: number }
): void {
  root.classList.add(BEZEL_CLASS);
  root.style.setProperty(BEZEL_COLOR_VAR, color);
  root.style.setProperty(BEZEL_BAND_VAR, `${band}px`);
  root.style.backgroundColor = color;
}

/** Take the frame back off. */
export function clearBezelVars(root: HTMLElement): void {
  root.classList.remove(BEZEL_CLASS);
  root.style.removeProperty(BEZEL_COLOR_VAR);
  root.style.removeProperty(BEZEL_BAND_VAR);
  root.style.backgroundColor = "";
}

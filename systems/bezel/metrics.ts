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
 * How tall a strip of the page's edge the browser's chrome tints itself from.
 *
 * On iOS 26 that chrome is glass and samples the page rather than reading
 * `theme-color`, which it ignores outright. It wants about 6px of FLAT colour
 * there: a 4px or 5px band does not register, 6px and up does (measured on
 * 26.5). A thinner band still draws — it just stops carrying the chrome with
 * it, and the chrome falls back to Safari's own colour, white in light mode.
 * Which makes the middle the bad part: at 4px you get a hairline of frame
 * under a white status bar. At 0 there is no frame to mismatch and the page
 * simply runs edge to edge inside its rounded corners, which is a look.
 *
 * That is a look, not a fault, which is why it is a threshold and not a floor.
 * ryOS gets a black chrome with no band at all and a light page edge, so
 * something makes `theme-color` authoritative there; ruled out so far, none of
 * them it: http vs https, its entire `<head>` verbatim, an inline `<html>`
 * background, scrollable vs non-scrolling documents, and a composited edge
 * layer. Unresolved.
 */
export const BEZEL_CHROME_SAMPLE_PX = 6;

/** Zero is allowed: it means corners and side bands, and no top or bottom. */
export const BEZEL_BAND_MIN = 0;
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
 * The fallback in the `var()` is what applies for the one frame before the
 * boot script runs, and anywhere a bezel is rendered without one.
 */
const BAND = `var(${BEZEL_BAND_VAR}, ${DEFAULT_BEZEL_BAND}px)`;

/**
 * Top and bottom are the band and nothing more — deliberately NOT the safe
 * area.
 *
 * A frame is a frame; the safe area is about occlusion, and the page's own
 * content already keeps itself clear of that with its own `env()` padding.
 * Taking the safe area here too only cost screen. In a Home Screen web app
 * that was 59px at the top and 34px at the bottom of flat colour, on a phone
 * that has no browser chrome to be continuous with in the first place — the
 * page could not reach the bottom of its own screen. ryOS does not reserve it
 * either: its desktop runs edge to edge and only the corners are masked.
 *
 * In Safari this changes nothing. The safe-area insets are zero there, so the
 * band was always what the frame measured.
 */
export const BEZEL_BAND_TOP = BAND;
/** The bottom band's height. */
export const BEZEL_BAND_BOTTOM = BAND;

/**
 * The sides are the exception, and they take the safe area instead: in
 * landscape that is the notch, 62px on an iPhone 17 Pro, and it is a hole in
 * the screen rather than a margin — a picture running under it reads as a bite
 * taken out of the picture. In portrait it is zero and the page runs edge to
 * edge, which is the look the frame was drawn for.
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

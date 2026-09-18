// Names the stylesheet, the boot script and the runtime share. Internal: the
// public constants are re-exported from ./index.

/** On <html> while the bezel is drawn. */
export const BEZEL_ATTRIBUTE = "data-bezel";
/** On <html> with value "container" while the page scrolls in the container. */
export const SCROLL_ATTRIBUTE = "data-bezel-scroll";
/**
 * On <html> while container scroll is holding the window a few pixels down, so
 * that a status-bar tap has a main-frame scroll to perform. See status-tap.ts.
 */
export const STATUS_TAP_ATTRIBUTE = "data-bezel-status-tap";
/** Marks a fixed layer that must become absolute in container scroll. */
export const BEZEL_LAYER_ATTRIBUTE = "data-bezel-layer";

/** Custom property carrying the bezel colour. */
export const COLOR_VAR = "--bezel-color";
/** Custom property carrying the band thickness, as a CSS length. */
export const BAND_VAR = "--bezel-band";

/** The page's scroll container. */
export const SCROLL_CONTAINER_ID = "bezel-scroll";
/** The `theme-color` meta the package owns. */
export const THEME_COLOR_ID = "bezel-theme-color";
/** The <style> element carrying the stylesheet. */
export const STYLE_ID = "bezel-style";
/** Property on `window` the boot script records its state under. */
export const BOOT_GLOBAL = "__bezel";

/**
 * How far down the window is parked while it is armed for a status-bar tap,
 * and how much room <html> is given to park in. Four pixels rather than one:
 * Safari can hand back a fractional `scrollY` under pinch-zoom, and a park
 * that cannot be told apart from the top is a gesture that never arrives.
 * Both are invisible — <body> is fixed, so the document has nothing to move.
 */
export const STATUS_TAP_PARK_PX = 2;
export const STATUS_TAP_RANGE_PX = 4;

/** Thinnest fixed content, px, that iOS 26 Safari's chrome follows (5 does not). */
export const CHROME_SAMPLE_PX = 6;
/** The band syncChrome morphs to: the threshold with a margin. */
export const CHROME_MORPH_PX = 8;

export const DEFAULT_BEZEL_BAND = 0;
export const DEFAULT_BEZEL_RADIUS = 16;
export const BEZEL_BAND_MIN = 0;
export const BEZEL_BAND_MAX = 64;
export const BEZEL_RADIUS_MIN = 0;
export const BEZEL_RADIUS_MAX = 64;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

export function clampBezelBand(px: number): number {
  return clamp(px, BEZEL_BAND_MIN, BEZEL_BAND_MAX);
}

export function clampBezelRadius(px: number): number {
  return clamp(px, BEZEL_RADIUS_MIN, BEZEL_RADIUS_MAX);
}

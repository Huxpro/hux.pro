// =============================================================================
// Bezel — how thick the frame is, and the box it leaves for the page.
//
// The frame's colour is fixed per page load (./tint); the frame's class and the
// document lock come and go with the frame (./boot, ./page-scroll). The band's
// thickness is live too: it changes where the page's box ends, not what colour
// anything outside it is, so moving it cannot give Safari anything new to copy
// into its chrome.
// =============================================================================

/** Custom property carrying the frame colour. */
export const BEZEL_COLOR_VAR = "--bezel";
/** Custom property carrying the band thickness, as a CSS length. */
export const BEZEL_BAND_VAR = "--bezel-band";
/** Class the root element carries while a bezel is up. */
export const BEZEL_CLASS = "bezel";

/**
 * How thick a band has to be before the browser's chrome copies it — on a page
 * that is NOT locked.
 *
 * On iOS 26 the chrome ignores `theme-color` and samples fixed content at the
 * viewport edge. A fixed band of the frame colour registers from 6px (5px does
 * not, bisected at @3x and @2x, so it is 6 CSS px on every screen). Thinner,
 * and the chrome copies whatever is composited beneath instead.
 *
 * On a LOCKED phone — the only place the frame is drawn by default — this no
 * longer decides anything. There, nothing fixed spans the edge (globals.css),
 * so the chrome takes the root background, which is the frame colour at any
 * band, 0 included. That is also the answer to what looked like a ryOS
 * anomaly: a black chrome over a light page edge with no band at all. ryOS
 * paints its desktop in a fixed, non-scrolling body with nothing fixed at the
 * edge, so Safari has only the root background to copy.
 */
export const BEZEL_CHROME_SAMPLE_PX = 6;

/** Zero is allowed: it means corners and side bands, and no top or bottom. */
export const BEZEL_BAND_MIN = 0;
export const BEZEL_BAND_MAX = 64;
/**
 * Two pixels over the threshold. 6 works today on everything measured, but it
 * sits exactly on the cliff, and 2px of screen is a cheap price for not
 * falling off it on a device or a Safari version nobody has tested.
 */
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
 * Keep the band's thickness in step with a setting. `<Bezel>` calls this; it is
 * the only runtime write to the root element the frame makes.
 */
export function applyBezelBand(root: HTMLElement, band: number): void {
  root.style.setProperty(BEZEL_BAND_VAR, `${band}px`);
}

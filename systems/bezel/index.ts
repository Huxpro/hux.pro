// =============================================================================
// Bezel System — the frame a page sits in on a phone, after ryOS.
//
// Everything outside the page becomes one flat frame, the browser's own chrome
// included, and the page stops on a clean line inside it, rounded off at the
// corners the way iOS rounds every app's window. ryOS (os.ryo.lu) is the model,
// and on an iOS phone this follows it all the way, in two rules:
//
//   1. ONE colour, decided at load. A black `<html>` and `<body>` by default,
//      written by a boot script before first paint and never re-resolved —
//      not when the theme flips, not when a setting changes. See ./tint.
//   2. THE DOCUMENT DOES NOT SCROLL. `<body>` is fixed and the page scrolls in
//      `#scroll-root`. See ./page-scroll.
//
// Together they leave Safari nothing to reconsider. Measured on iOS 26.5, its
// chrome takes its colour from `position: fixed` content at the viewport edge
// and, failing that, from the root background; `theme-color` is ignored. Every
// earlier attempt here was a heuristic that gave it something else to copy — a
// band thick enough to be sampled, a tint that followed the theme — and on a
// real phone each of them came out differently. A root background that never
// changes, under a document that never scrolls and never collapses the
// toolbar, has only one answer.
//
//   <Bezel enabled={bootDecision} band={8} radius={24} />
//
// and everything the frame is meant to contain takes the same box:
//
//   <div style={BEZEL_INSET} />
//
// Anything that reads or drives page scroll uses ./page-scroll, not `window`.
// The `theme-color` meta is left to the host — iOS 18 still reads it — and it
// too is written once.
// =============================================================================

export { Bezel, type BezelProps } from "./bezel";

export {
  applyBezelBoot,
  keepBezelBoot,
  readBezelBoot,
  BEZEL_BOOT_GLOBAL,
  BEZEL_THEME_COLOR_ID,
  type BezelBootDecision,
} from "./boot";

export {
  applyBezelBand,
  clampBezelBand,
  clampBezelRadius,
  BEZEL_BAND_BOTTOM,
  BEZEL_BAND_LEFT,
  BEZEL_BAND_MAX,
  BEZEL_BAND_MIN,
  BEZEL_BAND_RIGHT,
  BEZEL_BAND_TOP,
  BEZEL_BAND_VAR,
  BEZEL_CHROME_SAMPLE_PX,
  BEZEL_CLASS,
  BEZEL_COLOR_VAR,
  BEZEL_INSET,
  BEZEL_RADIUS_MAX,
  BEZEL_RADIUS_MIN,
  DEFAULT_BEZEL_BAND,
  DEFAULT_BEZEL_RADIUS,
} from "./metrics";

export {
  emitPageScroll,
  getPageScrollRoot,
  onPageScroll,
  pageOffsetOf,
  pageScrollHeight,
  pageScrollTop,
  pageViewportHeight,
  scrollPageTo,
  BEZEL_LOCK_CLASS,
  BEZEL_SCROLL_ROOT_ID,
} from "./page-scroll";

export {
  isBezelHex,
  isBezelTint,
  resolveBezelTint,
  BEZEL_BLACK,
  BEZEL_HEX_PATTERN,
  BEZEL_TINTS,
  type BezelGround,
  type BezelTint,
} from "./tint";

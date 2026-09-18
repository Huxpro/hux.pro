import {
  BAND_VAR,
  BEZEL_ATTRIBUTE,
  BEZEL_LAYER_ATTRIBUTE,
  COLOR_VAR,
  SCROLL_ATTRIBUTE,
  SCROLL_CONTAINER_ID,
  STATUS_TAP_ATTRIBUTE,
  STATUS_TAP_RANGE_PX,
  STYLE_ID,
} from "./constants";

// =============================================================================
// The stylesheet.
//
// Shipped as a string, not a .css file, so the package needs no bundler
// support and the boot script can install it before first paint. <Bezel>
// installs it too, for hosts without a boot script. It is unlayered on
// purpose: it must beat a host's layered `body { background }`.
//
// Measured on iOS 26.5 Safari, which is what every rule here is for:
//
//   - The chrome takes its colour from `position: fixed` content spanning the
//     viewport edge — even transparent content, whose composited background it
//     copies — and otherwise from the root background.
//   - The toolbar collapses only when the DOCUMENT scrolls, and each collapse
//     is a relayout and a fresh look at what is under the chrome.
//
// So in container scroll the document does not scroll with the page, and
// nothing fixed spans the edge: <body> is fixed at inset 0, and its fixed
// children become absolute, which is the identical box because <body> never
// moves. Its overflow is `clip`, not `hidden`: `hidden` would make <body> a
// scroll container that `scrollIntoView` and `focus()` can still move, and a
// bottom sheet resting below the edge at a lower detent is exactly the
// overflow they would move it for. `clip` cuts without ever scrolling.
//
// The armed rules are the one exception, and they apply only while the page is
// away from the top. WebKit sets scrollsToTop = NO on overflow UIScrollViews,
// so a tap on the status bar never reaches the container; giving <html> a few
// pixels of scroll range gives Safari a main-frame scroll to perform, which is
// the only way the page can observe the gesture. Nothing moves on screen: the
// document has nothing to scroll, because <body> is fixed.
//
// The range is a pseudo-element rather than a height, so an unarmed page has
// no overflow at all to be found by anything that measures the document.
// `position: relative` on <html> is its containing block; it does not contain
// `position: fixed`, which the chrome morph still parents to <html>.
//
// Being armed also means <html> no longer reads as `overflow: hidden`, which
// is how overlay libraries decide the page is already locked. That is why the
// arming is short-lived and stands down the moment one of them takes over —
// see status-tap.ts.
// =============================================================================

const html = "html";
const on = `${html}[${BEZEL_ATTRIBUTE}]`;
const contained = `${html}[${SCROLL_ATTRIBUTE}="container"]`;
const armed = `${contained}[${STATUS_TAP_ATTRIBUTE}]`;
const container = `#${SCROLL_CONTAINER_ID}`;

export const BEZEL_CSS = `
:root{${COLOR_VAR}:#000;${BAND_VAR}:0px}
${on},${on} body{background-color:var(${COLOR_VAR})}
${contained}{height:100%;overflow:hidden;overscroll-behavior:none;position:relative}
${armed}{overflow-y:auto;scrollbar-width:none}
${armed}::-webkit-scrollbar{display:none;width:0;height:0}
${armed}::after{content:"";position:absolute;top:100%;left:0;width:1px;height:${STATUS_TAP_RANGE_PX}px;pointer-events:none}
${contained} body{position:fixed;inset:0;overflow:clip;overscroll-behavior:none}
${contained} body>.fixed,${contained} body>[style*="position:fixed"],${contained} body>[style*="position: fixed"],${contained} [${BEZEL_LAYER_ATTRIBUTE}]{position:absolute!important}
${contained} ${container}{position:absolute;min-height:0;overflow-x:clip;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain}
`.trim();

/** Install the stylesheet into `document`, once. */
export function ensureBezelStyle(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = BEZEL_CSS;
  doc.head.appendChild(style);
}

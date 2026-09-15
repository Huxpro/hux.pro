import {
  BAND_VAR,
  BEZEL_ATTRIBUTE,
  BEZEL_LAYER_ATTRIBUTE,
  COLOR_VAR,
  SCROLL_ATTRIBUTE,
  SCROLL_CONTAINER_ID,
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
// So in container scroll the document never scrolls, and nothing fixed spans
// the edge: <body> is fixed at inset 0, and its fixed children become absolute,
// which is the identical box because <body> never moves. Its overflow is
// `clip`, not `hidden`: `hidden` would make <body> a scroll container that
// `scrollIntoView` and `focus()` can still move, and a bottom sheet resting
// below the edge at a lower detent is exactly the overflow they would move it
// for. `clip` cuts without ever scrolling.
// =============================================================================

const html = "html";
const on = `${html}[${BEZEL_ATTRIBUTE}]`;
const contained = `${html}[${SCROLL_ATTRIBUTE}="container"]`;
const container = `#${SCROLL_CONTAINER_ID}`;

export const BEZEL_CSS = `
:root{${COLOR_VAR}:#000;${BAND_VAR}:0px}
${on},${on} body{background-color:var(${COLOR_VAR})}
${contained}{height:100%;overflow:hidden;overscroll-behavior:none}
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

// =============================================================================
// The strike — a bolt on demand, on a thunder day.
//
// `lightning()` in the shader is weather: it fires on its own schedule, wherever
// it likes. A strike is an *answer*. On a thunder day (and only then) a click on
// the wallpaper calls one bolt down onto the spot that was clicked, over roughly
// a second, and the sky lights up with it.
//
// This module is the part with no engine in it: how long a strike lives, how
// often one may fire, and the one question the interaction turns on — did that
// click land on the sky, or on something?
//
// "On the sky" is not a guess. A click is on the background when nothing between
// the clicked element and <body> paints anything: no background colour, no
// background image, no backdrop filter, and nothing interactive on the way up.
// That is the same question the visitor answered with their eyes — the pixel
// under the pointer was wallpaper — so the two can never disagree.
// =============================================================================

/** How long one strike lives, ms. The shader envelope and the CSS flash agree on it. */
export const STRIKE_MS = 1200;

/**
 * The shortest gap between two strikes, ms. Clicking as fast as you can is
 * capped at two flashes a second — a full-screen flash is exactly the thing
 * that must never become a strobe (WCAG allows three; we allow two).
 */
export const STRIKE_COOLDOWN_MS = 500;

/** Mark a transparent layer that should still swallow strikes. */
export const STRIKE_OPT_OUT_ATTR = "data-no-strike";

/**
 * Things a click can land *on*. A click here is on the thing, not on the sky —
 * even when the thing is transparent, as a bare link over the wallpaper is.
 */
const INTERACTIVE = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "label",
  "summary",
  "audio",
  "video",
  "iframe",
  "canvas",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="slider"]',
  '[role="switch"]',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  `[${STRIKE_OPT_OUT_ATTR}]`,
].join(",");

/**
 * Does this colour paint nothing? `transparent`, and any notation whose alpha
 * is zero — `rgba(0, 0, 0, 0)` from legacy colours, `oklch(… / 0)` from the
 * Tailwind v4 palette, `color(srgb … / 0)` from a wide-gamut one.
 */
function paintsNothing(color: string): boolean {
  if (!color || color === "transparent" || color === "none") return true;
  // Modern notation carries its alpha after a slash: `oklch(L C H / 0)`.
  if (/\/\s*0*(?:\.0+)?%?\s*\)$/.test(color)) return true;
  // Legacy notation only has one when there are four components: an opaque
  // `rgb(0, 0, 0)` also ends in a zero, so counting them is the whole test.
  const legacy = color.match(/^rgba?\(([^)]+)\)$/);
  if (!legacy) return false;
  const parts = legacy[1].split(/[\s,/]+/).filter(Boolean);
  return parts.length === 4 && parseFloat(parts[3]) === 0;
}

/** Does this element paint over the wallpaper? */
function paintsOver(style: CSSStyleDeclaration): boolean {
  if (!paintsNothing(style.backgroundColor)) return true;
  if (style.backgroundImage !== "none") return true;
  const backdrop =
    style.backdropFilter ??
    (style as CSSStyleDeclaration & { webkitBackdropFilter?: string })
      .webkitBackdropFilter;
  return Boolean(backdrop) && backdrop !== "none";
}

/**
 * Did this click land on the wallpaper rather than on the page?
 *
 * Walks from the clicked element up to <body>, exclusive: the body and the
 * layers below it *are* the background, so their own paint is the wallpaper's.
 */
export function isBackgroundClick(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const body = target.ownerDocument?.body;
  if (!body || !body.contains(target)) return false;
  if (target.closest(INTERACTIVE)) return false;

  for (let el: Element | null = target; el && el !== body; el = el.parentElement) {
    if (paintsOver(getComputedStyle(el))) return false;
  }
  return true;
}

/**
 * Where the bolt lands, in the wallpaper layer's own space: 0..1 across,
 * 0..1 **bottom → top** (the shader's screen convention, same as `uSun`).
 * Null when the click was outside the layer — with the bezel on, the layer
 * stops inside it, and the band around it is not sky.
 */
export function strikePoint(
  rect: DOMRect,
  clientX: number,
  clientY: number
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = (clientX - rect.left) / rect.width;
  const y = 1 - (clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

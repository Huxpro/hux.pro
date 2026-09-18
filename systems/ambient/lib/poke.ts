// =============================================================================
// The poke — the sky answers where you touched it.
//
// Some weather is worth answering. On a thunder day a click calls a bolt down
// onto the spot (`strike`); on a clear night it sends a meteor away from it
// (`meteor`). Both are the same shape of thing: point-aimed, brief, bright,
// self-cleaning, and belonging to one condition only. A poke is that shape.
//
// The Sky is the only engine that answers. A wash has no geometry to draw a
// channel or a streak on, and a flash with no bolt in it is a different, lesser
// find — so the Gradient and Classic styles simply do not have these easter
// eggs, rather than having worse ones.
//
// This module is the part with no engine in it: which condition is armed, how
// long each answer lives, how often one may fire, and the one question the
// interaction turns on — did that click land on the sky, or on something?
//
// That last question is asked by more than the pokes. The fog wipe (lib/wipe.ts)
// and the gust (lib/wallpaper/stir.ts) are drags rather than taps and run their
// own machinery, but they read `isBackgroundPress` and `isBackgroundClick` from
// here, so no two eggs can come to different answers about what the background
// is. Which is why this module is named for the question and not for one of the
// answers.
//
// "On the sky" is not a guess. A click is on the background when nothing
// between the clicked element and <body> paints anything: no background colour,
// no background image, no backdrop filter, and nothing interactive on the way
// up. That is the same question the visitor answered with their eyes — the
// pixel under the pointer was wallpaper — so the two can never disagree.
//
// The answers are disjoint by construction, so there is no arbitration here and
// never needs to be: `lightning` is 1 only on a thunder day, whose cover of
// 0.96 drives `stars` to 0, and a foggy day's fog of 0.9 does the same. One
// condition, one answer, and the shader carries a single set of uniforms for
// whichever is running.
// =============================================================================

import type { WeatherScene } from "./scene";

/**
 * What a poke can be. The shader reads these as numbers (`uPokeKind`). 2 is
 * spare: it was held for the fog wipe, which turned out to be a drag with a
 * path rather than a tap with a point, so it runs its own uniforms instead.
 */
export type PokeKind = "strike" | "meteor";

export const POKE_KIND_CODE: Record<PokeKind, number> = {
  strike: 1,
  meteor: 3,
};

/**
 * How long each answer lives, ms — the span the shader's envelope is spent
 * over. Past it the renderer retires the poke, because there is nothing left
 * to draw.
 */
export const POKE_MS: Record<PokeKind, number> = {
  strike: 1200,
  // A meteor comes in from off the edge of the screen and crosses it, at one
  // pace whatever the distance, so a long sweep takes the better part of a
  // second and its train wants a beat after that. The shader's METEOR_LIFE is
  // this number — keep the two together.
  meteor: 1700,
};

/**
 * The shortest gap between two pokes, ms. Clicking as fast as you can is capped
 * at two a second — a full-screen flash is exactly the thing that must never
 * become a strobe (WCAG allows three; we allow two). The meteor is no strobe
 * hazard, but the same ceiling is what stops a mashed click turning a wish into
 * a meteor shower.
 */
export const POKE_COOLDOWN_MS = 500;

/**
 * How visible the star field has to be before a click earns a meteor. `stars`
 * already means "can you see stars right now" — it accounts for cloud cover,
 * fog and a bright moon washing the field out — so this is the whole gate: a
 * partly cloudy night with stars still showing gets one, a moonlit night loses
 * it as the field dims, and a thunder or foggy night can never have one.
 *
 * Gated on the scalar, never on `condition === "clear"`, which would wrongly
 * exclude a clear-enough cloudy night.
 */
export const METEOR_STARS_MIN = 0.35;

/** Mark a transparent layer that should still swallow pokes. */
export const POKE_OPT_OUT_ATTR = "data-no-poke";

/**
 * Which answer this scene is armed for, if any. One scene can only ever arm
 * one: see the note at the top of this file.
 */
export function armedPoke(scene: WeatherScene): PokeKind | null {
  if (scene.lightning > 0) return "strike";
  if (scene.stars > METEOR_STARS_MIN) return "meteor";
  return null;
}

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
  `[${POKE_OPT_OUT_ATTR}]`,
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
 * How long a finger must rest before a press-and-hold counts, ms, and how far
 * it may drift while it does.
 *
 * One source for every hold in the ambient system — the fog wipe's arming and
 * the tilt primer's offer — and the same beat as the widget grid's
 * `TOUCH_ACTIVATION`, so a visitor who has learned one hold has learned all of
 * them. They were two copies of 400/10 with three comments promising they
 * matched; now they match because there is one of them.
 */
export const TOUCH_HOLD_MS = 400;
export const TOUCH_HOLD_SLOP_PX = 10;

/** Not in `CSSStyleDeclaration`, and the only way to sit on iOS's own hold. */
const CALLOUT = "-webkit-touch-callout";

/**
 * Sit on iOS's own press gesture for the length of one touch, and hand back
 * the undo. **Call this on `pointerdown`, before the hold, not after it.**
 *
 * iOS starts a ~500 ms clock of its own the moment a finger lands. Left alone
 * it puts up the callout / selection magnifier — but worse than the visual, it
 * takes the touch: once WebKit's gesture recognizer claims the press it stops
 * sending pointer events and fires `pointercancel`, which lands right on top of
 * a 400 ms hold and kills it before it can fire. The fog wipe has suppressed
 * this since it shipped, which is why its hold works on a phone.
 *
 * The inline value is saved and put back rather than simply cleared, because
 * the page may be setting it for its own reasons (`.system-surface` does), and
 * an egg that ends a gesture by clearing a page-wide property is a page-wide
 * regression.
 */
export function holdCallout(): () => void {
  const root = document.documentElement;
  const previous = root.style.getPropertyValue(CALLOUT);
  root.style.setProperty(CALLOUT, "none");
  return () => {
    if (previous) root.style.setProperty(CALLOUT, previous);
    else root.style.removeProperty(CALLOUT);
  };
}

/**
 * Is this press one the sky may answer?
 *
 * The whole of the question, in the one place all the eggs ask it, so that they
 * can never come to different answers: the primary button with nothing held
 * down, nothing already handling the event, no selection about to be disturbed,
 * and a target that is the wallpaper rather than the page. `PointerEvent`
 * extends `MouseEvent`, so a click and a press are the same question here too.
 *
 * The expensive part is `isBackgroundClick`, which walks ancestors asking for
 * computed styles — so it goes last, and callers with a cheaper test of their
 * own (a cooldown, a second finger) should get theirs in before this.
 */
export function isBackgroundPress(event: MouseEvent): boolean {
  if (event.button !== 0 || event.defaultPrevented) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) return false;
  return isBackgroundClick(event.target);
}

/**
 * Where the poke lands, in the wallpaper layer's own space: 0..1 across,
 * 0..1 **bottom → top** (the shader's screen convention, same as `uSun`).
 * Null when the click was outside the layer — with the bezel on, the layer
 * stops inside it, and the band around it is not sky.
 */
export function pokePoint(
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

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

import {
  deriveWeatherScene,
  type SceneOverrides,
  type SceneWeatherInput,
  type WeatherScene,
} from "./scene";
import { startOfLocalDay } from "./solar";

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
 * When a meteor is possible, in the two terms the real answer has.
 *
 * **Dark enough.** The sun must be more than twelve degrees below the horizon
 * — the end of nautical twilight, which is where meteor observing
 * conventionally begins and the first line at which a streak has any contrast
 * to work with. Not a number chosen for feel: the two neighbouring
 * definitions were measured and rejected. Civil twilight (-6) puts meteors
 * over a sky still bright enough to read by. Astronomical twilight (-18), full
 * darkness, is the purist's answer and takes the egg away for 59 nights of the
 * year in London, 118 in Stockholm and 145 in Reykjavik — a threshold that
 * deletes a whole summer is not physics, it is a bug with a citation. At -12
 * London never loses a night (its shortest window is 3.3 hours, its median
 * 9.3), and the far-northern white nights that do lose it genuinely have no
 * meteors to see.
 *
 * **Not obscured.** Whatever is in the way has to leave most of the sky: an
 * overcast, a fog or a downpour hides a meteor at any hour. That is `clarity`,
 * which is cover and fog and nothing else.
 *
 * What is deliberately NOT here is the moon. A bright moon washes out the
 * faint end of a shower — it cuts the RATE you see, not the possibility — and
 * a fireball is a fireball under a full moon. This used to gate on `stars`,
 * which multiplies all three together, and that conflation had two costs: the
 * window opened at an arbitrary -7.99 degrees rather than at any named line,
 * and the moon was documented as able to close it when in fact it never could
 * (365 nights checked, and not one where it did).
 *
 * Gated on the geometry and the weather, never on `condition === "clear"`,
 * which would wrongly exclude a clear-enough cloudy night.
 */
export const METEOR_SUN_MAX_DEG = -12;
export const METEOR_CLARITY_MIN = 0.35;

/** Is the sun far enough down? The question the clock answers. */
export function meteorSkyIsDark(scene: WeatherScene): boolean {
  return scene.sun.elevation < METEOR_SUN_MAX_DEG;
}

/** Is there a way through the murk? The question the weather answers. */
export function meteorSkyIsOpen(scene: WeatherScene): boolean {
  return scene.clarity > METEOR_CLARITY_MIN;
}

/**
 * Could a click earn a meteor in this scene? The whole of the window, in one
 * place, so the devtool's timeline and the click that fires one cannot come to
 * different answers about it — and split in two above, because the devtool has
 * one surface for each half: the timeline marks when it is dark enough, and the
 * condition chips mark which weather you could see through.
 */
export function meteorPossible(scene: WeatherScene): boolean {
  return meteorSkyIsDark(scene) && meteorSkyIsOpen(scene);
}

/** Minutes past local midnight, half-open: `[from, to)`. */
export interface MeteorWindow {
  from: number;
  to: number;
}

/** Minutes between samples in the coarse pass below. */
const WINDOW_STEP_MIN = 5;

/**
 * When a meteor is possible over one local day, as minute intervals.
 *
 * For a timeline: the devtool paints these under the day strip the way it ticks
 * sunrise and sunset. Derived by asking `meteorPossible` about real scenes
 * rather than by solving for the sun's altitude, so the timeline cannot drift
 * from the click — if the rule grows a third term, this follows it for free.
 *
 * Coarse pass every five minutes, then each edge bisected to the minute, which
 * is what the strip is read at. About three hundred scene derivations, each a
 * few hundred multiplies, memoised by the caller.
 *
 * A window that spans midnight comes back as two intervals, one against each
 * end of the day, because that is what a day-wide strip has to draw.
 */
export function meteorWindows(params: {
  /** Any instant of the day to sample; the day is taken from local midnight. */
  dayMs: number;
  lat?: number;
  lon?: number;
  weather: SceneWeatherInput | null;
  theme: "light" | "dark";
  overrides?: SceneOverrides;
}): MeteorWindow[] {
  const startMs = startOfLocalDay(params.dayMs);
  const at = (minute: number) =>
    meteorPossible(
      deriveWeatherScene({
        nowMs: startMs + minute * 60_000,
        lat: params.lat,
        lon: params.lon,
        weather: params.weather,
        theme: params.theme,
        overrides: params.overrides,
      })
    );

  const DAY = 1440;
  /** The first minute in (lo, hi] whose answer differs from lo's. */
  const edge = (lo: number, hi: number) => {
    const want = at(lo);
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (at(mid) === want) lo = mid;
      else hi = mid;
    }
    return hi;
  };

  const windows: MeteorWindow[] = [];
  let openedAt: number | null = at(0) ? 0 : null;
  let previous = 0;
  for (let m = WINDOW_STEP_MIN; m <= DAY; m += WINDOW_STEP_MIN) {
    const minute = Math.min(m, DAY - 1);
    const on = at(minute);
    if (on && openedAt === null) openedAt = edge(previous, minute);
    else if (!on && openedAt !== null) {
      windows.push({ from: openedAt, to: edge(previous, minute) });
      openedAt = null;
    }
    previous = minute;
  }
  if (openedAt !== null) windows.push({ from: openedAt, to: DAY });
  return windows;
}

/** Mark a transparent layer that should still swallow pokes. */
export const POKE_OPT_OUT_ATTR = "data-no-poke";

/**
 * Which answer this scene is armed for, if any. One scene can only ever arm
 * one: see the note at the top of this file.
 */
export function armedPoke(scene: WeatherScene): PokeKind | null {
  if (scene.lightning > 0) return "strike";
  if (meteorPossible(scene)) return "meteor";
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
